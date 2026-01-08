#!/usr/bin/env node

/**
 * Clear all games from PubNub App Context
 * Calls the clear_games operation on the Netlify function
 */

const FUNCTION_URL = process.env.VITE_PUBNUB_FUNCTION_URL;

if (!FUNCTION_URL) {
  console.error('❌ Error: VITE_PUBNUB_FUNCTION_URL environment variable not set');
  console.error('Please set it in your .env file or run:');
  console.error('  export VITE_PUBNUB_FUNCTION_URL="your-function-url"');
  process.exit(1);
}

async function clearAllGames() {
  console.log('🧹 Clearing all games from PubNub App Context...');
  console.log(`   Function URL: ${FUNCTION_URL}`);

  try {
    const response = await fetch(`${FUNCTION_URL}?operation=clear_games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to clear games');
    }

    const result = await response.json();
    console.log('✅ Success:', result.message);
    console.log(`   Games deleted: ${result.gamesDeleted}`);
  } catch (error) {
    console.error('❌ Error clearing games:', error.message);
    process.exit(1);
  }
}

clearAllGames();
