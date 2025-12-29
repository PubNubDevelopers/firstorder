# Swap It! - Data Schemas

## KV Store Schema

### Game State Key: `swapit:game:${gameId}`

```javascript
{
  // Game metadata
  gameId: string,              // 8-char alphanumeric (e.g., "A7K2Q9XJ")
  phase: string,               // "CREATED" | "LIVE" | "LOCKED"

  // Player roster
  playerIds: string[],         // Array of player IDs
  players: {                   // Object mapping playerId -> player state
    [playerId]: {
      playerId: string,
      moveCount: number,
      currentOrder: object | null,      // {a: 0-3, b: 0-3, c: 0-3, d: 0-3}
      correctnessHistory: number[],     // Array of positionsCorrect values
      positionsCorrect: number,         // 0-4
      finished: boolean,
      finishTT: string | null          // Timetoken when player finished
    }
  },

  // Game configuration (set during START_GAME)
  tiles: object | null,        // {0: "🍕", 1: "🚀", 2: "🐶", 3: "🎸"}
  goalOrder: object | null,    // {a: 0-3, b: 0-3, c: 0-3, d: 0-3} - HIDDEN
  initialOrder: object | null, // {a: 0-3, b: 0-3, c: 0-3, d: 0-3}

  // Game lifecycle timestamps
  createdAt: number,           // Unix timestamp
  startTT: string | null,      // Timetoken when game started
  winnerPlayerId: string | null,
  winTT: string | null,        // Timetoken when winner finished
  lockedTT: string | null      // Timetoken when game locked
}
```

## Channel Naming Conventions

### Input Channel: `game.${gameId}`
- **Publishers**: Player clients
- **Subscribers**: Optional (for PROGRESS_UPDATE messages)
- **Processor**: Before Publish Function

#### Messages Published TO this channel:
1. **START_GAME** (client → function)
2. **MOVE_SUBMIT** (client → function)
3. **PROGRESS_UPDATE** (function → clients) - Published by Before Publish Function

### Admin Channel: `admin.${gameId}`
- **Publishers**: Before Publish Function only
- **Subscribers**: All player clients (required)

#### Messages Published TO this channel:
1. **GAME_START** (function → clients)
2. **GAME_OVER** (function → clients)

## Message Schemas

### Channel: game.${gameId}

#### START_GAME (client → function)
```javascript
{
  v: 1,
  type: "START_GAME",
  gameId: string,
  playerId: string,
  ts: number
}
```

#### MOVE_SUBMIT (client → function)
```javascript
{
  v: 1,
  type: "MOVE_SUBMIT",
  gameId: string,
  playerId: string,
  order: { a: number, b: number, c: number, d: number },
  clientMoveSeq: number,
  ts: number
}
```

#### PROGRESS_UPDATE (function → game channel)
```javascript
{
  v: 1,
  type: "PROGRESS_UPDATE",
  gameId: string,
  playerId: string,
  moveCount: number,
  positionsCorrect: number,
  moveTT: string
}
```

### Channel: admin.${gameId}

#### GAME_START
```javascript
{
  v: 1,
  type: "GAME_START",
  gameId: string,
  phase: "LIVE",
  tiles: { 0: string, 1: string, 2: string, 3: string },
  initialOrder: { a: number, b: number, c: number, d: number },
  startTT: string
}
```

#### GAME_OVER
```javascript
{
  v: 1,
  type: "GAME_OVER",
  gameId: string,
  phase: "LOCKED",
  winnerPlayerId: string,
  goalOrder: { a: number, b: number, c: number, d: number },
  winTT: string
}
```

## HTTP API Endpoints (On Request Function)

### POST /create-game
**Request:**
```javascript
{
  gameId: string,    // 8-char alphanumeric
  playerId: string
}
```

**Response (200):**
```javascript
{
  success: true,
  gameId: string,
  phase: "CREATED",
  players: string[]
}
```

### POST /join-game
**Request:**
```javascript
{
  gameId: string,
  playerId: string
}
```

**Response (200):**
```javascript
{
  success: true,
  gameId: string,
  phase: "CREATED",
  players: string[]
}
```
