#!/bin/bash

# PubNub Keyset Creation Script
# Uses PubNub Portal API v2 to create app and keyset

API_KEY="si_0OXCgHBk0K7Z.Ncv1IY0F+K7dBZWyyym/DNRKLNTgopaGWB0OsulHJsr6"

echo "======================================"
echo "PubNub Keyset Creation for Swap It!"
echo "======================================"
echo ""

# Step 1: Create App
echo "Step 1: Creating PubNub app..."
APP_RESPONSE=$(curl -s -X POST "https://ps.pndsn.com/v2/apps" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Swap It Game"
  }')

echo "Response: $APP_RESPONSE"
APP_ID=$(echo $APP_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$APP_ID" ]; then
    echo "❌ Failed to create app. Response:"
    echo "$APP_RESPONSE"
    exit 1
fi

echo "✅ App created successfully!"
echo "   App ID: $APP_ID"
echo ""

# Step 2: Create Keyset
echo "Step 2: Creating keyset with required features..."
KEYSET_RESPONSE=$(curl -s -X POST "https://ps.pndsn.com/v2/apps/$APP_ID/keysets" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Swap It Production",
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
  }')

echo "Response: $KEYSET_RESPONSE"

PUBLISH_KEY=$(echo $KEYSET_RESPONSE | grep -o '"publishKey":"[^"]*"' | cut -d'"' -f4)
SUBSCRIBE_KEY=$(echo $KEYSET_RESPONSE | grep -o '"subscribeKey":"[^"]*"' | cut -d'"' -f4)
KEYSET_ID=$(echo $KEYSET_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PUBLISH_KEY" ] || [ -z "$SUBSCRIBE_KEY" ]; then
    echo "❌ Failed to create keyset. Response:"
    echo "$KEYSET_RESPONSE"
    exit 1
fi

echo "✅ Keyset created successfully!"
echo "   Keyset ID: $KEYSET_ID"
echo "   Publish Key: $PUBLISH_KEY"
echo "   Subscribe Key: $SUBSCRIBE_KEY"
echo ""

# Step 3: Create .env file
echo "Step 3: Creating .env file..."
cat > .env << EOF
# PubNub Configuration for Swap It!
# Generated on $(date)

VITE_PUBNUB_PUBLISH_KEY=$PUBLISH_KEY
VITE_PUBNUB_SUBSCRIBE_KEY=$SUBSCRIBE_KEY
EOF

echo "✅ .env file created!"
echo ""

# Summary
echo "======================================"
echo "Setup Complete!"
echo "======================================"
echo ""
echo "Your PubNub configuration:"
echo "  App Name: Swap It Game"
echo "  App ID: $APP_ID"
echo "  Keyset ID: $KEYSET_ID"
echo "  Publish Key: $PUBLISH_KEY"
echo "  Subscribe Key: $SUBSCRIBE_KEY"
echo ""
echo "Next steps:"
echo "1. Go to https://dashboard.pubnub.com"
echo "2. Navigate to your 'Swap It Game' app"
echo "3. Go to Functions → Create New Module"
echo "4. Deploy the function from server/before-publish-function.js"
echo "5. Initialize test game in KV Store (see MANUAL_SETUP_STEPS.md)"
echo "6. Run: npm run dev"
echo ""
echo "See COMPLETE_SETUP_GUIDE.md for detailed instructions."
