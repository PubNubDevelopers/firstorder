# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# First Order - Multiplayer Tile Game

Real-time multiplayer puzzle game built with React, Vite, PubNub, and Netlify Functions.

## Quick Start Commands

### Development
```bash
# Client development (hot reload on port 5173)
cd client && npm run dev

# Local dev with Netlify Functions (port 8888)
npm run dev  # or: netlify dev

# Build for production
cd client && npm run build
```

### Deployment
```bash
# Deploy to Netlify production
cd client && npm run build
netlify deploy --prod

# Deploy functions only
netlify deploy --prod --functions=netlify/functions
```

### Environment Setup
Client requires these environment variables (set in Netlify dashboard):
- `VITE_PUBNUB_PUBLISH_KEY`
- `VITE_PUBNUB_SUBSCRIBE_KEY`
- `VITE_PUBNUB_FUNCTION_URL`

Backend functions require:
- `PUBNUB_PUBLISH_KEY`
- `PUBNUB_SUBSCRIBE_KEY`

---

## Architecture Overview

### Three-Tier Real-Time Architecture

**Client (React + Vite):**
- Queries App Context directly for game listings (client-side)
- Subscribes to PubNub channels for real-time updates
- Publishes game moves to `game.{gameId}` channels

**Netlify Functions (Node.js Serverless):**
- Handles game mutations (create, join, start, leave, update name)
- Never queries App Context (causes timeouts in serverless)
- All operations via POST to `/.netlify/functions/game?operation=<op>`

**PubNub Functions (Before Publish):**
- Bound to `game.*` channels
- Server-side move validation and win detection
- Updates game state in App Context
- Publishes progress/game-over messages

### Data Storage: PubNub App Context

Game state stored as channel metadata at `game.{gameId}`:
- **Basic `status` field**: `CREATED`, `LOCKED`, `OVER` (indexed, filterable)
- **Custom fields**: `gameState` (JSON), `playerCount`, `createdAt`

**Critical**: Use basic `status` field (not custom) for server-side filtering:
```javascript
// ✅ CORRECT
pubnub.objects.getAllChannelMetadata({
  filter: "status == 'CREATED'"  // Server-side filtering
})

// ❌ WRONG - fetches ALL channels
pubnub.objects.getAllChannelMetadata()
```

### Channel Architecture

- `lobby` - Game lobby presence and real-time game list updates
- `game.{gameId}` - Game moves (MOVE_SUBMIT, PROGRESS_UPDATE)
- `admin.{gameId}` - Admin messages (GAME_STARTED, GAME_OVER, PLAYER_JOINED, etc.)

**Naming convention**: Use dots, not slashes: `game.ABC123` not `game/ABC123`

### Game State Lifecycle

```
CREATED → LOCKED → OVER
```

- **CREATED**: Game in lobby, accepting players
- **LOCKED**: Game started, moves being processed (no new players)
- **OVER**: Game finished, winner declared

---

## Critical Implementation Patterns

### 1. Prevent Infinite Loops with useMemo

**Problem**: Creating config objects in render causes PubNub to reinitialize on every render.

**Solution**: Memoize all PubNub config objects:
```javascript
// ✅ CORRECT - App.jsx
const pubnubConfig = useMemo(() => ({
  publishKey: import.meta.env.VITE_PUBNUB_PUBLISH_KEY,
  subscribeKey: import.meta.env.VITE_PUBNUB_SUBSCRIBE_KEY,
  userId: playerInfo?.playerId || 'default'
}), [playerInfo?.playerId]);

// ❌ WRONG - creates new object every render
const pubnubConfig = {
  publishKey: import.meta.env.VITE_PUBNUB_PUBLISH_KEY,
  // ...
};
```

### 2. useEffect Dependencies for Real-Time Updates

**Pattern**: Query once on mount, update via subscriptions:
```javascript
// LobbyV2.jsx / Lobby.jsx pattern
const fetchGameList = useCallback(async () => {
  const result = await listGames(pubnub);
  setAvailableGames(result.games);
}, [pubnub]);

useEffect(() => {
  if (!isConnected) return;

  // Subscribe to real-time events
  const unsubscribeLobby = subscribe('lobby', handleMessage);

  // Initial query (only runs once)
  fetchGameList();

  return () => unsubscribeLobby();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isConnected]);
```

**Why minimal dependencies?**
- Handler functions (`handleMessage`, etc.) are `useCallback` with state deps
- Including them causes effect to re-run on every state change → infinite loop
- `subscribe` callback recreates when `pubnub` changes → triggers effect
- Solution: Only depend on `isConnected`, use stable closures for functions
- Use `eslint-disable-next-line` to suppress exhaustive-deps warning

### 3. Client vs Backend Responsibilities

**Client** (direct PubNub queries):
- List games with `listGames(pubnub)` in `gameApi.js`
- Real-time subscriptions via `usePubNub` hook
- Publishing game moves

**Backend** (Netlify Functions):
- Create/join/start/leave game
- All game state mutations
- Never queries App Context (causes timeouts)

### 4. Vite Environment Variables

Only variables prefixed with `VITE_` are included in the client build:
- Client: `VITE_PUBNUB_PUBLISH_KEY`, `VITE_PUBNUB_SUBSCRIBE_KEY`
- Backend: `PUBNUB_PUBLISH_KEY`, `PUBNUB_SUBSCRIBE_KEY` (no VITE_ prefix)

---

## Key File Locations

### Critical Files (Reference by Line Number)

- `client/src/App.jsx:15-19` - pubnubConfig memoization
- `client/src/utils/gameApi.js:149-221` - listGames with server-side filter
- `client/src/components/Lobby.jsx:304-318` - useEffect dependencies (infinite loop prevention)
- `client/src/hooks/usePubNub.js` - PubNub connection management
- `netlify/functions/game.js` - Game management API
- `server/before-publish-function.js` - Move validation logic

### Component Hierarchy

```
App.jsx (root)
├── Registration.jsx
├── Lobby.jsx
│   ├── CreateGameModal.jsx
│   └── ConfirmDialog.jsx
└── Game.jsx
    ├── PlayerBoard.jsx
    │   └── Tile.jsx
    ├── GameOverModal.jsx
    └── HelpModal.jsx
```

---

## Common Issues and Solutions

### Infinite Loop: getAllChannelMetadata

**Symptom**: Continuous PubNub API calls in browser console

**Cause**: Config object recreated on every render (see Critical Pattern #1)

**Fix**: Memoize with `useMemo` in App.jsx

### Netlify Function Timeout

**Symptom**: 30+ second timeouts when calling App Context from functions

**Cause**: PubNub Node.js SDK has cold start issues in serverless

**Fix**: Query App Context from client, not from Netlify Functions

### Missing Server-Side Filter

**Symptom**: All games fetched, then filtered client-side

**Cause**: Missing `filter: "status == 'CREATED'"` parameter

**Fix**: Add filter to `getAllChannelMetadata()` call in `gameApi.js:168`

---

## Testing Before Deploy

**CRITICAL**: Always test in browser before deploying:

```bash
cd client
npm run build
netlify deploy --prod

# Then test:
# 1. Enter lobby (check: ONE getAllChannelMetadata call)
# 2. Open create game modal (check: NO new calls)
# 3. Leave lobby (check: calls STOP)
# 4. Check browser console for errors
```

---

# Project Rules

## ALWAYS
- ALWAYS start by restating the goal, current state, and the smallest next deliverable.
- ALWAYS ask for or locate existing conventions in the repo before adding new patterns (naming, folder structure, linting, testing, config).
- ALWAYS work in small, reviewable steps. Prefer multiple small commits over one large change.
- ALWAYS keep changes scoped to the requested feature/fix. Avoid unrelated refactors unless necessary.
- ALWAYS write or update project docs when behavior, setup, or architecture changes:
  - README.md setup steps
  - /docs/* planning notes (if present)
- ALWAYS add clear, actionable TODOs in README under a "Future Improvements" section for non-launch-critical enhancements.

## PLANNING WORKFLOW
- ALWAYS use a planning-first approach:
  - Identify user story / requirement
  - Identify affected modules
  - Propose an implementation plan (bulleted steps)
  - Confirm constraints (stack, hosting, DB, deployment)
  - Then implement
- ALWAYS write plans to markdown when asked (root or /docs):
  - USER_STORIES.md
  - DATA_MODELS.md
  - TECH_STACK.md
  - DEVELOPMENT_PLAN.md
  - SECURITY_PLAN.md

## AVOID PREMATURE OPTIMIZATION
- ALWAYS prioritize “make it work correctly” over performance features.
- NEVER add caching, retries, rate limiting, queues, or complex abstractions unless:
  - The feature is working end-to-end, AND
  - There is a stated requirement or demonstrated need.
- If optimization/security hardening is suggested but not required for launch, move it to:
  - README → Future Improvements / TODO.

## QUALITY CHECKS
- ALWAYS do a quick internal code review before finishing:
  - DRY: no copy/paste logic repeated 3+ times (extract utilities)
  - SRP: avoid “god files” and “god functions”
  - Consistency with repo conventions
- ALWAYS run available linters/tests (or provide exact commands to run).
- When asked for an “extra QC layer,” provide:
  1) Findings
  2) Risk level
  3) Recommended fixes (smallest first)
  4) Follow-up checklist

## DEBUGGING EXPECTATIONS
- ALWAYS request or use these artifacts when debugging:
  - Server logs (terminal output)
  - Browser console errors
  - Network tab request/response details
- ALWAYS add targeted, temporary logs (and remove/guard them before finalizing).
- ALWAYS include reproduction steps and expected vs actual behavior in your analysis.

## GIT HYGIENE
- ALWAYS assume feature work happens on a branch.
- ALWAYS keep commit messages descriptive and scoped.
- If asked to set up a repo:
  - git init
  - set remote (SSH)
  - first commit
  - push main
- ALWAYS avoid committing generated files or secrets.

## SECURITY BASICS (NON-NEGOTIABLE)
- NEVER commit secrets, API keys, tokens, credentials, or private URLs.
- ALWAYS use environment variables (.env) and add secrets files to .gitignore.
- If user uploads are involved:
  - ALWAYS lock down object storage buckets (no public write; least-privilege access).
  - ALWAYS strip EXIF metadata from user-uploaded images.
- If handling sensitive domains (finance/medical/PII-heavy):
  - ALWAYS warn that “vibe coding” is risky and recommend stronger review/security posture.

## MCP / DOC ACCURACY
- If MCPs are available, ALWAYS use them for accuracy on framework/library behavior.
- When unsure about a library API, ALWAYS prefer authoritative docs over guessing.
- If you don’t have access to docs/tools, say so and propose a verification step.
- The PubNub MCP is of utmost importance to this project. Leverage it for all PubNub integrations.

## SESSION MANAGEMENT
- ALWAYS keep context clean:
  - Prefer separate sessions for research vs implementation.
- NEVER “compact” if it can be avoided; when context is getting large:
  - Summarize the current state into a markdown note
  - Start a fresh session and continue from that note

## COMMUNICATION STYLE
- ALWAYS be direct, opinionated, and practical.
- ALWAYS call out risks, tradeoffs, and assumptions.
- NEVER hide uncertainty; if something is unclear, say what you’d check next.

