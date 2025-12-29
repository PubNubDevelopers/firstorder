# Swap It! Local Server

This directory contains both the PubNub Functions code and a local development server.

## 🚀 Quick Start - Local Development

Run the local server for testing:

```bash
cd server
npm start
```

The server will start on `http://localhost:3001` and:
- ✅ Handle all game operations (create, join, start, get_game)
- ✅ Listen for player moves on PubNub channels
- ✅ Publish game events back to PubNub
- ✅ Store game state locally (using node-persist)

## 📁 Files

- `local-server.js` - Local Express server for development/testing
- `on-request-function.js` - PubNub On Request Function (production)
- `before-publish-function.js` - PubNub Before Publish Function (production)
- `package.json` - Dependencies

## 🧪 Testing Locally

1. **Start the local server:**
   ```bash
   cd server
   npm start
   ```

2. **Start the client** (in a new terminal):
   ```bash
   cd ../client
   npm run dev
   ```

3. **Open multiple browser windows:**
   - Window 1: Create a game
   - Window 2: Join the game with the game ID
   - Test multiplayer gameplay!

The local server automatically:
- Stores game state in `.node-persist/storage/` (gitignored)
- Publishes events to PubNub channels
- Subscribes to `game.*` channels for move submissions

## 🌐 Deploying to Production

See [../DEPLOYMENT.md](../DEPLOYMENT.md) for instructions on deploying the functions to PubNub's serverless platform.

## 🔑 Environment Variables

The local server reads from your system environment or uses defaults:

```bash
PUBNUB_PUBLISH_KEY=pub-c-66ab3e60-11b7-4792-a753-92b7e510a21e
PUBNUB_SUBSCRIBE_KEY=sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe
```

## 📡 API Endpoints

### POST `/game_master?operation=create_game`
Create a new game
```json
{
  "playerId": "player-123"
}
```

### POST `/game_master?operation=join_game`
Join an existing game
```json
{
  "gameId": "ABC12345",
  "playerId": "player-456"
}
```

### POST `/game_master?operation=start_game`
Start the game
```json
{
  "gameId": "ABC12345",
  "playerId": "player-123"
}
```

### POST `/game_master?operation=get_game`
Get current game state
```json
{
  "gameId": "ABC12345"
}
```

## 📦 Storage

Local game data is stored in `.node-persist/storage/` directory. To reset:

```bash
rm -rf .node-persist
```

## 🐛 Debugging

The server logs all operations:
- 📥 Incoming requests
- ✅ Successful operations
- ❌ Errors
- 🏆 Game events (joins, moves, wins)

Watch the server logs while testing to see what's happening!
