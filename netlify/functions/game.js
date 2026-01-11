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
      case 'invite_player':
        result = await invitePlayer(pubnub, body);
        break;
      case 'reject_invitation':
        result = await rejectInvitation(pubnub, body);
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
    const inviteOnly = options.inviteOnly || false;
    console.log(`[createGame] inviteOnly from options: ${options.inviteOnly}, final value: ${inviteOnly}`);

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
      inviteOnly,  // NEW: Add invite-only flag
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

    // Set channel type to "private" for invite-only games
    const channelType = inviteOnly ? 'private' : undefined;
    console.log(`[createGame] Setting channel type to: ${channelType}`);
    await storage.setGameMetadata(pubnub, gameId, gameMetadata, channelType);

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

    // 6. Publish GAME_CREATED to lobby channel (only for public games)
    if (!inviteOnly) {
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
    } else {
      console.log(`[createGame] Private game ${gameId} created, not broadcasting to lobby`);
    }

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

    // NEW: Check if game is invite-only
    if (gameMetadata.inviteOnly) {
      const existingMembership = members.find(m => m.uuid.id === playerId);

      if (!existingMembership) {
        return {
          statusCode: 403,
          body: { error: 'This is a private game. You must be invited to join.' }
        };
      }

      const membershipStatus = existingMembership.custom?.status;

      if (membershipStatus === 'DENIED') {
        return {
          statusCode: 403,
          body: { error: 'You declined the invitation to this game.' }
        };
      }

      if (membershipStatus === 'JOINED') {
        // Already joined - idempotent success
        return {
          statusCode: 200,
          body: {
            success: true,
            gameId,
            phase: gameMetadata.phase,
            players: playerIds,
            message: 'Already joined this game'
          }
        };
      }

      // If status is INVITED, continue to update it to JOINED below
    }

    // 4. Check if player already joined (for public games)
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
      correctnessHistory: [],
      status: 'JOINED',  // NEW: Always set status to JOINED
      joinedAt: Date.now()
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

    // NEW: For invite-only games, publish INVITATION_ACCEPTED
    if (gameMetadata.inviteOnly) {
      await pubnub.publish({
        channel: `admin.${gameId}`,
        message: {
          v: 1,
          type: 'INVITATION_ACCEPTED',
          gameId,
          playerId,
          playerName: playerName || playerId,
          status: 'JOINED'
        }
      });
    }

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
 * Invite player to private game (v3.0.0)
 */
async function invitePlayer(pubnub, body) {
  const { gameId, hostPlayerId, targetPlayerId } = body;

  console.log(`[invitePlayer] Host ${hostPlayerId} inviting ${targetPlayerId} to ${gameId}`);

  if (!gameId || !hostPlayerId || !targetPlayerId) {
    return {
      statusCode: 400,
      body: { error: 'Missing gameId, hostPlayerId, or targetPlayerId' }
    };
  }

  try {
    // 1. Validate game exists and is invite-only
    const gameMetadata = await storage.getGameMetadata(pubnub, gameId);

    if (!gameMetadata) {
      return {
        statusCode: 404,
        body: { error: 'Game not found' }
      };
    }

    if (!gameMetadata.inviteOnly) {
      return {
        statusCode: 400,
        body: { error: 'Game is not invite-only' }
      };
    }

    if (gameMetadata.phase !== 'CREATED') {
      return {
        statusCode: 400,
        body: { error: 'Cannot invite players after game has started' }
      };
    }

    // 2. Verify host is member with role="host"
    const members = await storage.getGamePlayers(pubnub, gameId);
    const hostMember = members.find(m => m.uuid.id === hostPlayerId);

    if (!hostMember || hostMember.custom?.role !== 'host') {
      return {
        statusCode: 403,
        body: { error: 'Only host can send invitations' }
      };
    }

    // 3. Check if target player already has membership
    const existingMembership = members.find(m => m.uuid.id === targetPlayerId);

    if (existingMembership) {
      const currentStatus = existingMembership.custom?.status;

      // Cannot re-invite DENIED users (per requirements)
      if (currentStatus === 'DENIED') {
        return {
          statusCode: 400,
          body: { error: 'Cannot re-invite player who denied invitation' }
        };
      }

      // If already INVITED or JOINED, return success (idempotent)
      if (currentStatus === 'INVITED' || currentStatus === 'JOINED') {
        return {
          statusCode: 200,
          body: {
            success: true,
            message: 'Player already invited or joined',
            status: currentStatus
          }
        };
      }
    }

    // 4. Get target player User metadata (for notification)
    const targetPlayer = await storage.getPlayer(pubnub, targetPlayerId);

    if (!targetPlayer) {
      return {
        statusCode: 404,
        body: { error: 'Target player not found' }
      };
    }

    // 5. Create membership with status="INVITED"
    await storage.addPlayerToGame(pubnub, targetPlayerId, gameId, 'player', {
      status: 'INVITED',
      invitedAt: Date.now(),
      invitedBy: hostPlayerId,
      moveCount: 0,
      positionsCorrect: 0,
      finished: false,
      finishTT: null,
      placement: null,
      currentOrder: null,
      correctnessHistory: []
    });

    // 6. Publish invitation to target player's personal channel
    await pubnub.publish({
      channel: `user.${targetPlayerId}`,
      message: {
        v: 1,
        type: 'GAME_INVITATION',
        gameId,
        gameName: gameMetadata.gameName || `Game ${gameId}`,
        hostPlayerId,
        hostName: hostMember.uuid.name,
        tileCount: gameMetadata.tileCount,
        emojiTheme: gameMetadata.emojiTheme,
        maxPlayers: gameMetadata.maxPlayers,
        invitedAt: Date.now()
      }
    });

    // 7. Publish notification to admin channel (for host UI update)
    await pubnub.publish({
      channel: `admin.${gameId}`,
      message: {
        v: 1,
        type: 'PLAYER_INVITED',
        gameId,
        playerId: targetPlayerId,
        playerName: targetPlayer.name,
        status: 'INVITED'
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        targetPlayerId,
        gameId,
        status: 'INVITED'
      }
    };
  } catch (error) {
    console.error('[invitePlayer] Error:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to send invitation', details: error.message }
    };
  }
}

/**
 * Reject game invitation (v3.0.0)
 */
async function rejectInvitation(pubnub, body) {
  const { gameId, playerId } = body;

  console.log(`[rejectInvitation] Player ${playerId} rejecting invite to ${gameId}`);

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

    if (gameMetadata.phase !== 'CREATED') {
      return {
        statusCode: 400,
        body: { error: 'Game already started' }
      };
    }

    // 2. Get player's membership
    const members = await storage.getGamePlayers(pubnub, gameId);
    const membership = members.find(m => m.uuid.id === playerId);

    if (!membership) {
      return {
        statusCode: 404,
        body: { error: 'No invitation found' }
      };
    }

    const currentStatus = membership.custom?.status;

    if (currentStatus === 'DENIED') {
      // Already denied - idempotent
      return {
        statusCode: 200,
        body: { success: true, message: 'Already denied' }
      };
    }

    if (currentStatus === 'JOINED') {
      return {
        statusCode: 400,
        body: { error: 'Cannot reject after joining' }
      };
    }

    // 3. Update membership status to DENIED
    await pubnub.objects.setMemberships({
      uuid: playerId,
      channels: [{
        id: `game.${gameId}`,
        custom: {
          ...membership.custom,
          status: 'DENIED',
          deniedAt: Date.now()
        }
      }]
    });

    // 4. Get player name for notification
    const player = await storage.getPlayer(pubnub, playerId);

    // 5. Publish notification to admin channel (host sees update)
    await pubnub.publish({
      channel: `admin.${gameId}`,
      message: {
        v: 1,
        type: 'INVITATION_DENIED',
        gameId,
        playerId,
        playerName: player?.name || 'Unknown',
        status: 'DENIED'
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        gameId,
        status: 'DENIED'
      }
    };
  } catch (error) {
    console.error('[rejectInvitation] Error:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to reject invitation', details: error.message }
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

    // 8.5. For invite-only games, remove INVITED and DENIED members before starting
    if (gameMetadata.inviteOnly) {
      console.log(`[startGame] Cleaning up INVITED/DENIED members for invite-only game ${gameId}`);

      for (const member of members) {
        const status = member.custom?.status;

        if (status === 'INVITED' || status === 'DENIED') {
          console.log(`[startGame] Removing ${status} member ${member.uuid.id}`);

          await storage.removePlayerFromGame(pubnub, member.uuid.id, gameId);

          // Notify admin channel
          await pubnub.publish({
            channel: `admin.${gameId}`,
            message: {
              v: 1,
              type: 'PLAYER_REMOVED',
              gameId,
              playerId: member.uuid.id,
              reason: `${status} invitation`
            }
          });
        }
      }

      // Refresh the members list after cleanup for player initialization
      const updatedMembers = await storage.getGamePlayers(pubnub, gameId);
      const updatedPlayerIds = updatedMembers.map(m => m.uuid.id);

      // Update playerIds array for the next step
      playerIds.length = 0;
      playerIds.push(...updatedPlayerIds);
    }

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

    // 12. Server-side countdown sequence
    const adminChannel = `admin.${gameId}`;

    // Wait 500ms to ensure all players are subscribed to admin channel
    await new Promise(resolve => setTimeout(resolve, 500));

    // Publish countdown: 3
    await pubnub.publish({
      channel: adminChannel,
      message: {
        v: 1,
        type: 'COUNTDOWN',
        gameId: gameId,
        countdown: 3,
        tiles: tiles,
        initialOrder: initialOrder
      }
    });

    // Wait 1 second, then publish: 2
    await new Promise(resolve => setTimeout(resolve, 1000));
    await pubnub.publish({
      channel: adminChannel,
      message: {
        v: 1,
        type: 'COUNTDOWN',
        gameId: gameId,
        countdown: 2
      }
    });

    // Wait 1 second, then publish: 1
    await new Promise(resolve => setTimeout(resolve, 1000));
    await pubnub.publish({
      channel: adminChannel,
      message: {
        v: 1,
        type: 'COUNTDOWN',
        gameId: gameId,
        countdown: 1
      }
    });

    // Wait 1 second, then publish GAME_START
    await new Promise(resolve => setTimeout(resolve, 1000));
    await pubnub.publish({
      channel: adminChannel,
      message: {
        v: 1,
        type: 'GAME_START',
        gameId: gameId,
        phase: 'LIVE',
        tiles: tiles,
        initialOrder: initialOrder,
        goalOrder: goalOrder,
        tilePinningEnabled: gameMetadata.tilePinningEnabled || false,
        verifiedPositionsEnabled: gameMetadata.verifiedPositionsEnabled || false
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
        playerLocations: game.playerLocations || {},
        maxPlayers: game.maxPlayers || 10,
        tileCount: game.tileCount || 4,
        emojiTheme: game.emojiTheme || 'food',
        tilePinningEnabled: game.tilePinningEnabled || false,
        verifiedPositionsEnabled: game.verifiedPositionsEnabled || false,
        inviteOnly: game.inviteOnly || false,
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
      // Game doesn't exist - player is already not in it, so treat as success
      console.log(`[leaveGame] Game ${gameId} not found - already deleted`);

      // Clean up any orphaned player state/membership just in case
      try {
        await storage.deletePlayerGameState(pubnub, playerId, gameId);
        await storage.removePlayerFromGame(pubnub, playerId, gameId);
      } catch (cleanupError) {
        console.log('[leaveGame] Cleanup error (non-fatal):', cleanupError.message);
      }

      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Game already deleted'
        }
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
      // If host is leaving during live/over game, delete the game entirely (per requirements)
      if (isHost) {
        console.log(`[leaveGame] Host ${playerId} leaving game ${gameId} during ${gameMetadata.phase} - deleting game`);

        // Delete Channel metadata
        await storage.deleteGame(pubnub, gameId);

        // Delete all member game states and memberships
        for (const member of members) {
          await storage.deletePlayerGameState(pubnub, member.uuid.id, gameId);
          await storage.removePlayerFromGame(pubnub, member.uuid.id, gameId);
        }

        // Notify all players that host deleted the game
        await pubnub.publish({
          channel: `admin.${gameId}`,
          message: {
            v: 1,
            type: 'GAME_DELETED',
            gameId,
            reason: 'Host left and deleted the game'
          }
        });

        // Publish GAME_DELETED to lobby (if game was visible there)
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
            gameDeleted: true,
            message: 'Game deleted (host left)'
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

    // If host is leaving during CREATED phase, delete the game (regardless of player count)
    if (isHost) {
      console.log(`[leaveGame] Host ${playerId} leaving game ${gameId} before start - deleting game`);

      // IMPORTANT: Publish GAME_DELETED messages BEFORE removing memberships
      // so all players receive the notification
      await pubnub.publish({
        channel: `admin.${gameId}`,
        message: {
          v: 1,
          type: 'GAME_DELETED',
          gameId,
          reason: 'Host left before start'
        }
      });

      await pubnub.publish({
        channel: 'lobby',
        message: {
          v: 1,
          type: 'GAME_DELETED',
          gameId
        }
      });

      // Delete Channel metadata
      await storage.deleteGame(pubnub, gameId);

      // Delete all member game states and memberships
      for (const member of members) {
        await storage.deletePlayerGameState(pubnub, member.uuid.id, gameId);
        await storage.removePlayerFromGame(pubnub, member.uuid.id, gameId);
      }

      return {
        statusCode: 200,
        body: {
          success: true,
          gameDeleted: true,
          message: 'Game deleted (host left before start)'
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
