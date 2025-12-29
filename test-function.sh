#!/bin/bash

# Test script for PubNub On Request Function

FUNCTION_URL="https://ps.pndsn.com/v1/blocks/sub-key/sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe/game_master"

echo "Testing PubNub On Request Function..."
echo "URL: ${FUNCTION_URL}"
echo ""

# Test 1: Create Game
echo "=== Test 1: Create Game ==="
curl -X POST "${FUNCTION_URL}?operation=create_game" \
  -H "Content-Type: application/json" \
  -d '{"gameId":"TEST1234","playerId":"player-test-001"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -v

echo ""
echo ""

# Test 2: Invalid Operation (should return 400)
echo "=== Test 2: Invalid Operation ==="
curl -X POST "${FUNCTION_URL}?operation=invalid" \
  -H "Content-Type: application/json" \
  -d '{"gameId":"TEST1234","playerId":"player-test-001"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo ""

# Test 3: Missing Query Parameter
echo "=== Test 3: Missing Query Parameter ==="
curl -X POST "${FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -d '{"gameId":"TEST1234","playerId":"player-test-001"}' \
  -w "\nHTTP Status: %{http_code}\n"
