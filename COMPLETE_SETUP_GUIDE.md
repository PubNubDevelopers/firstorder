# Complete Setup Guide - Swap It!

This guide provides two paths: Manual setup (fastest) and MCP setup (automated).

## Quick Decision Guide

- **Use Manual Setup if:** You want to get started immediately (5-10 minutes)
- **Use MCP Setup if:** You want automation and will use Claude Code regularly

## Path 1: Manual Setup (Recommended for First Time)

### Step 1: Create PubNub Resources

1. Go to https://dashboard.pubnub.com and log in
2. Click "Create New App" → Name: "Swap It Game"
3. In the new app, click "Create New Keyset" → Name: "Production"

### Step 2: Configure Keyset

Enable these features in your keyset settings:

**Message Persistence:**
- Enable: ✅ ON
- Retention: 7 days
- Delete from history: ✅ ON

**App Context (Objects):**
- Enable: ✅ ON
- Region: aws-iad-1 (or closest to you)

**Functions:**
- Will be enabled when you create a module

### Step 3: Get Your Keys

From your keyset page, copy:
- **Publish Key** (starts with `pub-c-`)
- **Subscribe Key** (starts with `sub-c-`)

### Step 4: Configure Environment

Run the setup script:
```bash
./setup-env.sh
```

Or manually create `.env`:
```bash
cat > .env << 'EOF'
VITE_PUBNUB_PUBLISH_KEY=pub-c-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_PUBNUB_SUBSCRIBE_KEY=sub-c-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
EOF
```

### Step 5: Deploy Function

1. In your keyset, go to **Functions** → **Create New Module**
2. Module name: "Swap It Game Logic"
3. Click **Create**
4. Add event handler:
   - Type: **Before Publish or Fire**
   - Name: "Game Move Handler"
   - Channel: `game.*`
5. Copy ALL code from `server/before-publish-function.js`
6. Paste into function editor
7. Click **Save**
8. In module settings: Enable **KV Store** ✅
9. Click **Start Module** (wait for green status)

### Step 6: Initialize Test Game

1. Go to **Functions** → **Your Module** → **KV Store** tab
2. Click **Add New Item**
3. Key: `swapit:game:TESTGAME`
4. Value:
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
5. Click **Save**

### Step 7: Run the App

```bash
npm run dev
```

Open http://localhost:3000 in two browser windows and test!

**For testing with fixed player IDs**, temporarily modify `client/src/components/Lobby.jsx`:

Line ~22 and ~38, change:
```javascript
const playerId = generatePlayerId();
```
To:
```javascript
const playerId = window.prompt('Enter player ID (player1 or player2):', 'player1');
```

This lets you manually enter "player1" or "player2" to match the test game state.

---

## Path 2: MCP Setup (Automated)

The PubNub MCP server can automate keyset creation and configuration.

### Step 1: Configure MCP Environment

The MCP needs your API key configured system-wide. Add to your shell profile:

**For Zsh (Mac default):**
```bash
echo 'export PUBNUB_API_KEY="si_0OXCgHBk0K7Z.Ncv1IY0F+K7dBZWyyym/DNRKLNTgopaGWB0OsulHJsr6"' >> ~/.zshrc
source ~/.zshrc
```

**For Bash:**
```bash
echo 'export PUBNUB_API_KEY="si_0OXCgHBk0K7Z.Ncv1IY0F+K7dBZWyyym/DNRKLNTgopaGWB0OsulHJsr6"' >> ~/.bashrc
source ~/.bashrc
```

**Verify:**
```bash
echo $PUBNUB_API_KEY
# Should output: si_0OXCgHBk0K7Z.Ncv1IY0F+K7dBZWyyym/DNRKLNTgopaGWB0OsulHJsr6
```

### Step 2: Restart Claude Code / Terminal

After setting the environment variable, restart:
- Your terminal/shell
- Claude Code (if using the CLI)
- VS Code (if using the extension)

### Step 3: Use MCP to Create Resources

Once the environment is configured, you can use Claude Code with MCP commands:

**List existing apps:**
```
Can you list my PubNub apps?
```

**Create new app:**
```
Create a PubNub app named "Swap It Game"
```

**Create keyset with proper config:**
```
Create a PubNub keyset for Swap It with message persistence (7 days) and app context enabled
```

**Get keyset details:**
```
Show me the details of my Swap It keyset
```

### Step 4: Deploy Function (Still Manual)

Function deployment must still be done manually:
1. Follow Step 5 from Manual Setup above
2. Copy `server/before-publish-function.js` to PubNub dashboard

### Step 5: Update .env

After MCP creates your keyset, copy the keys and run:
```bash
./setup-env.sh
```

### Step 6: Initialize and Test

Follow Steps 6-7 from Manual Setup above.

---

## Troubleshooting

### MCP "Authentication not configured"

**Problem:** PUBNUB_API_KEY not available to MCP server

**Solutions:**
1. Add to shell profile (see MCP Step 1)
2. Restart terminal and Claude Code
3. Verify with: `echo $PUBNUB_API_KEY`
4. If still failing, use Manual Setup

### Function Not Executing

**Check:**
- Module status is "Started" (green indicator)
- Channel pattern is exactly `game.*` with asterisk
- KV Store toggle is ON in module settings
- No syntax errors in function code

**View Logs:**
- Functions → Your Module → Logs tab
- Shows all executions and errors

### Player Not in Roster

**Problem:** Client generates random IDs, test game has fixed IDs

**Solution:** Use the player ID prompt modification above, or create game states with actual generated player IDs

### Keys Not Loading

**Check:**
```bash
cat .env
# Should show both VITE_PUBNUB_* keys
```

**Fix:**
- Restart dev server after creating .env
- Verify no syntax errors in .env
- Keys should have no quotes

---

## Verification Checklist

Before running the app:

- ✅ PubNub app exists
- ✅ Keyset created with:
  - ✅ Message Persistence (7 days)
  - ✅ App Context enabled
- ✅ Function module created
- ✅ Before Publish handler on `game.*`
- ✅ Function module started (green)
- ✅ KV Store enabled
- ✅ Test game exists: `swapit:game:TESTGAME`
- ✅ .env file has both keys
- ✅ `npm install` completed
- ✅ `npm run dev` runs without errors

---

## Testing Your Setup

1. **Start dev server:**
```bash
npm run dev
```

2. **Open two browsers:**
   - http://localhost:3000 in Chrome
   - http://localhost:3000 in Firefox (or Incognito)

3. **Join game:**
   - Enter name and game ID "TESTGAME"
   - Click "Join Existing Game"
   - If using player ID prompt: enter "player1" and "player2"

4. **Start game:**
   - Click "Start Game" in either window
   - Both should show 4 emoji tiles

5. **Make moves:**
   - Click one tile, then another to swap
   - Should see move counter increase
   - Should see colored dots for correctness

6. **Win condition:**
   - First to get all 4 correct sees "WINNER!" modal
   - Other sees "YOU LOSE!" modal
   - Goal order revealed to both

**If all works: Success! Your setup is complete.**

---

## Next Steps After Setup

### Remove Test Hacks

Once working, remove the player ID prompt hack:

**Revert `client/src/components/Lobby.jsx`:**
```javascript
const playerId = generatePlayerId();  // Restore this
```

### Dynamic Game Creation

Implement proper game creation:
1. Create On Request function to init games
2. Add API endpoint for game registration
3. Let clients register before game starts

### Production Readiness

1. Enable Access Manager (PAM)
2. Add authentication
3. Implement game cleanup
4. Set up monitoring
5. Use production keyset
6. Add rate limiting

---

## Quick Reference

**Start dev server:**
```bash
npm run dev
```

**View Function logs:**
Dashboard → Functions → Your Module → Logs

**Add test game:**
Dashboard → Functions → Your Module → KV Store → Add Item

**Restart Function:**
Dashboard → Functions → Your Module → Stop → Start

**Check environment:**
```bash
cat .env
echo $PUBNUB_API_KEY
```

---

## Support Resources

- **This Project**: README.md, PUBNUB_SETUP.md
- **PubNub Docs**: https://www.pubnub.com/docs
- **PubNub Support**: https://support.pubnub.com
- **Functions Guide**: https://www.pubnub.com/docs/functions
- **Dashboard**: https://dashboard.pubnub.com

---

## Recommendation

**For now, use Manual Setup** (Path 1). It's faster and doesn't require MCP configuration. You can always set up MCP later for future projects or automation.

The manual process takes 5-10 minutes and gets you running immediately.
