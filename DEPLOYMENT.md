# Swap It! - PubNub Functions Deployment Guide

This guide walks you through deploying the PubNub Functions for the Swap It game.

## Prerequisites

1. PubNub Account with:
   - Publish Key: `pub-c-66ab3e60-11b7-4792-a753-92b7e510a21e`
   - Subscribe Key: `sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe`
2. Access to PubNub Admin Portal

## Function 1: On Request Function (game_master)

### Purpose
HTTP endpoint for game management operations (create, join, start).

### Deployment Steps

1. Go to [PubNub Admin Portal](https://admin.pubnub.com/)
2. Select your application
3. Select your keyset (the one with subscribe key `sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe`)
4. Navigate to **Functions** in the left sidebar
5. Click **Create New Module** (or use existing module)
6. Click **Create Function** → Select **On Request**
7. Configure the function:
   - **Function Name**: `game_master`
   - **Path**: `game_master` (this will create the endpoint `/v1/blocks/sub-key/YOUR-SUB-KEY/game_master`)
   - **Event Type**: On Request
   - **Enable KV Store**: ✅ **IMPORTANT - Must be checked!**

8. Copy the entire contents of `server/on-request-function.js` into the code editor
9. Click **Save**
10. Click **Start Module** to activate the function

### Expected Endpoint

After deployment, your endpoint will be:
```
https://ps.pndsn.com/v1/blocks/sub-key/sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe/game_master
```

### Test the Function

Test with curl:
```bash
curl -X POST "https://ps.pndsn.com/v1/blocks/sub-key/sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe/game_master?operation=create_game" \
  -H "Content-Type: application/json" \
  -d '{"playerId":"test-player-001"}'
```

Expected response:
```json
{
  "success": true,
  "gameId": "ABC12345",
  "phase": "CREATED",
  "players": ["test-player-001"]
}
```

## Function 2: Before Publish Function

### Purpose
Handles game moves during play and validates them in real-time.

### Deployment Steps

1. In the same Functions module (or create a new one)
2. Click **Create Function** → Select **Before Publish or Fire**
3. Configure the function:
   - **Function Name**: `game_move_handler` (or any name you prefer)
   - **Event Type**: Before Publish or Fire
   - **Channel Pattern**: `game.*` (matches all channels starting with "game.")
   - **Enable KV Store**: ✅ **IMPORTANT - Must be checked!**

4. Copy the entire contents of `server/before-publish-function.js` into the code editor
5. Click **Save**
6. If not already started, click **Start Module**

### Channel Pattern

This function listens to channels matching `game.*`, for example:
- `game.ABC12345`
- `game.XYZ98765`

## Common Issues

### 404 Not Found
- Function not deployed or path is incorrect
- Module is not started
- Check that the path in `.env` matches the deployed function path

### 500 Internal Server Error
- KV Store not enabled (check the checkbox!)
- Function code has syntax errors (check logs in Admin Portal)
- Function not properly started

### 400 Bad Request with "Cannot destructure..."
- Request body parsing issue
- Make sure the latest version of `on-request-function.js` is deployed

### KV Store Errors
- The KV Store checkbox must be checked for BOTH functions
- Without KV Store, the `db` module won't work

## Viewing Function Logs

1. Go to PubNub Admin Portal
2. Navigate to your Functions module
3. Click on the specific function
4. Click **Logs** tab to see console output and errors

## Client Configuration

After deploying both functions, your client `.env` should have:

```
VITE_PUBNUB_PUBLISH_KEY=pub-c-66ab3e60-11b7-4792-a753-92b7e510a21e
VITE_PUBNUB_SUBSCRIBE_KEY=sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe
VITE_PUBNUB_FUNCTION_URL=https://ps.pndsn.com/v1/blocks/sub-key/sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe/game_master
```

## Operations

### Create Game
```bash
POST /game_master?operation=create_game
Body: {"playerId": "player-123"}
```

### Join Game
```bash
POST /game_master?operation=join_game
Body: {"gameId": "ABC12345", "playerId": "player-456"}
```

### Start Game
```bash
POST /game_master?operation=start_game
Body: {"gameId": "ABC12345", "playerId": "player-123"}
```

## PubNub Events

The game uses PubNub channels to broadcast real-time events to all connected clients.

### Admin Channel Events (`admin.{gameId}`)

#### PLAYER_JOINED
Broadcast when a player creates or joins a game.
```json
{
  "v": 1,
  "type": "PLAYER_JOINED",
  "gameId": "ABC12345",
  "playerId": "player-123",
  "playerIds": ["player-123", "player-456"]
}
```

#### GAME_START
Broadcast when the host starts the game.
```json
{
  "v": 1,
  "type": "GAME_START",
  "gameId": "ABC12345",
  "phase": "LIVE",
  "tiles": {"0": "🍕", "1": "🚀", "2": "🐶", "3": "🎸"},
  "initialOrder": {"a": 0, "b": 1, "c": 2, "d": 3},
  "startTT": "1234567890"
}
```

#### GAME_OVER
Broadcast when a player wins.
```json
{
  "v": 1,
  "type": "GAME_OVER",
  "gameId": "ABC12345",
  "phase": "LOCKED",
  "winnerPlayerId": "player-123",
  "goalOrder": {"a": 2, "b": 3, "c": 0, "d": 1},
  "winTT": "1234567890"
}
```

### Game Channel Events (`game.{gameId}`)

#### PROGRESS_UPDATE
Broadcast by the Before Publish Function after each valid move.
```json
{
  "v": 1,
  "type": "PROGRESS_UPDATE",
  "gameId": "ABC12345",
  "playerId": "player-123",
  "moveCount": 5,
  "positionsCorrect": 2,
  "moveTT": "1234567890"
}
```
