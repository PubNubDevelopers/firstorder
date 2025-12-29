# Swap It! - Multiplayer Tile Swapping Game

A real-time multiplayer game built with React and PubNub where players race to arrange tiles in the correct order.

## Game Overview

Swap It! is a competitive puzzle game where:
- 2+ players compete simultaneously
- Each player arranges 4 emoji tiles by swapping positions
- First player to match the hidden goal order wins
- Real-time synchronization across all players
- No cheating - goal order only revealed when game ends

## Architecture

### Frontend (React + Vite)
- **React Components**: Lobby, Game, PlayerBoard, Tile, GameOverModal
- **PubNub Integration**: Real-time pub/sub for game state
- **State Management**: React hooks for local game state

### Backend (PubNub Functions)
- **Before Publish Function**: Server-side game logic bound to `game.*` channels
- **KV Store**: Persistent game state and player data
- **Message Validation**: Server-side move validation and win detection

## Channel Architecture

### `game.[gameId]`
**Published by clients:**
- `START_GAME`: Initialize game and transition to LIVE state
- `MOVE_SUBMIT`: Submit tile arrangement

**Published by Functions:**
- `PROGRESS_UPDATE`: Broadcast move results to all players

### `admin.[gameId]`
**Published by Functions only:**
- `GAME_START`: Game initialized with tiles and starting positions
- `GAME_OVER`: Game complete with winner and goal order revealed

## Setup Instructions

### 1. Prerequisites
- Node.js 18+ installed
- PubNub account (free at https://dashboard.pubnub.com)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure PubNub

#### Option A: Using PubNub MCP (Recommended)
The PubNub MCP server can automatically configure your keyset and functions.

Set your PubNub API credentials:
```bash
export PUBNUB_API_KEY="your-api-key"
```

Then create a keyset with the required configuration:
- Message Persistence enabled
- App Context (Objects) enabled
- KV Store enabled

#### Option B: Manual Configuration

1. **Create a PubNub App and Keyset**
   - Go to https://dashboard.pubnub.com
   - Create a new app
   - Create a new keyset with these features enabled:
     - Message Persistence (1+ day retention)
     - App Context / Objects
     - Functions & KV Store

2. **Deploy the Before Publish Function**
   - Navigate to Functions in your PubNub dashboard
   - Create a new module
   - Add a "Before Publish or Fire" event handler
   - Set channel pattern: `game.*`
   - Copy the code from `server/before-publish-function.js`
   - Enable KV store for the function
   - Deploy the function

3. **Create Environment Variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your PubNub keys:
   ```
   VITE_PUBNUB_PUBLISH_KEY=your_publish_key
   VITE_PUBNUB_SUBSCRIBE_KEY=your_subscribe_key
   ```

### 4. Initialize Game State in KV Store

Before players can join, create the game state in PubNub KV Store:

```javascript
// Game state structure
{
  "gameId": "A7K2Q9XJ",
  "phase": "CREATED",
  "players": ["player1", "player2"],
  "winnerPlayerId": null,
  "tiles": {},
  "goalOrder": null,
  "initialOrder": null,
  "startTT": null,
  "winTT": null
}
```

Key format: `swapit:game:{gameId}`

### 5. Run the Application

Development mode with hot reload:
```bash
npm run dev
```

Build for production:
```bash
npm run build
npm run preview
```

The app will be available at http://localhost:3000

## How to Play

1. **Create a Game**
   - Enter your name
   - Click "Create New Game"
   - Share the 8-character Game ID with other players

2. **Join a Game**
   - Enter your name
   - Enter the Game ID shared by the host
   - Click "Join Existing Game"

3. **Start the Game**
   - Host clicks "Start Game" when ready
   - All players see the same initial tile arrangement
   - Goal: Arrange tiles to match the hidden goal order

4. **Make Moves**
   - Click one tile, then click another to swap them
   - Click the same tile twice to unselect
   - Each move is validated by the server
   - See your progress with colored dots (green = all 4 correct, red = 0 correct)

5. **Win the Game**
   - First player to get all 4 positions correct wins
   - Game locks immediately upon win
   - Goal order is revealed to all players

## Message Schemas

### START_GAME (Client → Server)
```json
{
  "v": 1,
  "type": "START_GAME",
  "gameId": "A7K2Q9XJ",
  "playerId": "player_xyz",
  "ts": 1766512345678
}
```

### MOVE_SUBMIT (Client → Server)
```json
{
  "v": 1,
  "type": "MOVE_SUBMIT",
  "gameId": "A7K2Q9XJ",
  "playerId": "player_xyz",
  "order": { "a": 1, "b": 3, "c": 2, "d": 0 },
  "ts": 1766512345678
}
```

### PROGRESS_UPDATE (Server → Clients)
```json
{
  "v": 1,
  "type": "PROGRESS_UPDATE",
  "gameId": "A7K2Q9XJ",
  "playerId": "player_xyz",
  "moveCount": 8,
  "positionsCorrect": 3,
  "moveTT": "17665123456799999"
}
```

### GAME_START (Server → Clients)
```json
{
  "v": 1,
  "type": "GAME_START",
  "gameId": "A7K2Q9XJ",
  "phase": "LIVE",
  "tiles": {
    "0": "🍕",
    "1": "🚀",
    "2": "🐶",
    "3": "🎸"
  },
  "initialOrder": { "a": 2, "b": 0, "c": 3, "d": 1 },
  "startTT": "17665123456789012"
}
```

### GAME_OVER (Server → Clients)
```json
{
  "v": 1,
  "type": "GAME_OVER",
  "gameId": "A7K2Q9XJ",
  "phase": "LOCKED",
  "winnerPlayerId": "player_xyz",
  "goalOrder": { "a": 0, "b": 1, "c": 2, "d": 3 },
  "winTT": "17665123456800001"
}
```

## Game State Machine

### States
- **CREATED**: Game exists, waiting for start
- **LIVE**: Game in progress, accepting moves
- **LOCKED**: Game over, moves ignored

### Transitions
- `CREATED → LIVE`: When any player publishes START_GAME
- `LIVE → LOCKED`: When a player achieves 4 positions correct

## Project Structure

```
swapit/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Game.jsx          # Main game component
│   │   │   ├── GameOverModal.jsx # End game modal
│   │   │   ├── Lobby.jsx         # Game lobby
│   │   │   ├── PlayerBoard.jsx   # Player board component
│   │   │   └── Tile.jsx          # Individual tile component
│   │   ├── hooks/
│   │   │   └── usePubNub.js      # PubNub connection hook
│   │   ├── utils/
│   │   │   └── gameUtils.js      # Game utility functions
│   │   ├── App.jsx               # Root component
│   │   ├── main.jsx              # Entry point
│   │   └── index.css             # Global styles
│   └── index.html                # HTML template
├── server/
│   └── before-publish-function.js # PubNub Function for game logic
├── .env.example                   # Environment variables template
├── package.json                   # Dependencies
├── vite.config.js                # Vite configuration
└── README.md                      # This file
```

## Key Features

- **Real-time Multiplayer**: PubNub ensures all players see updates instantly
- **Server Authority**: All game logic runs server-side to prevent cheating
- **Optimistic Updates**: Local state updates immediately for responsive UX
- **Goal Secrecy**: Goal order never sent to clients until game ends
- **Fair Winner Detection**: PubNub timetokens ensure deterministic ordering
- **Move Validation**: Server validates all moves before accepting
- **No Late Joins**: Roster locked at game start

## Troubleshooting

### Game won't start
- Ensure the game state exists in KV Store with `phase: "CREATED"`
- Verify player IDs are in the game's `players` array
- Check browser console for errors

### Moves not registering
- Verify Before Publish function is deployed and running
- Check Functions logs in PubNub dashboard
- Ensure game is in LIVE state

### Connection issues
- Verify publish and subscribe keys are correct
- Check browser console for PubNub connection errors
- Ensure you have network connectivity

## License

MIT

## Author

Craig Conover <craig@pubnub.com>
