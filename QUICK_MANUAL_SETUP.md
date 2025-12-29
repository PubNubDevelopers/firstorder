# Quick Manual Setup - 5 Minutes

Since the MCP authentication is having issues, here's the fastest way to get your game running:

## Step 1: Create App & Keyset (2 minutes)

1. **Go to https://dashboard.pubnub.com**

2. **Create App:**
   - Click "Create New App"
   - Name: "Swap It Game"
   - Click "Create"

3. **Create Keyset:**
   - Click "Create New Keyset"
   - Name: "Production"
   - Click "Create"

4. **Enable Features:**
   Click on your keyset settings and enable:

   **Message Persistence:**
   - Toggle: ON
   - Retention: 7 days

   **App Context (Objects):**
   - Toggle: ON
   - Region: aws-iad-1 (or closest)

   Click "Save Changes"

5. **Copy Your Keys:**
   From the keyset page, copy:
   - Publish Key (pub-c-...)
   - Subscribe Key (sub-c-...)

## Step 2: Configure Environment (30 seconds)

Run this in terminal:

```bash
cd /Users/craig/Documents/gits/swapit

cat > .env << 'EOF'
VITE_PUBNUB_PUBLISH_KEY=PASTE_YOUR_PUBLISH_KEY_HERE
VITE_PUBNUB_SUBSCRIBE_KEY=PASTE_YOUR_SUBSCRIBE_KEY_HERE
EOF
```

Replace the placeholder values with your actual keys.

## Step 3: Deploy Function (2 minutes)

1. In PubNub dashboard, go to **Functions**
2. Click "Create New Module"
3. Name: "Swap It Game Logic"
4. Click "Create"
5. Click "Create Function" → "Before Publish or Fire"
6. Name: "Game Handler"
7. Channel: `game.*`
8. Open `server/before-publish-function.js` on your computer
9. Copy ALL the code
10. Paste into PubNub function editor
11. Click "Save"
12. Click module settings (gear icon) → Enable "KV Store" → Save
13. Click "Start Module"

## Step 4: Initialize Test Game (1 minute)

1. In your module, click "KV Store" tab
2. Click "Add New Item"
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
  "winTT": null
}
```
5. Click "Save"

## Step 5: Run the Game

```bash
npm run dev
```

Open http://localhost:3000 in two browsers and test!

**Note:** For testing, use player IDs "player1" and "player2" to match the test game state.

---

That's it! Your game should be running.
