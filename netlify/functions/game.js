/**
 * First Order - Game Management API
 *
 * Netlify serverless function handling all game operations
 *
 * Endpoint: POST /.netlify/functions/game?operation=<operation>
 * Operations:
 *   - create_game: Creates a new game with initial player
 *   - join_game: Adds a player to an existing game
 *   - start_game: Starts the game (CREATED → LIVE)
 *   - get_game: Get current game state
 *   - list_games: List all active games (CREATED phase)
 *   - leave_game: Remove player from game
 *   - update_game_name: Update game name (host only, CREATED phase)
 *   - clear_games: Clear all games (admin operation)
 */

const PubNub = require('pubnub');
const storage = require('./lib/storage');
const {
  generateGameId,
  validateGameOptions,
  selectEmojisFromTheme,
  generateGoalOrder,
  generateInitialOrder
} = require('./lib/gameUtils');

/**
 * Initialize PubNub client
 */
function initPubNub() {
  const publishKey = process.env.PUBNUB_PUBLISH_KEY;
  const subscribeKey = process.env.PUBNUB_SUBSCRIBE_KEY;

  console.log('[initPubNub] Initializing with keys:', {
    publishKey: publishKey ? `${publishKey.substring(0, 10)}...` : 'MISSING',
    subscribeKey: subscribeKey ? `${subscribeKey.substring(0, 10)}...` : 'MISSING'
  });

  if (!publishKey || !subscribeKey) {
    throw new Error('PubNub keys not configured in environment variables');
  }

  return new PubNub({
    publishKey,
    subscribeKey,
    userId: 'server-function',
    restore: false, // Disable state restoration for serverless
    keepAlive: false // Disable keep-alive for serverless functions
  });
}

/**
 * CORS headers for responses
 */
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * Main handler
 */
exports.handler = async (event) => {
  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const pubnub = initPubNub();
    const operation = event.queryStringParameters?.operation;

    if (!operation) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing operation parameter' })
      };
    }

    // Parse request body
    let body = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (e) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid JSON in request body' })
        };
      }
    }

    // Route to appropriate operation
    let result;

    switch (operation) {
      case 'create_game':
        result = await createGame(pubnub, body);
        break;
      case 'join_game':
        result = await joinGame(pubnub, body);
        break;
      case 'start_game':
        result = await startGame(pubnub, body);
        break;
      case 'get_game':
        result = await getGame(pubnub, body);
        break;
      case 'list_games':
        result = await listGames(pubnub);
        break;
      case 'leave_game':
        result = await leaveGame(pubnub, body);
        break;
      case 'update_game_name':
        result = await updateGameName(pubnub, body);
        break;
      case 'clear_games':
        result = await clearGames(pubnub);
        break;
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Invalid operation. Use: create_game, join_game, start_game, get_game, list_games, leave_game, update_game_name, or clear_games'
          })
        };
    }

    return {
      statusCode: result.statusCode || 200,
      headers,
      body: JSON.stringify(result.body)
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};

/**
 * Create a new game
 */
async function createGame(pubnub, body) {
  const { playerId, playerName, options, location } = body;

  if (!playerId) {
    return {
      statusCode: 400,
      body: { error: 'Missing playerId' }
    };
  }

  // Validate game options
  const validation = validateGameOptions(options);
  if (!validation.valid) {
    return {
      statusCode: 400,
      body: { error: validation.error }
    };
  }

  // Generate unique game ID
  const gameId = generateGameId();

  // Create new game state with options
  const gameState = {
    gameId,
    phase: 'CREATED',
    gameName: options.gameName || null,
    tileCount: options.tileCount,
    emojiTheme: options.emojiTheme,
    maxPlayers: options.maxPlayers,
    tilePinningEnabled: options.tilePinningEnabled || false,
    verifiedPositionsEnabled: options.verifiedPositionsEnabled || false,
    players: {
      [playerId]: {
        playerId,
        moveCount: 0,
        currentOrder: null,
        correctnessHistory: [],
        positionsCorrect: 0,
        finished: false,
        finishTT: null
      }
    },
    playerIds: [playerId],
    playerNames: playerName ? { [playerId]: playerName } : {},
    playerLocations: location ? { [playerId]: location } : {},
    createdAt: Date.now(),
    startTT: null,
    winnerPlayerId: null,
    winTT: null,
    lockedTT: null,
    goalOrder: null,
    initialOrder: null,
    tiles: null
  };

  try {
    // Store game state
    await storage.setGame(pubnub, gameId, gameState);

    // Publish PLAYER_JOINED to admin channel
    await pubnub.publish({
      channel: `admin.${gameId}`,
      message: {
        v: 1,
        type: 'PLAYER_JOINED',
        gameId,
        playerId,
        playerIds: gameState.playerIds,
        playerNames: gameState.playerNames
      }
    });

    // Publish GAME_CREATED to lobby channel
    await pubnub.publish({
      channel: 'lobby',
      message: {
        v: 1,
        type: 'GAME_CREATED',
        gameId,
        gameName: gameState.gameName,
        tileCount: gameState.tileCount,
        emojiTheme: gameState.emojiTheme,
        maxPlayers: gameState.maxPlayers,
        createdAt: gameState.createdAt,
        playerIds: gameState.playerIds,
        playerNames: gameState.playerNames,
        playerLocations: gameState.playerLocations,
        playerCount: gameState.playerIds.length
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        gameId,
        gameName: gameState.gameName,
        phase: 'CREATED',
        players: gameState.playerIds
      }
    };
  } catch (error) {
    console.error('Error creating game:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to create game' }
    };
  }
}

/**
 * Join an existing game
 */
async function joinGame(pubnub, body) {
  const { gameId, playerId, playerName, location } = body;

  if (!gameId || !playerId) {
    return {
      statusCode: 400,
      body: { error: 'Missing gameId or playerId' }
    };
  }

  try {
    // Get game state
    const game = await storage.getGame(pubnub, gameId);

    if (!game) {
      return {
        statusCode: 404,
        body: { error: 'Game not found' }
      };
    }

    // Check if game has already started
    if (game.phase !== 'CREATED') {
      return {
        statusCode: 403,
        body: { error: 'Cannot join game that has already started' }
      };
    }

    // Check if player already joined
    if (game.playerIds.includes(playerId)) {
      return {
        statusCode: 200,
        body: {
          success: true,
          gameId,
          phase: game.phase,
          players: game.playerIds,
          message: 'Player already in game'
        }
      };
    }

    // Check if game is full
    const maxPlayers = game.maxPlayers || 10;
    if (game.playerIds.length >= maxPlayers) {
      return {
        statusCode: 403,
        body: { error: `Game is full (max ${maxPlayers} players)` }
      };
    }

    // Add player to game
    game.players[playerId] = {
      playerId,
      moveCount: 0,
      currentOrder: null,
      correctnessHistory: [],
      positionsCorrect: 0,
      finished: false,
      finishTT: null
    };
    game.playerIds.push(playerId);

    // Add player name if provided
    if (playerName) {
      if (!game.playerNames) game.playerNames = {};
      game.playerNames[playerId] = playerName;
    }

    // Add player location if provided
    if (location) {
      if (!game.playerLocations) game.playerLocations = {};
      game.playerLocations[playerId] = location;
    }

    // Update game state
    await storage.setGame(pubnub, gameId, game);

    // Publish PLAYER_JOINED to admin channel
    await pubnub.publish({
      channel: `admin.${gameId}`,
      message: {
        v: 1,
        type: 'PLAYER_JOINED',
        gameId,
        playerId,
        playerIds: game.playerIds,
        playerNames: game.playerNames,
        playerLocations: game.playerLocations
      }
    });

    // Publish PLAYER_JOINED_GAME to lobby
    await pubnub.publish({
      channel: 'lobby',
      message: {
        v: 1,
        type: 'PLAYER_JOINED_GAME',
        gameId,
        playerId,
        playerIds: game.playerIds,
        playerNames: game.playerNames,
        playerLocations: game.playerLocations
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        gameId,
        phase: game.phase,
        players: game.playerIds
      }
    };
  } catch (error) {
    console.error('Error joining game:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to join game' }
    };
  }
}

/**
 * Start the game
 */
async function startGame(pubnub, body) {
  const { gameId, playerId } = body;

  if (!gameId || !playerId) {
    return {
      statusCode: 400,
      body: { error: 'Missing gameId or playerId' }
    };
  }

  try {
    // Get game state
    const game = await storage.getGame(pubnub, gameId);

    if (!game) {
      return {
        statusCode: 404,
        body: { error: 'Game not found' }
      };
    }

    // Only the host (first player) can start the game
    if (game.playerIds[0] !== playerId) {
      return {
        statusCode: 403,
        body: { error: 'Only the host can start the game' }
      };
    }

    // Can only start from CREATED phase
    if (game.phase !== 'CREATED') {
      return {
        statusCode: 403,
        body: { error: 'Game already started or finished' }
      };
    }

    // Generate emoji tiles from theme
    const emojis = selectEmojisFromTheme(game.emojiTheme, game.tileCount);
    const tiles = {};
    for (let i = 0; i < game.tileCount; i++) {
      tiles[i.toString()] = emojis[i];
    }

    // Generate goal order
    const goalOrder = generateGoalOrder(game.tileCount);

    // Generate initial order with 0 positions correct
    const initialOrder = generateInitialOrder(goalOrder, game.tileCount);

    // Update game state
    game.tiles = tiles;
    game.goalOrder = goalOrder;
    game.initialOrder = initialOrder;
    game.phase = 'LOCKED';
    game.startTT = Date.now();

    // Initialize all players with initial order
    for (const pid of game.playerIds) {
      game.players[pid].currentOrder = { ...initialOrder };
      game.players[pid].correctnessHistory = [0];
      game.players[pid].positionsCorrect = 0;
    }

    // Update storage
    await storage.setGame(pubnub, gameId, game);

    // Publish GAME_STARTED to admin channel
    await pubnub.publish({
      channel: `admin.${gameId}`,
      message: {
        v: 1,
        type: 'GAME_STARTED',
        gameId,
        tiles,
        goalOrder,
        initialOrder,
        tilePinningEnabled: game.tilePinningEnabled || false,
        verifiedPositionsEnabled: game.verifiedPositionsEnabled || false,
        startTT: game.startTT
      }
    });

    // Publish GAME_STARTED to lobby (removes from list)
    await pubnub.publish({
      channel: 'lobby',
      message: {
        v: 1,
        type: 'GAME_STARTED',
        gameId
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        gameId,
        phase: 'LIVE',
        tiles,
        goalOrder,
        initialOrder
      }
    };
  } catch (error) {
    console.error('Error starting game:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to start game' }
    };
  }
}

/**
 * Get game state
 */
async function getGame(pubnub, body) {
  const { gameId } = body;

  if (!gameId) {
    return {
      statusCode: 400,
      body: { error: 'Missing gameId' }
    };
  }

  try {
    const game = await storage.getGame(pubnub, gameId);

    if (!game) {
      return {
        statusCode: 404,
        body: { error: 'Game not found' }
      };
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        gameId: game.gameId,
        gameName: game.gameName || null,
        phase: game.phase,
        playerIds: game.playerIds,
        playerNames: game.playerNames || {},
        maxPlayers: game.maxPlayers || 10,
        tileCount: game.tileCount || 4,
        emojiTheme: game.emojiTheme || 'food',
        tilePinningEnabled: game.tilePinningEnabled || false,
        verifiedPositionsEnabled: game.verifiedPositionsEnabled || false,
        tiles: game.tiles,
        goalOrder: game.goalOrder,
        initialOrder: game.initialOrder
      }
    };
  } catch (error) {
    console.error('Error getting game:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to get game' }
    };
  }
}

/**
 * List all active games
 */
async function listGames(pubnub) {
  console.log('[listGames] Starting to list games...');
  try {
    console.log('[listGames] Calling storage.listActiveGames...');
    const games = await storage.listActiveGames(pubnub);
    console.log('[listGames] Retrieved games:', games.length);

    return {
      statusCode: 200,
      body: {
        success: true,
        games
      }
    };
  } catch (error) {
    console.error('[listGames] Error listing games:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to list games' }
    };
  }
}

/**
 * Leave a game
 */
async function leaveGame(pubnub, body) {
  const { gameId, playerId } = body;

  if (!gameId || !playerId) {
    return {
      statusCode: 400,
      body: { error: 'Missing gameId or playerId' }
    };
  }

  try {
    const game = await storage.getGame(pubnub, gameId);

    if (!game) {
      return {
        statusCode: 404,
        body: { error: 'Game not found' }
      };
    }

    // Can only leave during CREATED phase
    if (game.phase !== 'CREATED') {
      return {
        statusCode: 403,
        body: { error: 'Cannot leave game after it has started' }
      };
    }

    // Check if player is in game
    if (!game.playerIds.includes(playerId)) {
      return {
        statusCode: 404,
        body: { error: 'Player not in game' }
      };
    }

    // Check if leaving player is the host (first player)
    const isHost = game.playerIds[0] === playerId;

    // If host is leaving and there are other players, cancel the game
    if (isHost && game.playerIds.length > 1) {
      // Delete game
      await storage.deleteGame(pubnub, gameId);

      // Publish GAME_CANCELED to admin channel
      await pubnub.publish({
        channel: `admin.${gameId}`,
        message: {
          v: 1,
          type: 'GAME_CANCELED',
          gameId,
          reason: 'The host has left and canceled the game.'
        }
      });

      // Publish GAME_DELETED to lobby
      await pubnub.publish({
        channel: 'lobby',
        message: {
          v: 1,
          type: 'GAME_DELETED',
          gameId
        }
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Game canceled (host left)'
        }
      };
    }

    // Remove player from game
    delete game.players[playerId];
    game.playerIds = game.playerIds.filter(pid => pid !== playerId);

    if (game.playerNames && game.playerNames[playerId]) {
      delete game.playerNames[playerId];
    }

    if (game.playerLocations && game.playerLocations[playerId]) {
      delete game.playerLocations[playerId];
    }

    // If no players left, delete game
    if (game.playerIds.length === 0) {
      await storage.deleteGame(pubnub, gameId);

      // Publish GAME_DELETED to lobby
      await pubnub.publish({
        channel: 'lobby',
        message: {
          v: 1,
          type: 'GAME_DELETED',
          gameId
        }
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Game deleted (no players remaining)'
        }
      };
    }

    // Update game
    await storage.setGame(pubnub, gameId, game);

    // Publish PLAYER_LEFT to admin channel
    await pubnub.publish({
      channel: `admin.${gameId}`,
      message: {
        v: 1,
        type: 'PLAYER_LEFT',
        gameId,
        playerId,
        playerIds: game.playerIds,
        playerNames: game.playerNames
      }
    });

    // Publish PLAYER_LEFT_GAME to lobby
    await pubnub.publish({
      channel: 'lobby',
      message: {
        v: 1,
        type: 'PLAYER_LEFT_GAME',
        gameId,
        playerId,
        playerIds: game.playerIds,
        playerNames: game.playerNames
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        gameId,
        playerIds: game.playerIds
      }
    };
  } catch (error) {
    console.error('Error leaving game:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to leave game' }
    };
  }
}

/**
 * Update game name
 */
async function updateGameName(pubnub, body) {
  const { gameId, playerId, gameName } = body;

  if (!gameId || !playerId || !gameName) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields' }
    };
  }

  if (gameName.length > 30) {
    return {
      statusCode: 400,
      body: { error: 'Game name too long' }
    };
  }

  try {
    const game = await storage.getGame(pubnub, gameId);

    if (!game) {
      return {
        statusCode: 404,
        body: { error: 'Game not found' }
      };
    }

    if (game.phase !== 'CREATED') {
      return {
        statusCode: 403,
        body: { error: 'Cannot edit name after game started' }
      };
    }

    if (game.playerIds[0] !== playerId) {
      return {
        statusCode: 403,
        body: { error: 'Only host can edit game name' }
      };
    }

    game.gameName = gameName.trim();

    await storage.setGame(pubnub, gameId, game);

    // Publish update to lobby
    await pubnub.publish({
      channel: 'lobby',
      message: {
        v: 1,
        type: 'GAME_NAME_UPDATED',
        gameId,
        gameName: game.gameName
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        gameName: game.gameName
      }
    };
  } catch (error) {
    console.error('Error updating game name:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to update game name' }
    };
  }
}

/**
 * Clear all games (admin operation)
 */
async function clearGames(pubnub) {
  try {
    const gamesDeleted = await storage.clearAllGames(pubnub);

    return {
      statusCode: 200,
      body: {
        success: true,
        message: `Cleared ${gamesDeleted} games`,
        gamesDeleted
      }
    };
  } catch (error) {
    console.error('Error clearing games:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to clear games' }
    };
  }
}
