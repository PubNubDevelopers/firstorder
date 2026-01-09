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
 * Create a new game (v3.0.0)
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

  // Helper function to calculate default placements
  function calculateDefaultPlacements(maxPlayers) {
    if (maxPlayers === 1) return 1;
    if (maxPlayers === 2) return 2;
    return 3; // maxPlayers >= 3
  }

  try {
    // 1. Create/update User object
    const existingUser = await storage.getPlayer(pubnub, playerId);
    if (!existingUser) {
      await storage.setPlayer(pubnub, playerId, {
        name: playerName || playerId,
        playerLocation: location ? JSON.stringify(location) : null
      });
    }

    // 2. Create game Channel metadata (game-level data only)
    const gameMetadata = {
      gameId,
      phase: 'CREATED',
      gameName: options.gameName || null,
      tileCount: options.tileCount,
      emojiTheme: options.emojiTheme,
      maxPlayers: options.maxPlayers,
      placementCount: options.placementCount || calculateDefaultPlacements(options.maxPlayers),
      tilePinningEnabled: options.tilePinningEnabled || false,
      verifiedPositionsEnabled: options.verifiedPositionsEnabled || false,
      createdAt: Date.now(),
      startTT: null,
      winnerPlayerId: null,
      winnerName: null,
      winTT: null,
      lockedTT: null,
      goalOrder: null,
      initialOrder: null,
      tiles: null
    };

    await storage.setGameMetadata(pubnub, gameId, gameMetadata);

    // 3. Add player as member (host role) with initial game state
    await storage.addPlayerToGame(pubnub, playerId, gameId, 'host', {
      moveCount: 0,
      positionsCorrect: 0,
      finished: false,
      finishTT: null,
      placement: null,
      currentOrder: null,
      correctnessHistory: []
    });

    // 5. Publish PLAYER_JOINED to admin channel
    await pubnub.publish({
      channel: `admin.${gameId}`,
      message: {
        v: 1,
        type: 'PLAYER_JOINED',
        gameId,
        playerId,
        playerIds: [playerId],
        playerNames: { [playerId]: playerName || playerId }
      }
    });

    // 6. Publish GAME_CREATED to lobby channel
    await pubnub.publish({
      channel: 'lobby',
      message: {
        v: 1,
        type: 'GAME_CREATED',
        gameId,
        gameName: gameMetadata.gameName,
        tileCount: gameMetadata.tileCount,
        emojiTheme: gameMetadata.emojiTheme,
        maxPlayers: gameMetadata.maxPlayers,
        createdAt: gameMetadata.createdAt,
        playerIds: [playerId],
        playerNames: { [playerId]: playerName || playerId },
        playerLocations: location ? { [playerId]: location } : {},
        playerCount: 1
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        gameId,
        gameName: gameMetadata.gameName,
        phase: 'CREATED',
        players: [playerId]
      }
    };
  } catch (error) {
    console.error('[createGame] Error:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to create game', details: error.message }
    };
  }
}

/**
 * Join an existing game (v3.0.0)
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
    // 1. Get game metadata
    const gameMetadata = await storage.getGameMetadata(pubnub, gameId);
    if (!gameMetadata) {
      return {
        statusCode: 404,
        body: { error: 'Game not found' }
      };
    }

    // 2. Check if game has already started
    if (gameMetadata.phase !== 'CREATED') {
      return {
        statusCode: 403,
        body: { error: 'Cannot join game that has already started' }
      };
    }

    // 3. Get current members
    const members = await storage.getGamePlayers(pubnub, gameId);
    const playerIds = members.map(m => m.uuid.id);

    // 4. Check if player already joined
    if (playerIds.includes(playerId)) {
      return {
        statusCode: 200,
        body: {
          success: true,
          gameId,
          phase: gameMetadata.phase,
          players: playerIds,
          message: 'Player already in game'
        }
      };
    }

    // 5. Check if game is full
    if (members.length >= gameMetadata.maxPlayers) {
      return {
        statusCode: 403,
        body: { error: `Game is full (max ${gameMetadata.maxPlayers} players)` }
      };
    }

    // 6. Create/update User object
    const existingUser = await storage.getPlayer(pubnub, playerId);
    if (!existingUser) {
      await storage.setPlayer(pubnub, playerId, {
        name: playerName || playerId,
        playerLocation: location ? JSON.stringify(location) : null
      });
    }

    // 7. Add player as member with initial game state
    await storage.addPlayerToGame(pubnub, playerId, gameId, 'player', {
      moveCount: 0,
      positionsCorrect: 0,
      finished: false,
      finishTT: null,
      placement: null,
      currentOrder: null,
      correctnessHistory: []
    });

    // 9. Build updated player lists
    playerIds.push(playerId);
    const playerNames = {};
    const playerLocations = {};

    for (const member of members) {
      playerNames[member.uuid.id] = member.uuid.name;
      if (member.uuid.custom?.playerLocation) {
        try {
          playerLocations[member.uuid.id] = JSON.parse(member.uuid.custom.playerLocation);
        } catch (e) {}
      }
    }
    playerNames[playerId] = playerName || playerId;
    if (location) {
      playerLocations[playerId] = location;
    }

    // 10. Publish PLAYER_JOINED to admin channel
    await pubnub.publish({
      channel: `admin.${gameId}`,
      message: {
        v: 1,
        type: 'PLAYER_JOINED',
        gameId,
        playerId,
        playerIds,
        playerNames,
        playerLocations
      }
    });

    // 11. Publish PLAYER_JOINED_GAME to lobby
    await pubnub.publish({
      channel: 'lobby',
      message: {
        v: 1,
        type: 'PLAYER_JOINED_GAME',
        gameId,
        playerId,
        playerIds,
        playerNames,
        playerLocations
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        gameId,
        phase: gameMetadata.phase,
        players: playerIds
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
    // 1. Get game metadata
    const gameMetadata = await storage.getGameMetadata(pubnub, gameId);

    if (!gameMetadata) {
      return {
        statusCode: 404,
        body: { error: 'Game not found' }
      };
    }

    // 2. Get members to check host and phase
    const members = await storage.getGamePlayers(pubnub, gameId);
    const playerIds = members.map(m => m.uuid.id);

    // 3. Only the host (first member with role='host') can start the game
    const hostMember = members.find(m => m.custom?.role === 'host');
    if (!hostMember || hostMember.uuid.id !== playerId) {
      return {
        statusCode: 403,
        body: { error: 'Only the host can start the game' }
      };
    }

    // 4. Can only start from CREATED phase
    if (gameMetadata.phase !== 'CREATED') {
      return {
        statusCode: 403,
        body: { error: 'Game already started or finished' }
      };
    }

    // 5. Generate emoji tiles from theme
    const emojis = selectEmojisFromTheme(gameMetadata.emojiTheme, gameMetadata.tileCount);
    const tiles = {};
    for (let i = 0; i < gameMetadata.tileCount; i++) {
      tiles[i.toString()] = emojis[i];
    }

    // 6. Generate goal order
    const goalOrder = generateGoalOrder(gameMetadata.tileCount);

    // 7. Generate initial order with 0 positions correct
    const initialOrder = generateInitialOrder(goalOrder, gameMetadata.tileCount);

    const startTT = Date.now();

    // 8. Update Channel metadata with tiles, orders, and phase
    await storage.setGameMetadata(pubnub, gameId, {
      ...gameMetadata,
      tiles,
      goalOrder,
      initialOrder,
      phase: 'LIVE',
      startTT
    });

    // 9. Initialize each player's currentOrder and correctnessHistory in User objects
    for (const playerId of playerIds) {
      const playerGameState = await storage.getPlayerGameState(pubnub, playerId, gameId);
      await storage.setPlayerGameState(pubnub, playerId, gameId, {
        ...playerGameState,
        currentOrder: { ...initialOrder },
        correctnessHistory: [0],
        positionsCorrect: 0
      });
    }

    // 10. Publish GAME_STARTED to admin channel
    await pubnub.publish({
      channel: `admin.${gameId}`,
      message: {
        v: 1,
        type: 'GAME_STARTED',
        gameId,
        tiles,
        goalOrder,
        initialOrder,
        tilePinningEnabled: gameMetadata.tilePinningEnabled || false,
        verifiedPositionsEnabled: gameMetadata.verifiedPositionsEnabled || false,
        startTT
      }
    });

    // 11. Publish GAME_STARTED to lobby (removes from list)
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
    // 1. Get game metadata
    const gameMetadata = await storage.getGameMetadata(pubnub, gameId);

    if (!gameMetadata) {
      return {
        statusCode: 404,
        body: { error: 'Game not found' }
      };
    }

    // 2. Get members
    const members = await storage.getGamePlayers(pubnub, gameId);
    const playerIds = members.map(m => m.uuid.id);

    // 3. Check if player is in game
    if (!playerIds.includes(playerId)) {
      return {
        statusCode: 404,
        body: { error: 'Player not in game' }
      };
    }

    // 4. Check if leaving player is the host
    const leavingMember = members.find(m => m.uuid.id === playerId);
    const isHost = leavingMember?.custom?.role === 'host';

    // Handle LIVE/OVER phase separately
    if (gameMetadata.phase === 'LIVE' || gameMetadata.phase === 'OVER') {
      // If host is leaving during live game, end the game for everyone
      if (isHost) {
        const endTT = Date.now();

        // 5. Update game phase to OVER
        await storage.setGameMetadata(pubnub, gameId, {
          ...gameMetadata,
          phase: 'OVER',
          endTT,
          hostLeftTT: endTT
        });

        // 6. Notify all players that host ended the game
        await pubnub.publish({
          channel: `admin.${gameId}`,
          message: {
            v: 1,
            type: 'HOST_LEFT',
            gameId,
            message: 'The host has left and ended the game.'
          }
        });

        return {
          statusCode: 200,
          body: {
            success: true,
            message: 'Game ended (host left)'
          }
        };
      } else {
        // Non-host player leaving during live game
        // 7. Remove player membership
        await storage.removePlayerFromGame(pubnub, playerId, gameId);

        // 8. Delete player game state
        await storage.deletePlayerGameState(pubnub, playerId, gameId);

        // 9. Get updated member count
        const remainingMembers = await storage.getGamePlayers(pubnub, gameId);
        const remainingPlayerIds = remainingMembers.map(m => m.uuid.id);

        // 10. Check if we need to adjust placements
        const remainingPlayers = remainingPlayerIds.length;

        // Get finished players count from User objects
        let finishedPlayers = 0;
        for (const member of remainingMembers) {
          const playerGameState = await storage.getPlayerGameState(pubnub, member.uuid.id, gameId);
          if (playerGameState.finished) {
            finishedPlayers++;
          }
        }

        // If remaining + finished < placementCount, we may need to end the game
        if ((remainingPlayers + finishedPlayers) < gameMetadata.placementCount) {
          const newPlacementCount = Math.max(1, remainingPlayers + finishedPlayers);

          // Check if game should end now
          if (finishedPlayers >= newPlacementCount) {
            const endTT = Date.now();

            await storage.setGameMetadata(pubnub, gameId, {
              ...gameMetadata,
              placementCount: newPlacementCount,
              phase: 'OVER',
              endTT
            });

            // Reconstruct placements from User objects
            const placements = [];
            for (const member of remainingMembers) {
              const playerGameState = await storage.getPlayerGameState(pubnub, member.uuid.id, gameId);
              if (playerGameState.finished && playerGameState.placement) {
                placements.push({
                  playerId: member.uuid.id,
                  playerName: member.uuid.name,
                  placement: playerGameState.placement,
                  finishTT: playerGameState.finishTT,
                  moveCount: playerGameState.moveCount
                });
              }
            }
            placements.sort((a, b) => a.placement - b.placement);

            // Publish GAME_OVER
            await pubnub.publish({
              channel: `admin.${gameId}`,
              message: {
                v: 1,
                type: 'GAME_OVER',
                gameId,
                phase: 'OVER',
                placements,
                goalOrder: gameMetadata.goalOrder,
                endTT,
                // Backward compatibility
                winnerPlayerId: gameMetadata.winnerPlayerId,
                winnerName: gameMetadata.winnerName,
                winTT: gameMetadata.winTT
              }
            });

            return {
              statusCode: 200,
              body: {
                success: true,
                message: 'Game ended (all placements filled after player left)'
              }
            };
          }

          // Update placement count
          await storage.setGameMetadata(pubnub, gameId, {
            ...gameMetadata,
            placementCount: newPlacementCount
          });
        }

        // Build playerNames for notification
        const playerNames = {};
        remainingMembers.forEach(m => {
          playerNames[m.uuid.id] = m.uuid.name;
        });

        // Notify all remaining players
        await pubnub.publish({
          channel: `admin.${gameId}`,
          message: {
            v: 1,
            type: 'PLAYER_LEFT',
            gameId,
            playerId,
            playerName: leavingMember.uuid.name || `Player ${playerId.slice(-4)}`,
            playerIds: remainingPlayerIds,
            playerNames
          }
        });

        return {
          statusCode: 200,
          body: {
            success: true,
            message: 'Player left game'
          }
        };
      }
    }

    // Handle CREATED phase
    if (gameMetadata.phase !== 'CREATED') {
      return {
        statusCode: 403,
        body: { error: 'Cannot leave game in this phase' }
      };
    }

    // If host is leaving and there are other players, cancel the game
    if (isHost && members.length > 1) {
      // Delete Channel metadata
      await storage.deleteGame(pubnub, gameId);

      // Delete all member game states
      for (const member of members) {
        await storage.deletePlayerGameState(pubnub, member.uuid.id, gameId);
        await storage.removePlayerFromGame(pubnub, member.uuid.id, gameId);
      }

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

    // Remove player membership
    await storage.removePlayerFromGame(pubnub, playerId, gameId);

    // Delete player game state
    await storage.deletePlayerGameState(pubnub, playerId, gameId);

    // Get remaining members
    const remainingMembers = await storage.getGamePlayers(pubnub, gameId);

    // If no players left, delete game
    if (remainingMembers.length === 0) {
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

    // Build updated player lists
    const remainingPlayerIds = remainingMembers.map(m => m.uuid.id);
    const playerNames = {};
    remainingMembers.forEach(m => {
      playerNames[m.uuid.id] = m.uuid.name;
    });

    // Publish PLAYER_LEFT to admin channel
    await pubnub.publish({
      channel: `admin.${gameId}`,
      message: {
        v: 1,
        type: 'PLAYER_LEFT',
        gameId,
        playerId,
        playerIds: remainingPlayerIds,
        playerNames
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
        playerIds: remainingPlayerIds,
        playerNames
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        gameId,
        playerIds: remainingPlayerIds
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
    // 1. Get game metadata
    const gameMetadata = await storage.getGameMetadata(pubnub, gameId);

    if (!gameMetadata) {
      return {
        statusCode: 404,
        body: { error: 'Game not found' }
      };
    }

    // 2. Check phase
    if (gameMetadata.phase !== 'CREATED') {
      return {
        statusCode: 403,
        body: { error: 'Cannot edit name after game started' }
      };
    }

    // 3. Get members to check host
    const members = await storage.getGamePlayers(pubnub, gameId);
    const hostMember = members.find(m => m.custom?.role === 'host');

    if (!hostMember || hostMember.uuid.id !== playerId) {
      return {
        statusCode: 403,
        body: { error: 'Only host can edit game name' }
      };
    }

    // 4. Update game name
    const trimmedName = gameName.trim();
    await storage.setGameMetadata(pubnub, gameId, {
      ...gameMetadata,
      gameName: trimmedName
    });

    // 5. Publish update to lobby
    await pubnub.publish({
      channel: 'lobby',
      message: {
        v: 1,
        type: 'GAME_NAME_UPDATED',
        gameId,
        gameName: trimmedName
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        gameName: trimmedName
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
