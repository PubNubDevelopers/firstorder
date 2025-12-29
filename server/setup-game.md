# Game Setup Guide

This guide explains how to initialize game state in PubNub KV Store for testing.

## Option 1: Using PubNub Admin Portal

1. Go to your PubNub Admin Portal: https://dashboard.pubnub.com
2. Navigate to your app and keyset
3. Click on "Functions" in the left sidebar
4. Find your deployed function module
5. Click on "KV Store" tab
6. Add a new key-value pair:

**Key:** `swapit:game:TESTGAME`

**Value:**
```json
{
  "gameId": "TESTGAME",
  "phase": "CREATED",
  "players": ["player1", "player2"],
  "winnerPlayerId": null,
  "tiles": {},
  "goalOrder": null,
  "initialOrder": null,
  "startTT": null,
  "winTT": null,
  "lockedTT": null
}
```

## Option 2: Using PubNub Functions to Initialize

Create a separate "On Request" function handler to initialize games:

```javascript
export default (request) => {
  const db = require('kvstore');
  const { gameId, players } = request.params;

  if (!gameId || !players) {
    return request.ok({
      status: 400,
      body: { error: 'Missing gameId or players' }
    });
  }

  const gameKey = `swapit:game:${gameId}`;
  const gameState = {
    gameId: gameId,
    phase: 'CREATED',
    players: players.split(','),
    winnerPlayerId: null,
    tiles: {},
    goalOrder: null,
    initialOrder: null,
    startTT: null,
    winTT: null,
    lockedTT: null
  };

  return db.set(gameKey, gameState).then(() => {
    return request.ok({
      body: {
        success: true,
        gameId: gameId,
        message: 'Game initialized successfully'
      }
    });
  }).catch((error) => {
    return request.ok({
      status: 500,
      body: { error: error.message }
    });
  });
};
```

Then call it via HTTP:
```bash
curl "https://ps.pndsn.com/v1/blocks/sub-key/YOUR_SUB_KEY/init-game?gameId=TESTGAME&players=player1,player2"
```

## Option 3: Initialize from Client App

You can add a function to your React app to initialize games. Add this to your App.jsx:

```javascript
// Add this function to initialize a game
const initializeGame = async (gameId, playerIds) => {
  // This would require a REST API endpoint or an On Request function
  // For MVP, manually initialize games via admin portal
};
```

## Testing Your Setup

1. Initialize a game with ID "TESTGAME" and 2 players
2. Open two browser windows
3. In window 1: Join game with ID "TESTGAME" as "Player 1"
4. In window 2: Join game with ID "TESTGAME" as "Player 2"
5. In window 1 (or 2): Click "Start Game"
6. Both windows should see the game start with tiles
7. Make moves in either window
8. First to get all 4 correct wins

## Common Issues

### "Game not found" error
- Verify the game exists in KV Store
- Check that the key format is exactly: `swapit:game:{gameId}`
- Ensure the gameId matches what you're trying to join

### "Player not in roster" error
- Check that your player ID is in the game's `players` array
- Note: The client generates random player IDs, so for testing you may need to:
  - Use the same browser/device
  - Or manually set player IDs in the game state to match what clients will use

### Game won't start
- Verify `phase` is set to `"CREATED"`
- Check that at least one player ID in roster matches the client's player ID
- Look at Functions logs for errors

## Recommended Test Flow

For easiest testing:

1. Create game state with phase "CREATED"
2. Use a simple known player list: `["player1", "player2"]`
3. Modify the client code to use these fixed player IDs instead of random ones
4. Test the full flow
5. Once working, switch back to random player IDs

Example modification to client/src/App.jsx:
```javascript
// For testing only - use fixed player IDs
const testPlayerIds = {
  'player1': 'Player One',
  'player2': 'Player Two'
};

// In handleJoinGame, replace:
const playerId = generatePlayerId();

// With:
const playerId = 'player1'; // or 'player2' for second player
```
