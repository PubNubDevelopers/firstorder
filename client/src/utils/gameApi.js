/**
 * Game API - Handles communication with PubNub On Request Function
 *
 * Configure VITE_PUBNUB_FUNCTION_URL in .env file after deploying the On Request Function
 * The URL should be: https://ps.pndsn.com/v1/blocks/sub-key/<SUB_KEY>/<FUNCTION_NAME>/game_master
 */

const FUNCTION_BASE_URL = import.meta.env.VITE_PUBNUB_FUNCTION_URL;

/**
 * Create a new game (server generates gameId)
 * @param {string} playerId - Player's unique ID
 * @param {string} playerName - Player's display name
 * @param {Object} options - Game options (tileCount, emojiTheme, maxPlayers, gameName)
 * @param {Object} location - Player location data from geolocation
 * @returns {Promise<{success: boolean, gameId: string, phase: string, players: string[]}>}
 */
export async function createGame(playerId, playerName, options, location) {
  if (!FUNCTION_BASE_URL) {
    throw new Error('VITE_PUBNUB_FUNCTION_URL not configured in .env');
  }

  const response = await fetch(`${FUNCTION_BASE_URL}?operation=create_game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      playerId,
      playerName,
      options: {
        tileCount: options.tileCount || 5,
        emojiTheme: options.emojiTheme || 'food',
        maxPlayers: options.maxPlayers || 1,
        gameName: options.gameName || null,
        tilePinningEnabled: options.tilePinningEnabled || false,
        verifiedPositionsEnabled: options.verifiedPositionsEnabled || false
      },
      location: location || null
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create game');
  }

  return response.json();
}

/**
 * Join an existing game
 * @param {string} gameId - Game ID to join
 * @param {string} playerId - Player's unique ID
 * @param {string} playerName - Player's display name
 * @param {Object} location - Player location data from geolocation
 * @returns {Promise<{success: boolean, gameId: string, phase: string, players: string[]}>}
 */
export async function joinGame(gameId, playerId, playerName, location) {
  if (!FUNCTION_BASE_URL) {
    throw new Error('VITE_PUBNUB_FUNCTION_URL not configured in .env');
  }

  const response = await fetch(`${FUNCTION_BASE_URL}?operation=join_game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gameId,
      playerId,
      playerName,
      location: location || null
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to join game');
  }

  return response.json();
}

/**
 * Start the game
 * @param {string} gameId - Game ID to start
 * @param {string} playerId - Player's unique ID
 * @returns {Promise<{success: boolean, gameId: string, phase: string}>}
 */
export async function startGame(gameId, playerId) {
  if (!FUNCTION_BASE_URL) {
    throw new Error('VITE_PUBNUB_FUNCTION_URL not configured in .env');
  }

  const response = await fetch(`${FUNCTION_BASE_URL}?operation=start_game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gameId,
      playerId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start game');
  }

  return response.json();
}

/**
 * Get current game state
 * @param {string} gameId - Game ID to query
 * @returns {Promise<{success: boolean, gameId: string, phase: string, playerIds: string[], tiles?: object, initialOrder?: object}>}
 */
export async function getGame(gameId) {
  if (!FUNCTION_BASE_URL) {
    throw new Error('VITE_PUBNUB_FUNCTION_URL not configured in .env');
  }

  const response = await fetch(`${FUNCTION_BASE_URL}?operation=get_game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gameId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get game');
  }

  return response.json();
}

/**
 * List all active games (CREATED phase)
 * Query App Context directly from client instead of through Netlify function
 * @param {Object} pubnub - PubNub instance
 * @returns {Promise<{success: boolean, games: Array<{gameId: string, phase: string, playerIds: string[], playerNames: object, playerCount: number, createdAt: number}>}>}
 */
export async function listGames(pubnub) {
  if (!pubnub) {
    throw new Error('PubNub instance is required');
  }

  console.log('[listGames] Querying App Context directly from client...');

  try {
    const games = [];
    let page = null;

    // Fetch all channel metadata (paginated) with server-side filtering
    do {
      const params = {
        limit: 100,
        include: {
          customFields: true,
          statusField: true
        },
        filter: "status == 'CREATED'" // Server-side filter for performance
      };

      if (page) {
        params.page = page;
      }

      console.log('[listGames] Calling getAllChannelMetadata with params:', params);
      const response = await pubnub.objects.getAllChannelMetadata(params);
      console.log('[listGames] Got response with', response.data?.length || 0, 'channels');

      // Filter for game channels (already filtered to CREATED by server)
      if (response.data) {
        for (const channel of response.data) {
          if (channel.id.startsWith('game.') &&
              channel.custom &&
              channel.custom.gameState) {

            const gameState = JSON.parse(channel.custom.gameState);

            console.log('[listGames] Found CREATED game:', gameState.gameId);
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
    } while (page && page !== 'NA'); // Stop if no more pages or page is 'NA'

    console.log('[listGames] Total games found:', games.length);

    // Sort by creation time (newest first)
    games.sort((a, b) => b.createdAt - a.createdAt);

    return { success: true, games };
  } catch (error) {
    console.error('[listGames] Error:', error);
    throw error;
  }
}

/**
 * Leave a game (CREATED phase only)
 * @param {string} gameId - Game ID to leave
 * @param {string} playerId - Player's unique ID
 * @returns {Promise<{success: boolean, gameId?: string, playerIds?: string[], message?: string}>}
 */
export async function leaveGame(gameId, playerId) {
  if (!FUNCTION_BASE_URL) {
    throw new Error('VITE_PUBNUB_FUNCTION_URL not configured in .env');
  }

  const response = await fetch(`${FUNCTION_BASE_URL}?operation=leave_game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gameId,
      playerId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to leave game');
  }

  return response.json();
}

/**
 * Update game name (host only, CREATED phase only)
 * @param {string} gameId - Game ID
 * @param {string} playerId - Player's unique ID
 * @param {string} gameName - New game name
 * @returns {Promise<{success: boolean, gameName: string}>}
 */
export async function updateGameName(gameId, playerId, gameName) {
  if (!FUNCTION_BASE_URL) {
    throw new Error('VITE_PUBNUB_FUNCTION_URL not configured in .env');
  }

  const response = await fetch(`${FUNCTION_BASE_URL}?operation=update_game_name`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gameId,
      playerId,
      gameName
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update game name');
  }

  return response.json();
}

/**
 * Clear all games from KVStore (admin operation)
 * @returns {Promise<{success: boolean, message: string, gamesDeleted: number}>}
 */
export async function clearAllGames() {
  if (!FUNCTION_BASE_URL) {
    throw new Error('VITE_PUBNUB_FUNCTION_URL not configured in .env');
  }

  const response = await fetch(`${FUNCTION_BASE_URL}?operation=clear_games`, {
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

  return response.json();
}

/**
 * Generate a random 8-character game ID
 * @returns {string}
 */
export function generateGameId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let gameId = '';
  for (let i = 0; i < 8; i++) {
    gameId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return gameId;
}

/**
 * Generate a unique player ID
 * @returns {string}
 */
export function generatePlayerId() {
  return `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
