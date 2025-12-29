# PubNub Functions Deployment Instructions

## Overview
This document explains how to deploy the Swap It! game server logic to PubNub Functions.

## Prerequisites
- PubNub Account with access to Functions
- Keyset with the following features enabled:
  - Message Persistence
  - App Context (Objects)
  - Presence (optional, for future lobby feature)

## Functions to Deploy

### 1. On Request Function (HTTP Endpoint)

**Purpose**: Handles all game management operations via HTTP POST requests

**Configuration**:
- **Name**: `game_master`
- **Type**: On Request (REST API)
- **Path**: `/game_master`
- **Method**: POST
- **Event Type**: js-on-request

**Source Code**: Copy contents from `server/on-request-function.js`

**Operations Supported**:
- `create_game` - Creates a new game with initial player
- `join_game` - Adds a player to an existing game
- `start_game` - Initializes game and sets phase to COUNTDOWN
- `get_game` - Retrieves current game state

**Endpoint URL Format**:
```
https://ps.pndsn.com/v1/blocks/sub-key/{subkey}/game_master?operation={operation}
```

Example:
```
https://ps.pndsn.com/v1/blocks/sub-key/sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe/game_master?operation=create_game
```

---

### 2. Before Publish Function (Event Handler)

**Purpose**: Validates and processes player moves during gameplay

**Configuration**:
- **Name**: `move_validator`
- **Type**: Before Publish or Fire
- **Channel Pattern**: `game.*`
- **Event Type**: js-before-publish-or-fire

**Source Code**: Copy contents from `server/before-publish-function.js`

**Message Types Handled**:
- `MOVE_SUBMIT` - Validates moves, updates player state, checks for winner
- `PROGRESS_UPDATE` - Passes through (published by function itself)
- All other messages pass through unchanged

---

## Deployment Steps

### Step 1: Access PubNub Functions

1. Log in to [PubNub Dashboard](https://dashboard.pubnub.com)
2. Select your app: **"First Order"**
3. Select your keyset: **"Dev - First Order"**
4. Navigate to **Functions** in the left sidebar

### Step 2: Create On Request Function

1. Click **"Create Module"** → Name it "Swap It Game Server"
2. Click **"Create Function"** → Select **"On Request"**
3. Name: `game_master`
4. Copy entire contents of `server/on-request-function.js`
5. Paste into the function editor
6. Click **"Save"** → Click **"Start Module"**

### Step 3: Create Before Publish Function

1. In the same module, click **"Create Function"** → Select **"Before Publish or Fire"**
2. Name: `move_validator`
3. Channel: `game.*` (use pattern matching)
4. Copy entire contents of `server/before-publish-function.js`
5. Paste into the function editor
6. Click **"Save"**

### Step 4: Test Functions

1. Note the endpoint URL from the On Request function
2. Update your `.env` file (see below)
3. Test create_game operation:
```bash
curl -X POST "https://ps.pndsn.com/v1/blocks/sub-key/YOUR_SUBKEY/game_master?operation=create_game" \
  -H "Content-Type: application/json" \
  -d '{"playerId":"test-player-123","playerName":"Test Player"}'
```

---

## Environment Configuration

Update your `.env` file with the PubNub Functions endpoint:

```env
# PubNub Configuration
VITE_PUBNUB_PUBLISH_KEY=pub-c-66ab3e60-11b7-4792-a753-92b7e510a21e
VITE_PUBNUB_SUBSCRIBE_KEY=sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe

# PubNub Functions Endpoint (replace YOUR_SUBKEY with actual subscribe key)
VITE_PUBNUB_FUNCTION_URL=https://ps.pndsn.com/v1/blocks/sub-key/sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe/game_master
```

---

## Storage Keys Used

The functions use PubNub KV Store with the following keys:

- `swapit:game:{gameId}` - Individual game state
  - Stores: phase, players, playerIds, playerNames, tiles, orders, timestamps

---

## Game Phases

1. **CREATED** - Game created, waiting for players
2. **COUNTDOWN** - Players joined, countdown in progress (3, 2, 1, Go!)
3. **LIVE** - Game active, players making moves
4. **LOCKED** - Game over, winner determined

---

## Message Types Published

### Admin Channel (`admin.{gameId}`)
- `PLAYER_JOINED` - Player joined game
- `COUNTDOWN` - Countdown tick (3, 2, 1)
- `GAME_START` - Game started (Go!)
- `GAME_OVER` - Game finished, winner determined

### Game Channel (`game.{gameId}`)
- `MOVE_SUBMIT` - Player submitted a move (validated by Before Publish function)
- `PROGRESS_UPDATE` - Player progress update (published by Before Publish function)

---

## Troubleshooting

### Function Logs
- View logs in PubNub Dashboard → Functions → Your Module → Logs
- Check for errors in real-time

### Common Issues

1. **404 Error on endpoint**
   - Verify module is started
   - Check endpoint URL format
   - Ensure subscribe key is correct

2. **Moves not validating**
   - Verify Before Publish function is active
   - Check channel pattern matches `game.*`
   - Review function logs for errors

3. **Database errors**
   - Ensure KV Store is enabled on your keyset
   - Check storage quota hasn't been exceeded

---

## Monitoring

Monitor your functions in the PubNub Dashboard:
- **Invocations**: Number of times functions are called
- **Errors**: Any runtime errors or exceptions
- **Latency**: Response time for function execution

---

## Scaling Considerations

- PubNub Functions auto-scale with your traffic
- KV Store has default limits (check your plan)
- Consider cleanup strategy for old games
- Monitor transaction counts to manage costs

---

## Next Steps After Deployment

1. Test create_game, join_game, start_game operations
2. Test gameplay with 2+ players
3. Verify countdown works correctly
4. Check GAME_OVER triggers when player wins
5. Delete local-server.js after successful deployment
