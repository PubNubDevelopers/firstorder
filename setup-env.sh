#!/bin/bash

# Swap It! - Environment Setup Script
# This script helps you configure your PubNub keys

echo "======================================"
echo "Swap It! - PubNub Configuration Setup"
echo "======================================"
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

echo "Please enter your PubNub keys from https://dashboard.pubnub.com"
echo ""

# Prompt for Publish Key
read -p "Enter your Publish Key (pub-c-...): " PUBLISH_KEY

# Validate publish key format
if [[ ! $PUBLISH_KEY =~ ^pub-c- ]]; then
    echo "❌ Invalid Publish Key format. Must start with 'pub-c-'"
    exit 1
fi

# Prompt for Subscribe Key
read -p "Enter your Subscribe Key (sub-c-...): " SUBSCRIBE_KEY

# Validate subscribe key format
if [[ ! $SUBSCRIBE_KEY =~ ^sub-c- ]]; then
    echo "❌ Invalid Subscribe Key format. Must start with 'sub-c-'"
    exit 1
fi

# Create .env file
cat > .env << EOF
# PubNub Configuration
# Generated on $(date)

VITE_PUBNUB_PUBLISH_KEY=$PUBLISH_KEY
VITE_PUBNUB_SUBSCRIBE_KEY=$SUBSCRIBE_KEY
EOF

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "Your configuration:"
echo "  Publish Key: $PUBLISH_KEY"
echo "  Subscribe Key: $SUBSCRIBE_KEY"
echo ""
echo "Next steps:"
echo "1. Deploy the PubNub Function from server/before-publish-function.js"
echo "2. Initialize test game state in KV Store"
echo "3. Run: npm run dev"
echo ""
echo "See MANUAL_SETUP_STEPS.md for detailed instructions."
