# PubNub Setup Instructions

Follow these steps to configure PubNub for the Swap It! game.

## Step 1: Create a PubNub Account

1. Go to https://dashboard.pubnub.com
2. Sign up for a free account (if you don't have one)
3. Create a new app or use an existing one

## Step 2: Create and Configure a Keyset

### Required Features:
Your keyset must have these features enabled:

1. **Message Persistence**
   - Retention: At least 1 day (7 days recommended)
   - This stores game messages for history/debugging

2. **App Context (Objects)**
   - Enabled: Yes
   - Region: Any (choose closest to your users)
   - This allows storing user and channel metadata

3. **Functions & KV Store**
   - This is where the game logic runs
   - KV Store holds game state

### Using PubNub MCP (Automated)

If you have the PubNub MCP configured with your API key:

```bash
# Set your API key
export PUBNUB_API_KEY="your-api-key"

# The MCP can help create and configure your keyset
# Follow the MCP prompts to:
# 1. Create a new keyset
# 2. Enable Message Persistence (7 day retention)
# 3. Enable App Context
# 4. Enable Functions
```

### Manual Setup via Admin Portal

1. In PubNub Admin Portal, go to your app
2. Click "Create New Keyset"
3. Name it (e.g., "swap-it-game")
4. In keyset settings, enable:
   - **Message Persistence**: 7 days
   - **App Context**: Yes (choose region)
5. Copy your **Publish Key** and **Subscribe Key**

## Step 3: Deploy the Before Publish Function

1. In your keyset, click **"Functions"** in the left menu
2. Click **"Create New Module"**
3. Name it "Swap It Game Logic"
4. Click **"Create"**
5. Add a new function:
   - **Type**: "Before Publish or Fire"
   - **Name**: "Game Move Handler"
   - **Channel Pattern**: `game.*`
6. Copy the entire contents of `server/before-publish-function.js`
7. Paste it into the function editor
8. Click **"Save"**
9. Enable **KV Store** for the module (toggle in module settings)
10. Click **"Start Module"**

## Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your keys:

```
VITE_PUBNUB_PUBLISH_KEY=pub-c-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_PUBNUB_SUBSCRIBE_KEY=sub-c-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Step 5: Initialize Test Game State

Before you can test the game, you need to create initial game state in the KV Store.

### Option A: Via Admin Portal

1. Go to Functions > Your Module > **KV Store** tab
2. Click **"Add New Item"**
3. **Key**: `swapit:game:TESTGAME`
4. **Value**:
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
  "winTT": null
}
```
5. Click **"Save"**

### Option B: Via REST API (Advanced)

Create an "On Request" function handler:

```javascript
export default (request) => {
  const db = require('kvstore');
  const gameId = request.params.gameId || 'TESTGAME';

  return db.set(`swapit:game:${gameId}`, {
    gameId: gameId,
    phase: 'CREATED',
    players: ['player1', 'player2'],
    winnerPlayerId: null,
    tiles: {},
    goalOrder: null,
    initialOrder: null,
    startTT: null,
    winTT: null
  }).then(() => {
    return request.ok({ body: { success: true, gameId } });
  });
};
```

Then call it:
```bash
curl "https://ps.pndsn.com/v1/blocks/sub-key/YOUR_SUB_KEY/init-game?gameId=TESTGAME"
```

## Step 6: Test Your Setup

1. Run the app:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000 in two browser windows

3. Window 1:
   - Enter name: "Player 1"
   - Game ID: "TESTGAME"
   - Click "Join Existing Game"

4. Window 2:
   - Enter name: "Player 2"
   - Game ID: "TESTGAME"
   - Click "Join Existing Game"

5. In either window, click **"Start Game"**

6. Both windows should show:
   - 4 emoji tiles
   - Same starting arrangement
   - Move counters

7. Click tiles to swap them in either window

8. First player to arrange all 4 correctly wins!

## Troubleshooting

### "PubNub keys are required" error
- Check that `.env` file exists and has valid keys
- Restart the dev server after creating `.env`
- Ensure keys start with `pub-c-` and `sub-c-`

### "Game not found" or "Player not in roster"
- Verify game exists in KV Store with key `swapit:game:TESTGAME`
- Check that `phase` is set to `"CREATED"`
- Ensure player IDs match (see note below)

### Function not running
- Check Functions logs in PubNub dashboard
- Verify module is "Started" (green indicator)
- Ensure channel pattern is `game.*` (with asterisk)
- Check that KV Store is enabled for the module

### Player ID Mismatch (Common Issue)

The client generates random player IDs, but the test game state has fixed IDs (`player1`, `player2`).

**Quick Fix**: Modify `client/src/components/Lobby.jsx` temporarily for testing:

```javascript
// In handleCreateGame and handleJoinGame, replace:
const playerId = generatePlayerId();

// With:
const playerId = prompt('Enter player ID (player1 or player2):') || 'player1';
```

This lets you manually specify which player you are.

**Better Solution**: Create an On Request function to dynamically create games with proper player registration.

## Production Deployment

For production:

1. Remove test game state from KV Store
2. Implement proper game creation flow
3. Add game cleanup (delete old games after X hours)
4. Enable Access Manager (PAM) for security
5. Set appropriate message retention
6. Monitor Functions logs and usage
7. Consider adding rate limiting

## Security Considerations

For MVP, this setup has no authentication. For production:

1. **Enable Access Manager (PAM)**
   - Generate tokens server-side
   - Restrict channel access per user

2. **Validate Player Identity**
   - Use proper user authentication
   - Verify player IDs server-side

3. **Rate Limiting**
   - Add move rate limits in Function
   - Prevent spam/abuse

4. **Game Cleanup**
   - Automatically delete old games
   - Set TTL on KV Store entries

## Cost Estimation

PubNub free tier includes:
- 1M messages/month
- 200 MAUs (Monthly Active Users)

Swap It usage per game (4 players, 50 moves total):
- ~150 messages (moves + updates + lifecycle)
- With free tier: ~6,600 games/month

For higher traffic, check PubNub pricing: https://www.pubnub.com/pricing/

## Getting Help

- PubNub Documentation: https://www.pubnub.com/docs/
- PubNub Support: https://support.pubnub.com/
- Functions Guide: https://www.pubnub.com/docs/functions/
- KV Store Guide: https://www.pubnub.com/docs/functions/kvstore
