# Quick Start Guide

Get Swap It! running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- PubNub account (sign up free at https://dashboard.pubnub.com)

## Setup Steps

### 1. Install Dependencies (30 seconds)

```bash
npm install
```

### 2. Configure PubNub (2 minutes)

1. Go to https://dashboard.pubnub.com
2. Create a new app (or use existing)
3. Create a new keyset with:
   - Message Persistence: 7 days
   - App Context: Enabled
   - Functions: Enabled

4. Copy your Publish and Subscribe keys

5. Create `.env` file:
```bash
cp .env.example .env
```

6. Edit `.env` with your keys:
```
VITE_PUBNUB_PUBLISH_KEY=pub-c-xxxxx
VITE_PUBNUB_SUBSCRIBE_KEY=sub-c-xxxxx
```

### 3. Deploy PubNub Function (2 minutes)

1. In PubNub dashboard, go to Functions
2. Create new module: "Swap It Game Logic"
3. Add "Before Publish or Fire" event handler
4. Set channel pattern: `game.*`
5. Copy entire contents of `server/before-publish-function.js`
6. Paste into function editor
7. Save and Start module
8. Enable KV Store in module settings

### 4. Initialize Test Game (1 minute)

In PubNub dashboard:
1. Go to Functions → Your Module → KV Store tab
2. Add new item:
   - **Key**: `swapit:game:TESTGAME`
   - **Value**:
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

### 5. Run the App

```bash
npm run dev
```

Open http://localhost:3000

## Test the Game

1. Open two browser windows side by side
2. Window 1: Join game "TESTGAME" as "Player 1"
3. Window 2: Join game "TESTGAME" as "Player 2"
4. Either window: Click "Start Game"
5. Race to arrange the tiles correctly!

## What's Next?

- Read [README.md](README.md) for detailed documentation
- See [PUBNUB_SETUP.md](PUBNUB_SETUP.md) for advanced configuration
- Check [server/setup-game.md](server/setup-game.md) for game initialization options

## Common First-Time Issues

**"PubNub keys are required"**
- Restart dev server after creating .env file

**"Player not in roster"**
- Player IDs are randomly generated
- For testing, modify Lobby.jsx to use fixed IDs (see PUBNUB_SETUP.md)

**Game won't start**
- Verify game exists in KV Store
- Check Functions logs for errors
- Ensure function is "Started" (green)

**Moves not working**
- Check Before Publish function is deployed
- Verify channel pattern is `game.*`
- Look at Functions execution logs

## Need Help?

- Check the full [README.md](README.md)
- Review [PUBNUB_SETUP.md](PUBNUB_SETUP.md) troubleshooting section
- Visit https://support.pubnub.com/

## Have Fun!

The game is simple but competitive. May the fastest swapper win! 🏆
