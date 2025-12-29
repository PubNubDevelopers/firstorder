/**
 * Storage adapter using PubNub App Context (Objects API) as KV store
 *
 * We'll use channel metadata to store game state:
 * - Channel ID: `game.${gameId}`
 * - Channel metadata basic "status" field for filtering
 * - Channel metadata custom fields store game state as JSON
 */

/**
 * Get game from storage
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} gameId - Game ID
 * @returns {Promise<Object|null>} Game state or null if not found
 */
async function getGame(pubnub, gameId) {
  try {
    const channelId = `game.${gameId}`;

    const response = await pubnub.objects.getChannelMetadata({
      channel: channelId,
      include: {
        customFields: true
      }
    });

    if (!response.data || !response.data.custom || !response.data.custom.gameState) {
      return null;
    }

    // Parse game state from custom field
    return JSON.parse(response.data.custom.gameState);
  } catch (error) {
    // 404 errors mean game doesn't exist
    if (error.status === 404) {
      return null;
    }
    console.error('Error getting game:', error);
    throw error;
  }
}

/**
 * Set/update game in storage
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} gameId - Game ID
 * @param {Object} gameState - Game state object
 * @returns {Promise<void>}
 */
async function setGame(pubnub, gameId, gameState) {
  try {
    const channelId = `game.${gameId}`;

    await pubnub.objects.setChannelMetadata({
      channel: channelId,
      data: {
        name: gameState.gameName || `Game ${gameId}`,
        description: `First Order game - Status: ${gameState.phase}`,
        status: gameState.phase, // Use basic status field for filtering
        custom: {
          gameState: JSON.stringify(gameState),
          playerCount: gameState.playerIds.length,
          createdAt: gameState.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Error setting game:', error);
    throw error;
  }
}

/**
 * Delete game from storage
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} gameId - Game ID
 * @returns {Promise<void>}
 */
async function deleteGame(pubnub, gameId) {
  try {
    const channelId = `game.${gameId}`;

    await pubnub.objects.removeChannelMetadata({
      channel: channelId
    });
  } catch (error) {
    // Ignore 404 errors (game already deleted)
    if (error.status !== 404) {
      console.error('Error deleting game:', error);
      throw error;
    }
  }
}

/**
 * List all active games (CREATED status only)
 * @param {PubNub} pubnub - PubNub instance
 * @returns {Promise<Array>} List of active games
 */
async function listActiveGames(pubnub) {
  console.log('[storage.listActiveGames] Starting...');
  try {
    const games = [];
    let page = null;
    let pageCount = 0;

    // Fetch all channel metadata (paginated) with server-side filtering
    do {
      pageCount++;
      console.log(`[storage.listActiveGames] Fetching page ${pageCount}...`);

      const params = {
        limit: 100,
        include: {
          customFields: true,
          statusField: true
        }
        // Temporarily remove filter to test if it's causing the timeout
        // filter: "status == 'CREATED'" // Server-side filter for performance
      };

      if (page) {
        params.page = page;
      }

      console.log(`[storage.listActiveGames] Calling pubnub.objects.getAllChannelMetadata with params:`, JSON.stringify(params));

      // Add timeout to PubNub API call (8 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('PubNub getAllChannelMetadata timeout after 8 seconds')), 8000)
      );

      const response = await Promise.race([
        pubnub.objects.getAllChannelMetadata(params),
        timeoutPromise
      ]);

      console.log(`[storage.listActiveGames] Page ${pageCount} returned ${response.data?.length || 0} channels`);

      // Filter for game channels with CREATED status (client-side filter until PubNub filter is fixed)
      if (response.data) {
        for (const channel of response.data) {
          if (channel.id.startsWith('game.') &&
              channel.custom &&
              channel.custom.gameState) {

            const gameState = JSON.parse(channel.custom.gameState);

            // Client-side filter for CREATED phase
            if (gameState.phase !== 'CREATED') {
              console.log(`[storage.listActiveGames] Skipping non-CREATED game: ${gameState.gameId} (phase: ${gameState.phase})`);
              continue;
            }

            console.log(`[storage.listActiveGames] Found CREATED game: ${gameState.gameId}`);
            games.push({
              gameId: gameState.gameId,
              gameName: gameState.gameName,
              tileCount: gameState.tileCount,
              emojiTheme: gameState.emojiTheme,
              maxPlayers: gameState.maxPlayers,
              phase: gameState.phase,
              playerIds: gameState.playerIds,
              playerNames: gameState.playerNames || {},
              playerLocations: gameState.playerLocations || {},
              playerCount: gameState.playerIds.length,
              createdAt: gameState.createdAt
            });
          }
        }
      }

      page = response.next;
    } while (page);

    console.log(`[storage.listActiveGames] Total pages fetched: ${pageCount}`);
    console.log(`[storage.listActiveGames] Total games found: ${games.length}`);

    // Sort by creation time (newest first)
    games.sort((a, b) => b.createdAt - a.createdAt);

    return games;
  } catch (error) {
    console.error('[storage.listActiveGames] Error:', error);
    console.error('[storage.listActiveGames] Error message:', error.message);
    console.error('[storage.listActiveGames] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Clear all games (admin operation)
 * @param {PubNub} pubnub - PubNub instance
 * @returns {Promise<number>} Number of games deleted
 */
async function clearAllGames(pubnub) {
  try {
    let deletedCount = 0;
    let page = null;

    // Fetch all channel metadata (paginated)
    do {
      const params = {
        limit: 100,
        include: {
          customFields: true
        }
      };

      if (page) {
        params.page = page;
      }

      const response = await pubnub.objects.getAllChannelMetadata(params);

      // Delete game channels
      if (response.data) {
        for (const channel of response.data) {
          if (channel.id.startsWith('game.')) {
            await pubnub.objects.removeChannelMetadata({
              channel: channel.id
            });
            deletedCount++;
          }
        }
      }

      page = response.next;
    } while (page);

    return deletedCount;
  } catch (error) {
    console.error('Error clearing games:', error);
    throw error;
  }
}

module.exports = {
  getGame,
  setGame,
  deleteGame,
  listActiveGames,
  clearAllGames
};
