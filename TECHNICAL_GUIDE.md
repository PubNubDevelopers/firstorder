# Technical Guide - First Order Development

This document provides comprehensive technical context for Claude Code instances working on the First Order multiplayer tile game. Read this in conjunction with [CLAUDE.md](CLAUDE.md) for project rules and [README.md](README.md) for setup instructions.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Common Commands](#common-commands)
4. [Key Technical Patterns](#key-technical-patterns)
5. [File Structure](#file-structure)
6. [Critical Implementation Details](#critical-implementation-details)
7. [Testing Guidelines](#testing-guidelines)
8. [Common Issues and Solutions](#common-issues-and-solutions)

---

## Project Overview

First Order (also known as "Swap It!") is a real-time multiplayer puzzle game where 2+ players race to arrange emoji tiles in the correct order. Built with React, Vite, and PubNub for real-time communication.

**Key Features:**
- Real-time multiplayer with PubNub pub/sub
- Server-side game logic via PubNub Functions
- Game state stored in PubNub App Context (Objects API)
- Netlify serverless functions for game management
- Client-side queries for game listing
- Three-phase game lifecycle: CREATED → LOCKED → OVER

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Registration │→ │    Lobby     │→ │     Game     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                            │                                │
│                    ┌───────▼────────┐                       │
│                    │ usePubNub Hook │                       │
│                    └───────┬────────┘                       │
└────────────────────────────┼─────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
      ┌─────────▼──────────┐    ┌────────▼─────────┐
      │  PubNub Real-Time  │    │ Netlify Functions│
      │   Pub/Sub + App    │    │   (Game Mgmt)    │
      │      Context       │    └──────────────────┘
      └─────────┬──────────┘
                │
      ┌─────────▼──────────┐
      │ PubNub Functions   │
      │ (Before Publish)   │
      │  - Move Validation │
      │  - Win Detection   │
      └────────────────────┘
```

### Technology Stack

**Frontend:**
- React 19.2.3
- Vite 7.3.0 (build tool)
- PubNub JavaScript SDK 10.2.5
- Pure CSS (no framework)

**Backend:**
- Netlify Functions (Node.js serverless)
- PubNub Functions (Before Publish event handler)
- PubNub App Context (channel metadata as KV store)

### Channel Architecture

**Channels:**
1. `lobby` - Game lobby presence and game list updates
2. `game.{gameId}` - Game play messages (MOVE_SUBMIT, PROGRESS_UPDATE)
3. `admin.{gameId}` - Admin messages (GAME_STARTED, GAME_OVER, PLAYER_JOINED, etc.)

**Channel Naming Convention:**
- Use dot notation: `game.{gameId}`, `admin.{gameId}`
- NOT slash or colon: ~~`game/{gameId}`~~ or ~~`game:{gameId}`~~

### Data Storage

**PubNub App Context (Objects API):**
- Channel metadata stores game state
- Channel ID: `game.{gameId}`
- Basic `status` field: `CREATED`, `LOCKED`, `OVER` (used for server-side filtering)
- Custom fields: `gameState` (JSON), `playerCount`, `createdAt`

**Why App Context vs KV Store?**
- App Context supports indexed server-side filtering via `filter` parameter
- KV Store requires client-side filtering (fetch all, filter locally)
- Status field migration from custom to basic enables `filter: "status == 'CREATED'"`

---

## Common Commands

### Development

```bash
# Client development (hot reload)
cd client
npm run dev
# Runs on http://localhost:5173

# Build client for production
cd client
npm run build

# Preview production build locally
cd client
npm run preview
```

### Netlify Functions

```bash
# Test locally with Netlify Dev (runs functions + client)
npm run dev
# Functions: http://localhost:8888/.netlify/functions/game
# Client: http://localhost:8888

# Deploy to Netlify
cd client
npm run build
netlify deploy --prod
```

### Environment Setup

```bash
# Client environment variables
cd client
cat .env

# Required variables:
VITE_PUBNUB_PUBLISH_KEY=pub-c-...
VITE_PUBNUB_SUBSCRIBE_KEY=sub-c-...
VITE_PUBNUB_FUNCTION_URL=https://pnfirstorder.netlify.app/api/game

# Netlify Functions environment (set in Netlify dashboard)
PUBNUB_PUBLISH_KEY=pub-c-...
PUBNUB_SUBSCRIBE_KEY=sub-c-...
```

### PubNub Setup

**Required PubNub Features:**
1. Message Persistence (1+ day retention)
2. App Context / Objects (with status field as basic field)
3. Functions (Before Publish handler on `game.*` channels)

**Deploy Before Publish Function:**
1. Navigate to PubNub Dashboard → Functions
2. Create new module
3. Add "Before Publish or Fire" event handler
4. Channel pattern: `game.*`
5. Copy code from [server/before-publish-function.js](server/before-publish-function.js)
6. Deploy and start

---

## Key Technical Patterns

### 1. Game State Lifecycle

**State Transitions:**
```
CREATED → LOCKED → OVER
```

**State Meanings:**
- `CREATED`: Game exists in lobby, accepting new players
- `LOCKED`: Game started, moves being processed (name changed from LIVE to LOCKED)
- `OVER`: Game finished, winner declared

**Why LOCKED instead of LIVE?**
- LOCKED indicates the game is no longer open for new players
- It's either at max capacity OR currently being played
- OVER means the game has completely ended

### 2. Server-Side Filtering

**Pattern:** Use PubNub's indexed `status` field for efficient filtering.

```javascript
// ✅ CORRECT - Server-side filtering
const response = await pubnub.objects.getAllChannelMetadata({
  filter: "status == 'CREATED'",  // Only CREATED games returned
  include: {
    customFields: true,
    statusField: true
  }
});

// ❌ WRONG - Client-side filtering (fetches all channels)
const response = await pubnub.objects.getAllChannelMetadata();
const createdGames = response.data.filter(ch => ch.status === 'CREATED');
```

**Why:** Server-side filtering reduces network transfer and improves performance.

### 3. Client-Side vs Backend Responsibilities

**Client-Side (Direct PubNub Queries):**
- List games (`listGames()` in [client/src/utils/gameApi.js](client/src/utils/gameApi.js))
- Real-time subscriptions (via `usePubNub` hook)
- Publishing game messages (MOVE_SUBMIT)

**Backend (Netlify Functions):**
- Create game
- Join game
- Start game
- Leave game
- Update game name
- Game state mutations

**Why this split?**
- Netlify Functions had timeout issues with `getAllChannelMetadata()` (30+ seconds)
- PubNub Node.js SDK in serverless environment has cold start issues
- Client-side JavaScript SDK queries are instant
- Backend handles mutations where validation is needed

### 4. React Hook Dependency Management

**Critical Pattern:** Avoid infinite loops in useEffect.

```javascript
// ❌ WRONG - Creates infinite loop
const fetchGameList = useCallback(async () => {
  const result = await listGames(pubnub);
  setAvailableGames(result.games);
}, [pubnub]); // pubnub changes → callback recreated

useEffect(() => {
  fetchGameList();
}, [fetchGameList]); // callback in deps → infinite loop

// ✅ CORRECT - Exclude callback from deps
const fetchGameList = useCallback(async () => {
  const result = await listGames(pubnub);
  setAvailableGames(result.games);
}, [pubnub]);

useEffect(() => {
  fetchGameList();
}, [
  // fetchGameList intentionally excluded to prevent infinite loop
  // Called once on mount, updates via subscriptions
]);
```

### 5. Real-Time Updates Pattern

**Pattern:** Query once on mount, update via PubNub subscriptions.

```javascript
// Initial query
useEffect(() => {
  fetchGameList(); // Query once
}, []); // Empty deps = once on mount

// Real-time updates
useEffect(() => {
  // Subscribe to lobby channel
  subscribe('lobby', handleMessage);

  return () => unsubscribe('lobby');
}, [subscribe, handleMessage]);

// Handle real-time events
const handleMessage = (event) => {
  if (event.message.type === 'GAME_CREATED') {
    // Add game to list
  } else if (event.message.type === 'GAME_DELETED') {
    // Remove game from list
  }
};
```

### 6. Game ID Generation

**Pattern:** 8-character alphanumeric IDs (no ambiguous characters).

```javascript
// From netlify/functions/lib/gameUtils.js
const GAME_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, I, 0, 1
const GAME_ID_LENGTH = 8;

function generateGameId() {
  let id = '';
  for (let i = 0; i < GAME_ID_LENGTH; i++) {
    id += GAME_ID_CHARS.charAt(Math.floor(Math.random() * GAME_ID_CHARS.length));
  }
  return id;
}
```

---

## File Structure

### Client (`client/src/`)

**Components:**
- [App.jsx](client/src/App.jsx) - Root component, manages app state (REGISTRATION → LOBBY → GAME)
- [components/Registration.jsx](client/src/components/Registration.jsx) - Player name and settings
- [components/Lobby.jsx](client/src/components/Lobby.jsx) - Game lobby, list games, create/join
- [components/Game.jsx](client/src/components/Game.jsx) - Main game component
- [components/PlayerBoard.jsx](client/src/components/PlayerBoard.jsx) - Individual player's tile board
- [components/Tile.jsx](client/src/components/Tile.jsx) - Single tile component
- [components/GameOverModal.jsx](client/src/components/GameOverModal.jsx) - End game modal
- [components/CreateGameModal.jsx](client/src/components/CreateGameModal.jsx) - Game creation form
- [components/ConfirmDialog.jsx](client/src/components/ConfirmDialog.jsx) - Confirmation dialog
- [components/HelpModal.jsx](client/src/components/HelpModal.jsx) - Help/instructions modal

**Hooks:**
- [hooks/usePubNub.js](client/src/hooks/usePubNub.js) - PubNub connection and pub/sub management
  - Returns: `{ pubnub, isConnected, error, subscribe, unsubscribe, publish, hereNow }`

**Utils:**
- [utils/gameApi.js](client/src/utils/gameApi.js) - API functions for Netlify and PubNub
  - `createGame()` - POST to Netlify function
  - `joinGame()` - POST to Netlify function
  - `startGame()` - POST to Netlify function
  - `listGames(pubnub)` - **Direct PubNub query** (lines 149-221)
  - `updateGameName()` - POST to Netlify function
  - `leaveGame()` - POST to Netlify function
- [utils/gameUtils.js](client/src/utils/gameUtils.js) - Game logic utilities
- [utils/emojiThemes.js](client/src/utils/emojiThemes.js) - Emoji themes
- [utils/playerStorage.js](client/src/utils/playerStorage.js) - LocalStorage helpers
- [utils/geolocation.js](client/src/utils/geolocation.js) - Geolocation helpers
- [utils/soundEffects.js](client/src/utils/soundEffects.js) - Sound effects
- [utils/flagEmojis.js](client/src/utils/flagEmojis.js) - Country flag emojis

### Netlify Functions (`netlify/functions/`)

**Main Function:**
- [game.js](netlify/functions/game.js) - Game management API
  - Operations: `create_game`, `join_game`, `start_game`, `get_game`, `list_games`, `leave_game`, `update_game_name`, `clear_games`

**Libraries:**
- [lib/storage.js](netlify/functions/lib/storage.js) - PubNub App Context abstraction
- [lib/gameUtils.js](netlify/functions/lib/gameUtils.js) - Game utility functions

### PubNub Functions (`server/`)

- [before-publish-function.js](server/before-publish-function.js) - Move validation and win detection
  - Bound to `game.*` channels
  - Handles: `MOVE_SUBMIT` messages
  - Validates moves, updates state, checks for winner
  - Publishes: `PROGRESS_UPDATE` and `GAME_OVER` messages

---

## Critical Implementation Details

### 1. App Context Query in Lobby

**Location:** [client/src/utils/gameApi.js](client/src/utils/gameApi.js) lines 149-221

**Key Points:**
- **MUST** include `filter: "status == 'CREATED'"` for server-side filtering
- Queries directly from client (not via Netlify function)
- Requires PubNub instance parameter
- Handles pagination with `page` parameter
- Filters for channels starting with `game.` prefix

```javascript
export async function listGames(pubnub) {
  if (!pubnub) {
    throw new Error('PubNub instance is required');
  }

  const games = [];
  let page = null;

  do {
    const params = {
      limit: 100,
      include: {
        customFields: true,
        statusField: true
      },
      filter: "status == 'CREATED'" // CRITICAL: Server-side filter
    };

    if (page) {
      params.page = page;
    }

    const response = await pubnub.objects.getAllChannelMetadata(params);

    if (response.data) {
      for (const channel of response.data) {
        if (channel.id.startsWith('game.') &&
            channel.custom &&
            channel.custom.gameState) {
          const gameState = JSON.parse(channel.custom.gameState);
          games.push(/* ... */);
        }
      }
    }

    page = response.next;
  } while (page);

  return { success: true, games };
}
```

### 2. Lobby Component Dependencies

**Location:** [client/src/components/Lobby.jsx](client/src/components/Lobby.jsx) lines 304-318

**Critical:** `fetchGameList` is **intentionally excluded** from useEffect dependencies to prevent infinite loop.

```javascript
useEffect(() => {
  // ... subscription setup
}, [
  isConnected,
  subscribe,
  handlePresenceEvent,
  handleGameCreated,
  handleGameStarted,
  handlePlayerJoinedGame,
  handlePlayerLeftGame,
  handleGameDeleted,
  handleGameNameUpdated,
  fetchLobbyPresence,
  playerInfo.playerName
  // NOTE: fetchGameList intentionally excluded to prevent infinite loop
  // It's called once on mount and doesn't need to re-run
]);
```

### 3. Game State Storage Format

**Location:** PubNub App Context channel metadata

**Structure:**
```javascript
{
  id: "game.ABC123XY",
  name: "Craig's Game",
  description: "First Order game - Status: CREATED",
  status: "CREATED", // Basic field (indexed, filterable)
  custom: {
    gameState: JSON.stringify({
      gameId: "ABC123XY",
      phase: "CREATED",
      gameName: "Craig's Game",
      tileCount: 4,
      emojiTheme: "food",
      maxPlayers: 10,
      tilePinningEnabled: false,
      verifiedPositionsEnabled: false,
      players: { /* player states */ },
      playerIds: ["player1", "player2"],
      playerNames: { "player1": "Craig" },
      playerLocations: { "player1": { /* geo data */ } },
      createdAt: 1766512345678,
      // Game state fields
      tiles: { "0": "🍕", "1": "🚀", "2": "🐶", "3": "🎸" },
      goalOrder: { "a": 0, "b": 1, "c": 2, "d": 3 },
      initialOrder: { "a": 2, "b": 0, "c": 3, "d": 1 },
      startTT: null,
      winnerPlayerId: null,
      winTT: null,
      lockedTT: null
    }),
    playerCount: 2,
    createdAt: 1766512345678
  }
}
```

### 4. Before Publish Function Logic

**Location:** [server/before-publish-function.js](server/before-publish-function.js)

**Flow:**
1. Receive `MOVE_SUBMIT` message on `game.{gameId}` channel
2. Load game state from App Context
3. Validate game is in LIVE state
4. Validate player is in roster
5. Calculate positions correct vs goal order
6. Update player state in game
7. Save to App Context
8. Check for winner (all positions correct)
   - If winner: Publish `PROGRESS_UPDATE`, then `GAME_OVER` to `admin.{gameId}`
   - If not: Publish `PROGRESS_UPDATE` to `game.{gameId}`
9. Abort original `MOVE_SUBMIT` message

**Important:** Function has access to `goalOrder` which is never sent to clients until game ends.

### 5. Netlify Function Configuration

**Location:** [netlify/functions/game.js](netlify/functions/game.js) lines 44-50

**PubNub Client Config:**
```javascript
return new PubNub({
  publishKey,
  subscribeKey,
  userId: 'server-function',
  restore: false,    // Disable state restoration for serverless
  keepAlive: false   // Disable keep-alive for serverless
});
```

**Why these settings?**
- Serverless functions are stateless and ephemeral
- No need to restore state or maintain connections

---

## Testing Guidelines

### Before Every Deploy

**CRITICAL:** Always test in the browser before deploying.

```bash
# 1. Build
cd client
npm run build

# 2. Test locally with Netlify Dev
cd ..
npx netlify dev
# Open http://localhost:8888

# 3. Test the full flow:
#    - Register player
#    - Enter lobby (check: games list loads)
#    - Create game (check: appears in lobby)
#    - Join with 2nd browser/tab
#    - Start game
#    - Make moves (check: no infinite loops)
#    - Leave game (check: calls stop)

# 4. Check browser console for errors

# 5. Deploy
cd client
netlify deploy --prod
```

### Common Test Cases

1. **Lobby Infinite Loop Check:**
   - Open browser console → Network tab
   - Filter for `getAllChannelMetadata`
   - Enter lobby
   - Should see ONE request
   - Leave lobby → return to registration
   - Should see NO more requests

2. **Server-Side Filter Check:**
   - Open browser console → Network tab
   - Enter lobby
   - Find `getAllChannelMetadata` request
   - Check payload: should include `filter: "status == 'CREATED'"`

3. **Game State Transitions:**
   - Create game → status should be `CREATED`
   - Start game → status should be `LOCKED`
   - Win game → status should be `OVER`

### Debugging Tools

```bash
# Check Netlify function logs
netlify functions:log game

# Check deployed site logs
open "https://app.netlify.com/sites/pnfirstorder/logs/functions"

# Test Netlify function locally
curl -X POST "http://localhost:8888/.netlify/functions/game?operation=list_games" \
  -H "Content-Type: application/json"

# Check PubNub Debug Console
# https://dashboard.pubnub.com → Debug Console
```

---

## Common Issues and Solutions

### Issue 1: Netlify Function Timeout

**Symptom:** `getAllChannelMetadata()` times out (30+ seconds) in Netlify function.

**Root Cause:** PubNub Node.js SDK has issues in serverless environments with cold starts.

**Solution:** Query App Context directly from client instead of through Netlify function.

**Files Changed:**
- [client/src/utils/gameApi.js](client/src/utils/gameApi.js) - Changed `listGames()` to accept PubNub instance
- [client/src/components/Lobby.jsx](client/src/components/Lobby.jsx) - Pass PubNub instance to `listGames()`

### Issue 2: Infinite Loop in Lobby

**Symptom:** `getAllChannelMetadata` called continuously, even after leaving lobby.

**Root Cause:** `fetchGameList` callback recreated when `pubnub` changes, triggering useEffect infinitely.

**Solution:** Remove `fetchGameList` from useEffect dependency array.

**File:** [client/src/components/Lobby.jsx](client/src/components/Lobby.jsx) lines 304-318

```javascript
useEffect(() => {
  fetchGameList();
}, [
  // fetchGameList intentionally excluded to prevent infinite loop
]);
```

### Issue 3: Missing Server-Side Filter

**Symptom:** All game channels fetched, then filtered client-side.

**Root Cause:** Forgot to include `filter: "status == 'CREATED'"` parameter.

**Solution:** Add filter parameter to `getAllChannelMetadata()` call.

**File:** [client/src/utils/gameApi.js](client/src/utils/gameApi.js) line 168

```javascript
const params = {
  limit: 100,
  include: {
    customFields: true,
    statusField: true
  },
  filter: "status == 'CREATED'" // MUST include this
};
```

### Issue 4: Status Field Not Filterable

**Symptom:** Server-side filter not working, returns all games regardless of status.

**Root Cause:** Status stored in `custom` field (not indexed) instead of basic `status` field.

**Solution:** Migrate status from `custom.status` to basic `status` field in all App Context operations.

**Files:**
- [netlify/functions/lib/storage.js](netlify/functions/lib/storage.js) - Use `status` basic field
- [server/before-publish-function.js](server/before-publish-function.js) - Update `status` field

### Issue 5: LOCKED vs OVER Confusion

**Symptom:** Misunderstanding of game phase meanings.

**Clarification:**
- `CREATED` = Game in lobby, accepting players
- `LOCKED` = Game started, moves being processed (previously called LIVE)
- `OVER` = Game finished, winner declared

**Note:** LOCKED means no new players can join (either max capacity or currently playing).

---

## Additional Resources

### PubNub Documentation

- [PubNub JavaScript SDK](https://www.pubnub.com/docs/sdks/javascript)
- [App Context (Objects API)](https://www.pubnub.com/docs/general/metadata/objects)
- [PubNub Functions](https://www.pubnub.com/docs/general/functions)
- [Server-Side Filtering](https://www.pubnub.com/docs/general/metadata/filtering)

### Project Links

- **Live Site:** https://pnfirstorder.netlify.app
- **Netlify Dashboard:** https://app.netlify.com/sites/pnfirstorder
- **PubNub Dashboard:** https://dashboard.pubnub.com

### Environment Variables

**Client (.env):**
```
VITE_PUBNUB_PUBLISH_KEY=pub-c-66ab3e60-11b7-4792-a753-92b7e510a21e
VITE_PUBNUB_SUBSCRIBE_KEY=sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe
VITE_PUBNUB_FUNCTION_URL=https://pnfirstorder.netlify.app/api/game
```

**Netlify Functions (set in Netlify dashboard):**
```
PUBNUB_PUBLISH_KEY=pub-c-66ab3e60-11b7-4792-a753-92b7e510a21e
PUBNUB_SUBSCRIBE_KEY=sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe
```

---

## Quick Reference

### Key Files to Know

1. **[client/src/utils/gameApi.js:149-221](client/src/utils/gameApi.js)** - List games with server-side filter
2. **[client/src/components/Lobby.jsx:304-318](client/src/components/Lobby.jsx)** - useEffect dependencies (no infinite loop)
3. **[client/src/hooks/usePubNub.js](client/src/hooks/usePubNub.js)** - PubNub connection management
4. **[netlify/functions/game.js](netlify/functions/game.js)** - Game management operations
5. **[netlify/functions/lib/storage.js](netlify/functions/lib/storage.js)** - App Context wrapper
6. **[server/before-publish-function.js](server/before-publish-function.js)** - Move validation logic

### Key Patterns to Remember

1. **Always test before deploying** - Open browser, test full flow, check console
2. **Server-side filtering** - Use `filter: "status == 'CREATED'"` for queries
3. **Client queries, backend mutations** - List games client-side, modify server-side
4. **Dependency management** - Avoid infinite loops in useEffect
5. **Status field** - Use basic field, not custom field, for filtering
6. **Channel naming** - Use dots: `game.{id}`, not slashes or colons

---

*Last updated: 2025-12-29*
*Project: First Order (Swap It!) - Multiplayer Tile Game*
*Author: Craig Conover <craig@pubnub.com>*
