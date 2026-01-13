# V4 Tournament Mode Implementation Plan

## Goal
Extend First Order game from v3 (regular games + invite-only) to v4 (tournament mode with bracket progression, 8-100 players, multiple rounds, tournament summary page).

## Key Design Changes (Updated Plan)

1. **Bracket Advancement**: Top 1-4 players advance (not 1-3)
   - Seed terminology: 1st seed, 2nd seed, 3rd seed, 4th wildcard
2. **Minimum Players**: 8 players required to create tournament (not 4)
3. **Channel Naming**: Tournament games use `game.t.{tournamentId}-r{roundNum}-g{gameNum}` (includes "game." prefix for compatibility)
4. **Tournament Channel Schema**: Removed redundant custom fields (`tournamentId`, `phase`)
5. **Tournament Membership Schema**: Removed `totalMoveCount`, `roundResults` (not needed)
6. **Eliminated Players**: Redirect to tournament summary page (no spectator/watch features in v4)
7. **Create Tournament**: Extend Create Game dialog with tournament-specific fields (maxPlayers 8-100, advancementRule 1-4)

---

## User Requirements Summary

### Tournament Flow
1. Host creates tournament via Create Game dialog with Player Mode: Tournament (8-100 players)
2. Host invites multiple players (leverages v3 invitation system)
3. Players distributed: 4-10 per game, evenly as possible
4. Round 1 countdown screen (20s) showing all games/players
5. All games start simultaneously with 3s countdown
6. Top 1-4 players advance to next round (configurable by host)
   - **Seeds**: 1st seed, 2nd seed, 3rd seed, 4th wildcard
7. Next round auto-starts 10s after last game completes
8. Final round: exactly 4 players (championship)
9. Results displayed on tournament summary page (live updates as rounds complete)

### User-Confirmed Design Decisions
- **Bracket Type**: Configurable by host (top 1-4 advance per game: 1st seed, 2nd seed, 3rd seed, 4th wildcard)
- **Minimum Players**: 8 players required to create tournament
- **Disconnects**: Eliminate disconnected players (only completers advance)
- **Game Config**: Same settings for all rounds (tileCount, emojiTheme, etc.)
- **Eliminated Players**: Redirected to tournament summary page (no game watching/spectator mode)
- **Channel Naming**: Tournament games use `game.t.{tournamentId}-r{roundNum}-g{gameNum}` format

---

## V3 App Context Schema (Current State)

### Channel Metadata (game.{gameId})
**Basic**: id, name, status (CREATED/LIVE/OVER), type
**Custom**: phase, tileCount, emojiTheme, maxPlayers, tiles, goalOrder, initialOrder, timestamps, winner info, feature flags, inviteOnly

### User Metadata (player UUID)
**Basic**: id, name
**Custom**: playerLocation

### Memberships (game.{gameId} → player)
**Custom**: role, joinedAt, moveCount, positionsCorrect, finished, finishTT, placement, currentOrder, correctnessHistory, status (INVITED/JOINED/DENIED for invite-only games)

---

## V4 App Context Schema (Tournament Extension)

### 1. Tournament Channel Metadata

**Channel ID**: `t.{tournamentId}` (e.g., `t.AI21ZGWK`)

**Basic Fields**:
- `id`: `t.{tournamentId}`
- `name`: Tournament name
- `status`: `CREATED` | `LIVE` | `OVER` (server-side filterable)
- `type`: `"tournament"`

**Custom Fields**:
```javascript
{
  tileCount: number,               // Same for all rounds
  emojiTheme: string,
  maxPlayers: number,              // 8-100
  advancementRule: number,         // Top N advance (1-4): 1st seed, 2nd seed, 3rd seed, 4th wildcard
  tilePinningEnabled: boolean,
  verifiedPositionsEnabled: boolean,
  currentRound: number,            // 0 = not started
  totalRounds: number,             // Calculated at start
  createdAt: number,
  startedAt: number | null,
  completedAt: number | null,
  rounds: string,                  // JSON array of round summaries
  finalPlacements: string | null,  // JSON array of top 4 finishers
  hostPlayerId: string,
  hostName: string
}
```

**Note**: `tournamentId` is derived from channel `id` (not stored in custom fields). `phase` is redundant with basic `status` field (removed).

### 2. Tournament Round Game Channel Metadata

**Channel ID**: `game.t.{tournamentId}-r{roundNum}-g{gameNum}` (e.g., `game.t.AI21ZGWK-r01-g03`)

**Basic Fields**:
- `id`: `game.t.{tournamentId}-r{roundNum}-g{gameNum}`
- `name`: `"Round {roundNum} - Game {gameNum}"`
- `status`: `CREATED` | `LIVE` | `OVER`
- `type`: `"tournament-game"`

**Custom Fields**: Extends v3 game schema with:
```javascript
{
  // Tournament Context
  tournamentId: string,
  roundNum: number,
  gameNum: number,
  advancementRule: number,       // Top N advance (1-4)

  // Standard v3 Game Fields (inherited)
  phase, tileCount, emojiTheme, maxPlayers, placementCount,
  tilePinningEnabled, verifiedPositionsEnabled,
  tiles, goalOrder, initialOrder,
  createdAt, startTT, endTT, winnerPlayerId, winnerName, winTT
}
```

**Note**: Uses `game.` prefix to ensure compatibility with existing v3 game infrastructure (PubNub Functions, game logic).

### 3. Tournament Memberships (Participant Roster)

**Membership**: `player UUID → t.{tournamentId}`

**Custom Fields**:
```javascript
{
  role: string,                    // "host" | "player"
  status: string,                  // "INVITED" | "JOINED" | "DENIED" | "ACTIVE" | "ELIMINATED" | "FINISHED"
  invitedAt: number | null,
  invitedBy: string | null,
  joinedAt: number,
  currentRound: number,            // 0 = not started
  currentGameId: string | null,    // e.g., "game.t.AI21ZGWK-r02-g01"
  eliminatedInRound: number | null,
  finalPlacement: number | null,   // 1-4 for championship finishers (1st seed, 2nd seed, 3rd seed, wildcard)
  roundsPlayed: number
}
```

**Status Transitions**:
- INVITED → JOINED (accepts) or DENIED (rejects)
- JOINED → ACTIVE (Round 1 starts)
- ACTIVE → ACTIVE (advances) or ELIMINATED (fails to advance)
- ACTIVE → FINISHED (wins championship)

**Removed Fields**: `totalMoveCount`, `roundResults` (not needed for tournament tracking)

### 4. Round Game Memberships

**Membership**: `player UUID → game.t.{tournamentId}-r{roundNum}-g{gameNum}`

**Custom Fields**: Standard v3 game membership fields (role, joinedAt, moveCount, positionsCorrect, finished, finishTT, placement, currentOrder, correctnessHistory)

**Note**: No special tournament-specific fields needed. Placement (1-4) maps to seeds/wildcard: 1st seed, 2nd seed, 3rd seed, 4th wildcard.

---

## API Operations (Netlify Functions)

### 1. createTournament
**Endpoint**: `POST /tournament?operation=create_tournament`
- Generate tournamentId
- Calculate totalRounds
- Create tournament Channel metadata
- Add host as member with role="host", status="JOINED"

### 2. inviteTournamentPlayer
**Endpoint**: `POST /tournament?operation=invite_player`
- Reuse v3 invitation pattern
- Create membership with status="INVITED"
- Publish to `admin.t.{tournamentId}` and `user.{targetPlayerId}`

### 3. startTournament (Round 1)
**Endpoint**: `POST /tournament?operation=start_tournament`
- Validate minimum 8 JOINED members (exclude INVITED/DENIED)
- Calculate bracket distribution (4-10 players per game)
- Create round game channels with `game.t.{tournamentId}-r01-g{gameNum}` format
- Assign players to games
- Update tournament: status="LIVE", currentRound=1
- Trigger 20s countdown → 3s countdown → simultaneous game starts

### 4. advanceRound (Auto-triggered)
**Endpoint**: `POST /tournament?operation=advance_round`
- Query all games in completed round
- Collect top N finishers (placement <= advancementRule, where N = 1-4)
  - placement=1: 1st seed
  - placement=2: 2nd seed
  - placement=3: 3rd seed
  - placement=4: 4th wildcard
- Update eliminated players: status="ELIMINATED", eliminatedInRound=currentRound
- Redirect eliminated players to tournament summary page
- Check if championship round (≤4 players)
- Create next round games with `game.t.{tournamentId}-r{roundNum}-g{gameNum}` format
- Wait 10s, trigger next round countdown

### 5. getTournamentStatus
**Endpoint**: `POST /tournament?operation=get_status`
- Return tournament metadata + player status + current round games

### 6. getTournamentResults
**Endpoint**: `POST /tournament?operation=get_results`
- Return final placements + round history

---

## Real-Time Messaging

### Tournament-Level Messages (Channel: `admin.t.{tournamentId}`)

1. **TOURNAMENT_CREATED**
2. **PLAYER_INVITED** (reuse v3)
3. **PLAYER_JOINED_TOURNAMENT**
4. **TOURNAMENT_STARTED** - includes full bracket
5. **ROUND_STARTING** - 20s countdown with bracket display
6. **ROUND_COMPLETE** - advancing/eliminated players, 10s until next round
7. **TOURNAMENT_OVER** - final placements

### Per-Game Messages (Channels: `game.t.X-rNN-gMM`, `admin.game.t.X-rNN-gMM`)

Reuse all v3 game messages (MOVE_SUBMIT, PROGRESS_UPDATE, PLAYER_FINISHED, GAME_OVER) with tournament context added.

### Personal User Channel (Channel: `user.{playerId}`)

1. **TOURNAMENT_INVITATION** (reuse v3 GAME_INVITATION pattern)
2. **ELIMINATED_FROM_TOURNAMENT** - includes eliminatedInRound, redirect to summary page
3. **ROUND_ADVANCED** - notification when advancing to next round

---

## Key Algorithms

### Bracket Distribution
```javascript
function calculateBracketDistribution(playerCount, minPlayers = 4, maxPlayers = 10) {
  // Distribute N players into games of 4-10, as evenly as possible
  // Minimum 8 players required to create tournament
  // Examples:
  // 8 players → [8] (1 game) OR [4, 4] (2 games)
  // 32 players → [8, 8, 8, 8] (4 games)
  // 17 players → [6, 6, 5] (3 games)
  // 100 players → [10, 10, ...] (10 games)
}
```

### Seed Assignment
```javascript
// Map placement to seed terminology
function getSeedName(placement, advancementRule) {
  if (placement > advancementRule) return null; // Eliminated

  const seedNames = {
    1: '1st seed',
    2: '2nd seed',
    3: '3rd seed',
    4: '4th wildcard'
  };

  return seedNames[placement] || `${placement}th place`;
}
```

### Round Completion Detection
- PubNub Function triggers Netlify Function on each GAME_OVER for tournament games
- Netlify Function queries all `game.t.{tournamentId}-r{roundNum}-*` channels, checks if all status="OVER"
- Client-side polling as backup (every 5s)
- Tournament summary page subscribes to `admin.t.{tournamentId}` for ROUND_COMPLETE messages

### Synchronized Game Starts
```javascript
// Two-phase countdown coordination
1. Publish ROUND_STARTING (20s) → clients display bracket
2. Wait 20s
3. Publish COUNTDOWN (3, 2, 1) to all game admin channels
4. Publish GAME_START simultaneously to all games
```

---

## Edge Cases Handled

1. **Minimum players**: Tournament requires 8+ players to start (validation on create and start)
2. **Odd number of players**: Distribute as evenly as possible (some games have 1 extra player)
3. **Ties in placement**: Tiebreakers: (1) lower moveCount, (2) earlier finishTT
4. **Not enough players advance**: Create fewer games or single championship game (4 players)
5. **Tournament cancellation**: Only allowed during CREATED phase, notify all players
6. **Player disconnects**: Presence timeout → status="ELIMINATED", redirect to summary page
7. **Advancing players**: Only game completers advance (placement 1-4, based on advancementRule)

---

## Backward Compatibility

### Channel Naming Distinction
- v3 regular games: `game.{gameId}` (e.g., `game.ABC123`)
- v4 tournaments: `t.{tournamentId}` (e.g., `t.AI21ZGWK`)
- v4 tournament games: `game.t.{tournamentId}-r{roundNum}-g{gameNum}` (e.g., `game.t.AI21ZGWK-r01-g03`)

### Why `game.` Prefix for Tournament Games?
Tournament games reuse v3 game infrastructure (PubNub Functions, move validation, win detection). The `game.` prefix ensures:
- Before-publish function triggers correctly (bound to `game.*`)
- Game logic processes moves identically to regular games
- Minimal code changes to support tournament games

### Query Separation
```javascript
// List regular games (v3)
filter: "id LIKE 'game.*' AND id NOT LIKE 'game.t.*' AND status == 'CREATED'"

// List tournaments (v4)
filter: "id LIKE 't.*' AND type == 'tournament' AND status == 'CREATED'"

// List tournament games for specific tournament
filter: "id LIKE 'game.t.AI21ZGWK-*' AND status == 'LIVE'"
```

### v3 Clients
Update v3 `listGames` filter to exclude tournament games:
```javascript
"id LIKE 'game.*' AND id NOT LIKE 'game.t.*'"
```

---

## Implementation Phases

### Phase 1: Core Tournament Infrastructure
- Extend CreateGameModal.jsx with Tournament mode (8-100 players, advancementRule 1-4)
- Netlify Function endpoints: createTournament, inviteTournament, getTournamentStatus
- Tournament Channel metadata schema (`t.{tournamentId}`)
- Tournament membership schema (reuse v3 invitation)
- TournamentLobby.jsx (list tournaments, join, view)
- TournamentSetup.jsx (host view, invite players, participant list)

### Phase 2: Tournament Summary Page
- TournamentSummary.jsx (live-updating bracket display)
- Subscribe to `admin.t.{tournamentId}` for round updates
- Display current round games and results
- Show player statuses (ACTIVE, ELIMINATED, FINISHED)
- Display seed assignments (1st seed, 2nd seed, 3rd seed, 4th wildcard)
- Redirect eliminated players to this page

### Phase 3: Round Management
- startTournament operation (validate 8+ players, create Round 1 games, distribute players)
- Bracket distribution algorithm (4-10 players per game)
- advanceRound operation (collect top N finishers, update eliminations, create next round)
- Round completion detection (PubNub Function trigger + polling)

### Phase 4: Game Coordination
- Synchronized countdown (ROUND_STARTING → COUNTDOWN → GAME_START)
- Verify PubNub Before Publish Function handles `game.t.*` channels
- TournamentGame.jsx (extends v3 Game.jsx with tournament context)
- Handle game completion → check for round completion → trigger advanceRound

### Phase 5: Edge Cases & Polish
- Minimum 8 players validation (create + start)
- Disconnection handling (presence timeout → elimination → redirect to summary)
- Tournament cancellation (CREATED phase only)
- Odd player distributions (balanced bracket algorithm)
- Tie handling (moveCount, finishTT tiebreakers)
- Seed terminology in UI (1st seed, 2nd seed, 3rd seed, 4th wildcard)
- Tournament history in player profiles

---

## Critical Files for Implementation

### New Files (Create)
- `/Users/craig/Documents/gits/firstorder/netlify/functions/tournament.js` - Core tournament API (6 operations)
- `/Users/craig/Documents/gits/firstorder/netlify/functions/lib/tournamentUtils.js` - Bracket algorithms, seed utilities
- `/Users/craig/Documents/gits/firstorder/client/src/components/TournamentLobby.jsx` - Tournament list/join UI
- `/Users/craig/Documents/gits/firstorder/client/src/components/TournamentSetup.jsx` - Host setup, invite players
- `/Users/craig/Documents/gits/firstorder/client/src/components/TournamentSummary.jsx` - Live bracket display, results
- `/Users/craig/Documents/gits/firstorder/client/src/components/TournamentGame.jsx` - Extends Game.jsx with tournament context
- `/Users/craig/Documents/gits/firstorder/client/src/utils/tournamentApi.js` - Client-side tournament API helpers
- `/Users/craig/Documents/gits/firstorder/APP_CONTEXT_SCHEMA_V3.md` - Document current v3 schema
- `/Users/craig/Documents/gits/firstorder/APP_CONTEXT_SCHEMA_V4.md` - Document v4 tournament schema

### Modified Files
- `/Users/craig/Documents/gits/firstorder/server/before-publish-function.js` - Verify `game.t.*` channel handling
- `/Users/craig/Documents/gits/firstorder/client/src/App.jsx` - Add tournament routes
- `/Users/craig/Documents/gits/firstorder/client/src/components/CreateGameModal.jsx` - Add Tournament mode (8-100 players, advancementRule 1-4)
- `/Users/craig/Documents/gits/firstorder/client/src/components/Lobby.jsx` - Add tournament navigation
- `/Users/craig/Documents/gits/firstorder/client/src/utils/gameApi.js` - Update listGames filter: `id NOT LIKE 'game.t.*'`
- `/Users/craig/Documents/gits/firstorder/client/src/version.js` - Bump to 4.0.0

---

## Scalability (8-100 Players, Multiple Rounds)

### App Context Capacity
- Channel metadata: ~100k channels (sufficient)
- User metadata: ~100k users (sufficient)
- Memberships: ~1M total (sufficient for 100 tournaments × 100 players × 10 rounds)

### Message Throughput
Peak load: 100 players, 10 games, simultaneous start
- ~2,050 messages over ~5 minutes = ~7 msg/sec (well within limits)

Minimum load: 8 players, 1-2 games
- Minimal overhead, same architecture scales down efficiently

### Performance Considerations
- Use server-side filters for queries (e.g., `id LIKE 'game.t.X-r01-*'`)
- Paginate membership queries (100 items/page)
- Hybrid round completion detection (PubNub Function trigger + client polling)
- Break large operations into sub-tasks (avoid 10s timeout)
- Tournament summary page: Subscribe once to `admin.t.{tournamentId}`, receive push updates

---

## Testing Strategy

### Unit Tests
- calculateBracketDistribution() with 8, 17, 32, 100 players
- calculateNextRoundPlayers() with advancementRule = 1, 2, 3, 4
- getSeedName() function (1st seed, 2nd seed, 3rd seed, 4th wildcard)
- Tiebreaker logic (moveCount, finishTT)
- Minimum player validation (reject < 8 players)

### Integration Tests
- Full tournament flow: Create → Invite → Start → Advance → End
- Minimum 8 players validation (create and start)
- Disconnection during Round 2 → redirect to summary
- Tournament cancellation (CREATED phase)
- Championship round (exactly 4 players)
- Seed advancement (1-4 players advance per game)

### Load Tests
- 100 players, 10 games, simultaneous start
- Countdown synchronization across all games
- Netlify Function execution time < 10s
- Tournament summary page real-time updates

---

## Create Tournament Screen (CreateGameModal Extension)

### New Tournament-Specific Fields

**Player Mode**: Radio button selection
- Regular Game (existing behavior)
- **Tournament** (new)

**When Tournament is selected**, show additional fields:

1. **Max Players** (number input)
   - Range: 8-100 players
   - Default: 16
   - Helper text: "Minimum 8 players required"

2. **Advancement Rule** (dropdown or radio)
   - Options:
     - Top 1 advance (1st seed only)
     - Top 2 advance (1st seed, 2nd seed)
     - Top 3 advance (1st seed, 2nd seed, 3rd seed)
     - Top 4 advance (1st seed, 2nd seed, 3rd seed, 4th wildcard)
   - Default: Top 2 advance
   - Helper text: "How many players advance from each game per round"

3. **Existing fields** (same as regular games):
   - Game Name
   - Tile Count (4-8)
   - Emoji Theme
   - Tile Pinning Enabled
   - Verified Positions Enabled
   - Invite Only (use for inviting tournament participants)

### Validation
- If Tournament mode: maxPlayers must be 8-100
- If Tournament mode: advancementRule must be 1-4
- If Tournament mode and Invite Only: must invite at least 8 players before starting

---

## Next Steps

1. **Document v3 Schema**: Write APP_CONTEXT_SCHEMA_V3.md
2. **Document v4 Schema**: Write APP_CONTEXT_SCHEMA_V4.md
3. **User Approval**: Review plan and schema docs
4. **Begin Phase 1**: Core tournament infrastructure
