# Changelog

All notable changes to First Order will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  status: "CREATED" | "LIVE" | "OVER",
  custom: {
    gameId, gameName, tileCount, emojiTheme, maxPlayers,
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
