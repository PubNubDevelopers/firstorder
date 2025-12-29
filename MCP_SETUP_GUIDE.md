# PubNub MCP Setup Guide

This guide explains how to use the PubNub MCP server to configure your keyset and deploy the game.

## Prerequisites

- PubNub account at https://dashboard.pubnub.com
- PubNub API Key (v2 API recommended)

## Step 1: Get Your PubNub API Key

1. Log in to https://dashboard.pubnub.com
2. Go to Account Settings → API Keys
3. Generate a new API Key (v2)
4. Copy the key

## Step 2: Set Environment Variable

```bash
export PUBNUB_API_KEY="your-api-key-here"
```

Or add to your shell profile (~/.zshrc, ~/.bashrc):
```bash
echo 'export PUBNUB_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

## Step 3: List Your Apps (Optional)

Check if you already have apps:

```javascript
// The MCP server provides tools to list apps
// Use the manage_apps tool with operation: "list"
```

## Step 4: Create or Select Keyset

You need a keyset with these features:
- Message Persistence: 7 days
- App Context (Objects): Enabled
- Files: Optional
- Presence: Optional (not used in MVP)

### Option A: Create New Keyset via MCP

Use the MCP `manage_keysets` tool:

```javascript
{
  "operation": "create",
  "data": {
    "name": "Swap It Game",
    "type": "production",
    "config": {
      "messagePersistence": {
        "enabled": true,
        "retention": 7,
        "deleteFromHistory": true,
        "includePresenceEvents": false
      },
      "appContext": {
        "enabled": true,
        "region": "aws-iad-1",
        "userMetadataEvents": false,
        "channelMetadataEvents": false,
        "membershipEvents": false,
        "disallowGetAllUserMetadata": false,
        "disallowGetAllChannelMetadata": false,
        "referentialIntegrity": false
      },
      "presence": {
        "enabled": false
      },
      "files": {
        "enabled": false
      }
    }
  }
}
```

### Option B: Use Existing Keyset

List your keysets:
```javascript
{
  "operation": "list"
}
```

Get keyset details:
```javascript
{
  "operation": "get",
  "data": {
    "id": "your-keyset-id"
  }
}
```

## Step 5: Get Your Keys

Once you have a keyset, copy:
- Publish Key (starts with `pub-c-`)
- Subscribe Key (starts with `sub-c-`)

Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_PUBNUB_PUBLISH_KEY=pub-c-xxxxx
VITE_PUBNUB_SUBSCRIBE_KEY=sub-c-xxxxx
```

## Step 6: Deploy the PubNub Function

Currently, PubNub Functions must be deployed manually via the dashboard:

1. Go to your keyset in PubNub dashboard
2. Click "Functions" in the left menu
3. Create new module: "Swap It Game Logic"
4. Add "Before Publish or Fire" event handler:
   - Name: "Game Move Handler"
   - Channel Pattern: `game.*`
5. Copy entire contents of [server/before-publish-function.js](server/before-publish-function.js)
6. Paste into function editor
7. Save
8. Enable KV Store for the module
9. Start the module

## Step 7: Initialize Test Game

Create initial game state in KV Store:

### Via PubNub Dashboard
1. Go to Functions → Your Module → KV Store
2. Add new item:
   - Key: `swapit:game:TESTGAME`
   - Value:
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

### Via PubNub MCP (if available)
The MCP doesn't currently provide direct KV Store manipulation, but you can:
1. Create an On Request function to initialize games
2. Call it via HTTP to set up game state

## Step 8: Run and Test

```bash
npm run dev
```

Open http://localhost:3000 and test the game!

## Troubleshooting MCP Issues

### "Portal API authentication not configured"
- Verify PUBNUB_API_KEY is set: `echo $PUBNUB_API_KEY`
- Try re-exporting: `export PUBNUB_API_KEY="your-key"`
- Restart your terminal/IDE

### "Invalid API key"
- Check key is from the correct PubNub account
- Verify it's a v2 API key (not v1)
- Regenerate if necessary

### MCP tool not available
- Verify Claude Code has PubNub MCP server configured
- Check MCP server is running
- See Claude Code MCP documentation

## Manual Alternative

If MCP is not working, you can complete all setup manually via the PubNub dashboard:

1. Create keyset with required features
2. Copy publish and subscribe keys to `.env`
3. Deploy function code from `server/before-publish-function.js`
4. Initialize game state in KV Store

See [PUBNUB_SETUP.md](PUBNUB_SETUP.md) for detailed manual instructions.

## Verifying Your Setup

After configuration, verify:

1. ✅ Keyset exists with correct features
2. ✅ Publish and Subscribe keys in `.env`
3. ✅ Function deployed and started
4. ✅ KV Store enabled
5. ✅ Test game state exists
6. ✅ Dev server runs without errors

## Getting Help

- PubNub MCP Documentation: Check Claude Code docs
- PubNub Dashboard: https://dashboard.pubnub.com
- PubNub Support: https://support.pubnub.com
- API Reference: https://www.pubnub.com/docs/

## Next Steps

Once configured:
1. Follow [QUICKSTART.md](QUICKSTART.md) to test the game
2. Read [README.md](README.md) for full documentation
3. See [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for architecture details
