# Manual Setup Steps for Swap It!

Since the PubNub MCP requires system-level environment configuration, here's a step-by-step manual setup guide.

## Step 1: Create PubNub App and Keyset

1. **Go to PubNub Dashboard**
   - Visit https://dashboard.pubnub.com
   - Log in with your account

2. **Create New App**
   - Click "Create New App"
   - Name: "Swap It Game"
   - Click "Create"

3. **Create New Keyset**
   - In your new app, click "Create New Keyset"
   - Name: "Swap It Production" (or "Development")
   - Click "Create"

## Step 2: Configure Keyset Features

In your keyset settings, enable and configure:

### Message Persistence
- ✅ Enable: **ON**
- Retention: **7 days** (or more)
- Delete from history: **ON**
- Include presence events: **OFF**

### App Context (Objects)
- ✅ Enable: **ON**
- Region: **aws-iad-1** (or closest to you)
- User metadata events: **OFF**
- Channel metadata events: **OFF**
- Membership events: **OFF**
- Referential integrity: **OFF**
- Disallow get all user metadata: **OFF**
- Disallow get all channel metadata: **OFF**

### Files (Optional)
- Enable: **OFF** (not needed for MVP)

### Presence (Optional)
- Enable: **OFF** (not needed for MVP)

### Functions
- This will be enabled when you create a function module

## Step 3: Copy Your Keys

From your keyset page, copy:
1. **Publish Key** (starts with `pub-c-`)
2. **Subscribe Key** (starts with `sub-c-`)

## Step 4: Deploy PubNub Function

1. **Navigate to Functions**
   - In your keyset, click "Functions" in the left sidebar
   - Click "Create New Module"

2. **Create Module**
   - Module Name: "Swap It Game Logic"
   - Description: "Server-side game logic for Swap It multiplayer game"
   - Click "Create"

3. **Add Event Handler**
   - In your module, click "Create New Event Handler"
   - Type: **"Before Publish or Fire"**
   - Name: "Game Move Handler"
   - Channel: `game.*` (with asterisk)
   - Click "Create"

4. **Copy Function Code**
   - Open `server/before-publish-function.js` from this project
   - Copy the ENTIRE contents
   - Paste into the function editor in PubNub dashboard
   - Click "Save"

5. **Enable KV Store**
   - In module settings (gear icon), toggle "KV Store" to **ON**
   - Click "Save"

6. **Start Module**
   - Click "Start Module" button
   - Wait for status to show "Started" (green indicator)

## Step 5: Create Environment File

Create `.env` file in the project root:

```bash
cd /Users/craig/Documents/gits/swapit
cat > .env << 'EOF'
VITE_PUBNUB_PUBLISH_KEY=YOUR_PUBLISH_KEY_HERE
VITE_PUBNUB_SUBSCRIBE_KEY=YOUR_SUBSCRIBE_KEY_HERE
EOF
```

Replace `YOUR_PUBLISH_KEY_HERE` and `YOUR_SUBSCRIBE_KEY_HERE` with your actual keys.

## Step 6: Initialize Test Game State

In PubNub Dashboard:

1. **Go to Functions → Your Module → KV Store Tab**

2. **Add New Item**
   - Click "Add New Item" button

3. **Set Key and Value**
   - **Key**: `swapit:game:TESTGAME`
   - **Value** (copy this exactly):

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

4. **Save**

## Step 7: Test the Application

1. **Install dependencies** (if not already done):
```bash
npm install
```

2. **Start development server**:
```bash
npm run dev
```

3. **Open in browser**: http://localhost:3000

4. **Test multiplayer**:
   - Open two browser windows side by side
   - Window 1: Enter name "Player 1", Game ID "TESTGAME", click "Join Existing Game"
   - Window 2: Enter name "Player 2", Game ID "TESTGAME", click "Join Existing Game"
   - Either window: Click "Start Game"
   - Both should see tiles appear
   - Click tiles to swap - should see moves sync instantly

## Troubleshooting

### Function Not Running
**Check:**
- Module status is "Started" (green)
- Channel pattern is exactly `game.*`
- KV Store is enabled for module
- Look at Function Logs for errors

**Fix:**
- Restart module (Stop → Start)
- Check syntax errors in function code
- Verify KV Store toggle is ON

### "Player not in roster" Error
**Problem:** Client generates random player IDs, but test game has fixed IDs

**Quick Fix:**
Temporarily modify `client/src/components/Lobby.jsx`:

Find this line (~line 22 and ~line 38):
```javascript
const playerId = generatePlayerId();
```

Replace with:
```javascript
const playerId = window.prompt('Enter player ID (player1 or player2):', 'player1');
```

This lets you manually choose player1 or player2 to match the test game state.

### Keys Not Loading
**Check:**
- `.env` file exists in project root
- Keys are on lines starting with `VITE_`
- No quotes needed around values
- Restart dev server after creating `.env`

**Fix:**
```bash
# Verify file contents
cat .env

# Should show:
# VITE_PUBNUB_PUBLISH_KEY=pub-c-xxxxx
# VITE_PUBNUB_SUBSCRIBE_KEY=sub-c-xxxxx
```

### Game Won't Start
**Check:**
- Game exists in KV Store with key `swapit:game:TESTGAME`
- Phase is set to `"CREATED"` (not LIVE or LOCKED)
- Player IDs match what clients are using

**Fix:**
- Re-create game state in KV Store
- Use player ID matching prompt method above
- Check Function logs for error messages

### Moves Not Syncing
**Check:**
- Function is running (green status)
- No errors in Function logs
- Game phase is LIVE (after clicking Start)

**Fix:**
- Check browser console for errors
- Verify PubNub keys in `.env` are correct
- Ensure Before Publish function saved correctly

## Verification Checklist

Before testing, verify:

- ✅ PubNub app created
- ✅ Keyset created with Message Persistence + App Context
- ✅ Function module created and started
- ✅ Before Publish handler on channel `game.*`
- ✅ KV Store enabled for module
- ✅ Test game state exists in KV Store
- ✅ `.env` file has publish and subscribe keys
- ✅ Dev server running without errors

## Next Steps

Once working:
1. Create new games dynamically (see next section)
2. Remove player ID prompt hack
3. Add more players to test
4. Deploy to production

## Creating New Games

For each new game, add to KV Store:

**Key Format**: `swapit:game:{GAME_ID}`

**Example for game "ABC12345"**:
```json
{
  "gameId": "ABC12345",
  "phase": "CREATED",
  "players": ["player_xyz123", "player_abc789"],
  "winnerPlayerId": null,
  "tiles": {},
  "goalOrder": null,
  "initialOrder": null,
  "startTT": null,
  "winTT": null,
  "lockedTT": null
}
```

**Note:** Player IDs must match what clients will generate. For testing, keep using the player ID prompt method until you implement proper game creation.

## Production Considerations

Before going live:
1. Remove player ID prompt hack
2. Implement proper game registration flow
3. Add game cleanup (delete old games)
4. Enable Access Manager (PAM) for security
5. Set up monitoring and alerts
6. Test with real users
7. Consider using production keyset

## Getting Help

If you encounter issues:
1. Check browser console for client errors
2. Check PubNub Function logs for server errors
3. Verify all steps completed correctly
4. Review [PUBNUB_SETUP.md](PUBNUB_SETUP.md) for more details
5. Contact PubNub support: https://support.pubnub.com

## Success!

Once you see both players' boards updating in real-time and can complete a game with a winner, you're all set! The game is working correctly.
