#!/bin/bash

API_KEY="si_0OXCgHBk0K7Z.Ncv1IY0F+K7dBZWyyym/DNRKLNTgopaGWB0OsulHJsr6"

echo "Creating PubNub App: Swap It Game"
echo ""

# Create a new app
RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Swap It Game"}' \
  https://ps.pndsn.com/v2/apps)

echo "$RESPONSE" | python3 -m json.tool

# Extract app ID
APP_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))")

if [ -n "$APP_ID" ]; then
  echo ""
  echo "✓ App created successfully!"
  echo "App ID: $APP_ID"
  echo ""
  echo "Now creating keyset with Message Persistence, App Context, and Presence..."

  # Create keyset with full configuration
  KEYSET_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"app_id\": \"$APP_ID\",
      \"name\": \"Swap It Game Keys\",
      \"production\": false,
      \"features\": {
        \"message_persistence\": {
          \"enabled\": true,
          \"retention\": 7,
          \"delete_from_history\": true
        },
        \"presence\": {
          \"enabled\": true,
          \"announce_max\": 20,
          \"interval\": 10,
          \"deltas\": true
        },
        \"objects\": {
          \"enabled\": true,
          \"region\": \"aws-iad-1\",
          \"user_metadata_events\": true,
          \"channel_metadata_events\": true,
          \"membership_events\": true
        }
      }
    }" \
    https://ps.pndsn.com/v2/keys)

  echo "$KEYSET_RESPONSE" | python3 -m json.tool

  # Extract keys
  PUB_KEY=$(echo "$KEYSET_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('publish_key', ''))")
  SUB_KEY=$(echo "$KEYSET_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('subscribe_key', ''))")

  if [ -n "$PUB_KEY" ] && [ -n "$SUB_KEY" ]; then
    echo ""
    echo "✓ Keyset created successfully!"
    echo ""
    echo "Publish Key: $PUB_KEY"
    echo "Subscribe Key: $SUB_KEY"
    echo ""
    echo "Creating .env file..."

    cat > /Users/craig/Documents/gits/swapit/client/.env << EOF
VITE_PUBNUB_PUBLISH_KEY=$PUB_KEY
VITE_PUBNUB_SUBSCRIBE_KEY=$SUB_KEY
EOF

    echo "✓ .env file created at client/.env"
  else
    echo ""
    echo "✗ Failed to create keyset"
  fi
else
  echo ""
  echo "✗ Failed to create app"
fi
