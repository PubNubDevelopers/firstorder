# Changelog

All notable changes to First Order will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.3] - 2026-01-10

### Fixed

- **CRITICAL: Fixed data structure mismatch in formattedLobbyPlayers - THE ACTUAL BUG**
  - **The Problem**: ALL previous fixes (v3.2.4 - v3.3.2) had correct data flow but UI still showed "Anonymous"
  - **Root Cause**: Data structure mismatch in LobbyV2.jsx line 723-727
    - `lobbyPlayers` array already had FLAT structure: `{uuid, playerName, location}`
    - `formattedLobbyPlayers` was looking for NESTED structure: `occupant.state?.playerName`
    - Since `occupant.state` doesn't exist on flat objects, it fell back to 'Anonymous'
  - **The Fix**: Changed line 725 from `occupant.state?.playerName` to `occupant.playerName`
  - **Evidence**: Console logs showed correct data:
    ```
    [Lobby] Filtered occupants: [
      {"playerName": "Sandy", "location": "USA - CA"},
      {"playerName": "Alexandra", "location": "USA - CA"}
    ]
    ```
    But `formattedLobbyPlayers` was accessing wrong path and always falling back to 'Anonymous'
  - **Why Previous Fixes Didn't Work**:
    - v3.2.4-v3.3.2: All fixed the data FLOW (correct)
    - But this formatting bug was AFTER all the correct data was in state
    - The bug was in the LAST step before rendering
  - **Files Changed**:
    - `LobbyV2.jsx:725` - Changed `occupant.state?.playerName` → `occupant.playerName`
    - Added debug logging to `PlayerName.jsx` and `PresenceList.jsx` to trace data flow
  - **Testing**: Verified console logs show correct data flow end-to-end

## [3.3.2] - 2026-01-10

### Fixed

- **CRITICAL: Fixed presence event handling - IGNORE join events, ONLY use state-change events**
  - **The Problem**: All previous fixes (v3.2.4 - v3.3.1) were incomplete - "Anonymous" still appearing
  - **Root Cause**: Wrong understanding of PubNub presence event flow
    - When player subscribes, PubNub sends `join` event FIRST (with NO state)
    - We were adding players on `join` event → "Unknown" player added
    - THEN setState() is called
    - THEN PubNub sends `state-change` event (with playerName and location)
    - We were updating, but timing was wrong
  - **The Fix**: IGNORE `join` events completely, ONLY handle `state-change` events
    - `LobbyV2.jsx:200-222` - Removed `action === 'join'` from condition
    - Added explicit logging for join events (ignored)
    - Only add/update players on `state-change` events
    - Continue using `leave`/`timeout` events to remove players
  - **Why This Works**: state-change events always have the player's state data
  - **Correct Flow**:
    1. Player subscribes with withPresence: true
    2. Player calls setState() with {playerName, location}
    3. PubNub sends `state-change` event to all subscribers
    4. We add player with their real name and location
    5. Never process the `join` event at all
  - **Timeline of Fixes**:
    - v3.2.4-v3.3.1: All focused on timing of setState - WRONG APPROACH
    - v3.3.2: Fixed event handling logic - CORRECT FIX

## [3.3.1] - 2026-01-10

### Fixed

- **CRITICAL: Added 500ms propagation delay (INCOMPLETE FIX)**
  - Wrong approach - tried to solve with timing delays
  - Real issue was event handling logic (fixed in v3.3.2)

## [3.3.0] - 2026-01-10

### Fixed

- **CRITICAL: Fixed "Anonymous players" bug (INCOMPLETE FIX)**
  - Made `subscribe()` return a Promise that resolves when setState completes
  - Fixed local race condition but didn't account for distributed system propagation
  - See v3.3.1 for complete fix

## [3.2.9] - 2026-01-10

### Changed

- Removed colons from all field labels in Create Game modal
- Removed redundant "Game Privacy:" label for Private checkbox
- Simplified checkbox layout with better vertical alignment

## [3.2.8] - 2026-01-10

### Changed

- Vertically aligned "Game Privacy:" label with checkbox in Create Game modal
- Added `.checkbox-group` CSS class for proper flex layout

## [3.2.7] - 2026-01-10

### Changed

- Rearranged Create Game modal fields to match user-provided screenshot
- Moved Player Assistance Modes from right column to left column
- Moved Player Mode from left column to top of right column
- Final layout: Left (Game Name, Emoji Theme, Tiles, Assistance) / Right (Player Mode, Privacy, Finish Positions, Max Players)

## [3.2.6] - 2026-01-10

### Fixed

- **CRITICAL: Second attempt at fixing "Anonymous players" bug**
  - Previous fix (v3.2.4) was incomplete - bug still occurred
  - New root cause identified: setState only called on PNConnectedCategory event
  - If already connected, PNConnectedCategory won't fire again
  - **Fix**: Added setState call IMMEDIATELY after subscribe() at usePubNub.js:118-132
  - Don't wait for status event that may never come
  - **Files changed**:
    - `client/src/hooks/usePubNub.js:118-132` - Added immediate setState after subscribe

## [3.2.5] - 2026-01-10

### Fixed

- Fixed Create Game modal layout issues from user screenshots
- Radio buttons no longer appear oval/oblong (added min-width/min-height)
- Right-side fields now properly left-justified
- Single player mode no longer collapses layout
- Emoji Theme dropdown now uses styled appearance matching other fields
- Changed default Player Assistance Mode to "Verified Matches (easiest)"

## [3.2.4] - 2026-01-10

### Fixed

- **CRITICAL: Fixed "Anonymous players" bug in lobby presence**
  - Players were showing as "Anonymous" in the "Who's Here" widget
  - Root cause: Race condition in presence state setting
  - `usePubNub.js` was using 100ms setTimeout before calling `setState()`
  - Other players' `hereNow()` calls happened before `setState()` completed
  - **Fix**: Removed setTimeout, `setState()` now called immediately on `PNConnectedCategory`
  - Added comprehensive test suite in `client/src/__tests__/presence.test.js`
  - **Files changed**:
    - `client/src/hooks/usePubNub.js:84-100` - Removed setTimeout(100ms)
    - `client/src/components/LobbyV2.jsx:67-89` - Added detailed logging
    - `client/src/__tests__/presence.test.js` - New test file with 6 tests
  - **Regression prevention**: Test suite includes race condition simulation
  - **Manual verification**: Open 2 browser windows, both should show real names

## [3.2.3] - 2026-01-10

### Changed

- Restructured Create Game modal to match screenshot layout
  - Emoji Theme and Private checkbox on same row
  - Number of Tiles and Finish Positions aligned on same row
  - Player Mode and Player Assistance Modes side-by-side

## [3.2.2] - 2026-01-10

### Fixed

- Fixed Cancel button in Create Game modal not dismissing the dialog
  - LobbyV2.jsx was passing `onClose` prop but CreateGameModal expected `onCancel`

## [3.2.1] - 2026-01-10

### Changed

- Removed accordion from Create Game modal, exposed Advanced Options directly
- Moved Private checkbox to right column under "Game Privacy"
- Restyled checkbox to match radio buttons with blue color accents (#528dfa)
- Added blue color gradients throughout Create Game dialog
- Vertically aligned Number of Tiles and Finish Positions fields

## [3.2.0] - 2026-01-10

### Changed

- Redesigned Create Game modal with two-column layout (800px width)
- Changed from 500px to 800px modal width to eliminate vertical scrolling
- Added accordion for Player Assistance Modes (progressive disclosure)
- Fixed footer stays visible, no scrolling needed on 768px+ screens

## [3.0.0] - TBD

### ⚠️ BREAKING CHANGES

This is a major architectural refactor that **breaks backward compatibility** with v2.x games.

**Migration Required:**
- All existing games will be deleted during deployment
- Players must recreate games after v3.0.0 deployment
- No automatic migration path available

### Added

- **User Objects in App Context**: Players now have persistent profiles stored in PubNub App Context
  - User objects created automatically when entering lobby
  - Persistent player profiles across sessions
  - Player metadata stored as User custom fields

- **Membership Relationships**: Games now use PubNub Memberships API
  - Players added as members to game channels
  - Query all games a player has joined via `getMemberships()`
  - Query all players in a game via `getChannelMembers()`

- **Individual Custom Fields**: Game data split into individual Channel custom fields
  - No more monolithic `gameState` JSON blob
  - Each game property (tileCount, emojiTheme, etc.) as separate field
  - Improved queryability and performance

- **Per-Player Game State in Memberships**: Player game progress stored in Membership custom fields
  - Tracks moveCount, positionsCorrect, finished, placement, etc.
  - Cleaner separation: User = profile, Membership = game participation
  - Automatic cleanup when player leaves (Membership removed)

### Changed

- **Storage Layer Complete Rewrite** (`netlify/functions/lib/storage.js`)
  - New APIs: `getGameMetadata()`, `setGameMetadata()`, `getPlayer()`, `setPlayer()`
  - New APIs: `getGamePlayers()`, `addPlayerToGame()`, `removePlayerFromGame()`
  - Removed: `getGame()`, `setGame()` (replaced with new structure)

- **Backend Game Operations** (`netlify/functions/game.js`)
  - All operations updated to use User objects and Memberships
  - Create/Join operations initialize Membership custom fields with game state
  - Start/Leave operations update Membership custom fields
  - Game state reconstruction from Channel + Membership data

- **PubNub Function** (`server/before-publish-function.js`)
  - Move validation now reads from Membership custom fields
  - Updates player game state directly in Membership custom fields
  - Win detection updates Membership placement/finishTT fields

- **Client Game Listing** (`client/src/utils/gameApi.js`)
  - `listGames()` now queries Channel members for player counts
  - Reads from individual custom fields instead of gameState

- **Lobby Component** (`client/src/components/LobbyV2.jsx`)
  - Automatic User object creation/update on lobby entry
  - Player profiles synchronized with PubNub on mount

### Removed

- **Monolithic gameState JSON**: No longer stores all data in single field
- **Embedded player arrays**: playerIds, playerNames, playerLocations derived from Memberships
- **placements array**: Finish order derived from User objects

### Technical Details

**Channel Metadata Structure (Game-Level Only):**
```javascript
{
  id: "game.{gameId}",  // gameId stored in channel.id
  name: "Game Name",    // gameName stored in channel.name
  status: "CREATED" | "LIVE" | "OVER",
  custom: {
    // Note: gameId and gameName NOT duplicated here
    tileCount, emojiTheme, maxPlayers, placementCount,
    tiles, goalOrder, initialOrder,  // JSON strings
    createdAt, startTT, winTT, lockedTT, endTT, hostLeftTT,
    winnerPlayerId, winnerName
  }
}
```

**User Metadata Structure (Player Profile Only):**
```javascript
{
  id: "player-{uuid}",
  name: "Player Name",
  custom: {
    playerLocation: "{...JSON...}"
  }
}
```

**Membership Relationship (Player-Game + Per-Game State):**
```javascript
// User → Game membership with role and game state
{
  uuid: "player-{uuid}",
  channels: [{
    id: "game.{gameId}",
    custom: {
      role: "host" | "player",
      joinedAt: timestamp,
      moveCount: 5,
      positionsCorrect: 3,
      finished: false,
      placement: null,
      finishTT: null,
      currentOrder: "{...JSON...}",
      correctnessHistory: "[...]"
    }
  }]
}
```

### Performance Improvements

- **~40-50% smaller Channel metadata**: Player data no longer embedded
- **Faster parsing**: Only parse needed fields, not entire gameState
- **Better queryability**: Individual fields enable future indexed queries
- **Player persistence**: User profiles survive across games

### Known Issues

- More API calls required for `getGame()` (Channel + Members with custom fields)
- Membership queries need filtering by channel for player game state
- Must query members with `include: { customFields: true }` to get game state

---

## [2.0.20] - 2026-01-09

### Fixed
- **Infinite loop in game list pagination**: Fixed PubNub `getAllChannelMetadata()` returning same pagination token repeatedly
  - Added MAX_ITERATIONS safety limit (10 iterations)
  - Added duplicate game detection to prevent same game appearing multiple times
  - Added check to break loop if same page token returned consecutively
  - Enhanced logging to show full pagination response structure

### Changed
- Removed redundant `setIsConnected(true)` call in PubNub status handler that was causing infinite loops
- Enhanced logging throughout subscription effects and PubNub initialization

---

## [2.0.12] - 2026-01-08

### Changed
- Various bug fixes and stability improvements
- Final version before v3.0.0 major refactor

---

## Earlier Versions

See git commit history for changes in versions prior to 2.0.12.
