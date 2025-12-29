#!/bin/bash

API_KEY="si_0OXCgHBk0K7Z.Ncv1IY0F+K7dBZWyyym/DNRKLNTgopaGWB0OsulHJsr6"

echo "Testing PubNub Portal API authentication..."
echo ""

# Test listing apps
echo "Attempting to list PubNub apps..."
curl -s -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     https://ps.pndsn.com/v2/apps

echo ""
echo ""
echo "If you see app data above, the API key is valid."
