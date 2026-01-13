/**
 * First Order - Tournament Management API
 *
 * Netlify serverless function handling all tournament operations
 *
 * Endpoint: POST /.netlify/functions/tournament?operation=<operation>
 * Operations:
 *   - create_tournament: Creates a new tournament with initial host
 *   - invite_tournament_player: Invites a player to a tournament
 *   - get_tournament_status: Gets tournament status and members
 */

const PubNub = require('pubnub');
const storage = require('./lib/storage');

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
    userId: 'tournament-function',
    restore: false,
    keepAlive: false
  });
}

/**
 * Generate a random 8-character tournament ID
 */
function generateTournamentId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let tournamentId = '';
  for (let i = 0; i < 8; i++) {
    tournamentId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return tournamentId;
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
      case 'create_tournament':
        result = await createTournament(pubnub, body);
        break;
      case 'join_tournament':
        result = await joinTournament(pubnub, body);
        break;
      case 'invite_tournament_player':
        result = await inviteTournamentPlayer(pubnub, body);
        break;
      case 'get_tournament_status':
        result = await getTournamentStatus(pubnub, body);
        break;
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Invalid operation. Use: create_tournament, join_tournament, invite_tournament_player, or get_tournament_status'
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
 * Create a new tournament
 */
async function createTournament(pubnub, body) {
  const { playerId, playerName, options, location } = body;

  if (!playerId) {
    return {
      statusCode: 400,
      body: { error: 'Missing playerId' }
    };
  }

  if (!options) {
    return {
      statusCode: 400,
      body: { error: 'Missing options' }
    };
  }

  // Validate tournament-specific options
  if (options.maxPlayers < 8 || options.maxPlayers > 100) {
    return {
      statusCode: 400,
      body: { error: 'maxPlayers must be 8-100' }
    };
  }

  if (options.advancementRule < 1 || options.advancementRule > 4) {
    return {
      statusCode: 400,
      body: { error: 'advancementRule must be 1-4' }
    };
  }

  const tournamentId = generateTournamentId();

  try {
    // 1. Create/update User object for host
    const existingUser = await storage.getPlayer(pubnub, playerId);
    if (!existingUser) {
      await storage.setPlayer(pubnub, playerId, {
        name: playerName || playerId,
        playerLocation: location ? JSON.stringify(location) : null
      });
    }

    // 2. Create tournament Channel metadata
    const tournamentMetadata = {
      tournamentId,
      tournamentName: options.tournamentName || null,
      tileCount: options.tileCount,
      emojiTheme: options.emojiTheme,
      maxPlayers: options.maxPlayers,
      advancementRule: options.advancementRule,
      tilePinningEnabled: options.tilePinningEnabled || false,
      verifiedPositionsEnabled: options.verifiedPositionsEnabled || false,
      currentRound: 0, // Not started
      totalRounds: null, // Calculated on start
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      rounds: JSON.stringify([]),
      finalPlacements: null,
      hostPlayerId: playerId,
      hostName: playerName || playerId,
      inviteOnly: options.inviteOnly || false
    };

    await pubnub.objects.setChannelMetadata({
      channel: `t.${tournamentId}`,
      data: {
        name: options.tournamentName || `Tournament ${tournamentId}`,
        status: 'CREATED',
        type: 'tournament',
        custom: tournamentMetadata
      }
    });

    // 3. Add host as member with role="host", status="JOINED"
    await pubnub.objects.setMemberships({
      uuid: playerId,
      channels: [{
        id: `t.${tournamentId}`,
        custom: {
          role: 'host',
          status: 'JOINED',
          joinedAt: Date.now(),
          currentRound: 0,
          currentGameId: null,
          eliminatedInRound: null,
          finalPlacement: null,
          roundsPlayed: 0
        }
      }]
    });

    // 4. Publish to admin channel
    await pubnub.publish({
      channel: `admin.t.${tournamentId}`,
      message: {
        v: 1,
        type: 'TOURNAMENT_CREATED',
        tournamentId,
        tournamentName: tournamentMetadata.tournamentName,
        hostPlayerId: playerId,
        hostName: playerName || playerId
      }
    });

    // 5. Publish to lobby (only for public tournaments)
    if (!options.inviteOnly) {
      await pubnub.publish({
        channel: 'lobby',
        message: {
          v: 1,
          type: 'TOURNAMENT_CREATED',
          tournamentId,
          tournamentName: tournamentMetadata.tournamentName,
          tileCount: tournamentMetadata.tileCount,
          emojiTheme: tournamentMetadata.emojiTheme,
          maxPlayers: tournamentMetadata.maxPlayers,
          advancementRule: tournamentMetadata.advancementRule,
          createdAt: tournamentMetadata.createdAt,
          hostPlayerId: playerId,
          hostName: playerName || playerId,
          playerCount: 1
        }
      });
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        tournamentId,
        tournamentName: tournamentMetadata.tournamentName,
        status: 'CREATED'
      }
    };
  } catch (error) {
    console.error('[createTournament] Error:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to create tournament', details: error.message }
    };
  }
}

/**
 * Join a tournament (public tournaments only)
 */
async function joinTournament(pubnub, body) {
  const { tournamentId, playerId, playerName, location } = body;

  if (!tournamentId || !playerId) {
    return {
      statusCode: 400,
      body: { error: 'Missing tournamentId or playerId' }
    };
  }

  try {
    // 1. Get tournament metadata
    const tournamentResponse = await pubnub.objects.getChannelMetadata({
      channel: `t.${tournamentId}`,
      include: { customFields: true }
    });

    const tournamentMetadata = tournamentResponse.data?.custom;

    if (!tournamentMetadata) {
      return {
        statusCode: 404,
        body: { error: 'Tournament not found' }
      };
    }

    if (tournamentResponse.data.status !== 'CREATED') {
      return {
        statusCode: 400,
        body: { error: 'Cannot join tournament after it has started' }
      };
    }

    if (tournamentMetadata.inviteOnly) {
      return {
        statusCode: 403,
        body: { error: 'This tournament is invite-only' }
      };
    }

    // 2. Check if tournament is full
    const membersResponse = await pubnub.objects.getChannelMembers({
      channel: `t.${tournamentId}`,
      include: { UUIDFields: true, customFields: true }
    });

    const currentMembers = membersResponse.data || [];
    const joinedCount = currentMembers.filter(m => m.custom?.status === 'JOINED').length;

    if (joinedCount >= tournamentMetadata.maxPlayers) {
      return {
        statusCode: 400,
        body: { error: 'Tournament is full' }
      };
    }

    // 3. Check if player is already a member
    const existingMembership = currentMembers.find(m => m.uuid.id === playerId);

    if (existingMembership) {
      const currentStatus = existingMembership.custom?.status;
      if (currentStatus === 'JOINED') {
        return {
          statusCode: 200,
          body: { success: true, message: 'Already joined', status: 'JOINED' }
        };
      }
    }

    // 4. Create/update User object
    const existingUser = await storage.getPlayer(pubnub, playerId);
    if (!existingUser) {
      await storage.setPlayer(pubnub, playerId, {
        name: playerName || playerId,
        playerLocation: location ? JSON.stringify(location) : null
      });
    }

    // 5. Add player as member with status="JOINED"
    await pubnub.objects.setMemberships({
      uuid: playerId,
      channels: [{
        id: `t.${tournamentId}`,
        custom: {
          role: 'player',
          status: 'JOINED',
          joinedAt: Date.now(),
          currentRound: 0,
          currentGameId: null,
          eliminatedInRound: null,
          finalPlacement: null,
          roundsPlayed: 0
        }
      }]
    });

    // 6. Publish to admin channel
    await pubnub.publish({
      channel: `admin.t.${tournamentId}`,
      message: {
        v: 1,
        type: 'PLAYER_JOINED_TOURNAMENT',
        tournamentId,
        playerId,
        playerName: playerName || playerId,
        status: 'JOINED',
        joinedCount: joinedCount + 1
      }
    });

    // 7. Publish to lobby (update player count)
    await pubnub.publish({
      channel: 'lobby',
      message: {
        v: 1,
        type: 'TOURNAMENT_PLAYER_JOINED',
        tournamentId,
        playerCount: joinedCount + 1
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        tournamentId,
        status: 'JOINED'
      }
    };
  } catch (error) {
    console.error('[joinTournament] Error:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to join tournament', details: error.message }
    };
  }
}

/**
 * Invite a player to a tournament
 */
async function inviteTournamentPlayer(pubnub, body) {
  const { tournamentId, hostPlayerId, targetPlayerId } = body;

  if (!tournamentId || !hostPlayerId || !targetPlayerId) {
    return {
      statusCode: 400,
      body: { error: 'Missing tournamentId, hostPlayerId, or targetPlayerId' }
    };
  }

  try {
    // 1. Get tournament metadata
    const tournamentResponse = await pubnub.objects.getChannelMetadata({
      channel: `t.${tournamentId}`,
      include: { customFields: true }
    });

    const tournamentMetadata = tournamentResponse.data?.custom;

    if (!tournamentMetadata) {
      return {
        statusCode: 404,
        body: { error: 'Tournament not found' }
      };
    }

    if (tournamentResponse.data.status !== 'CREATED') {
      return {
        statusCode: 400,
        body: { error: 'Cannot invite players after tournament has started' }
      };
    }

    // 2. Verify host permission
    const membersResponse = await pubnub.objects.getChannelMembers({
      channel: `t.${tournamentId}`,
      include: { UUIDFields: true, customFields: true }
    });

    const hostMember = membersResponse.data.find(m => m.uuid.id === hostPlayerId);

    if (!hostMember || hostMember.custom?.role !== 'host') {
      return {
        statusCode: 403,
        body: { error: 'Only host can send invitations' }
      };
    }

    // 3. Check existing membership
    const existingMembership = membersResponse.data.find(m => m.uuid.id === targetPlayerId);

    if (existingMembership) {
      const currentStatus = existingMembership.custom?.status;

      if (currentStatus === 'DENIED') {
        return {
          statusCode: 400,
          body: { error: 'Cannot re-invite player who denied invitation' }
        };
      }

      if (currentStatus === 'INVITED' || currentStatus === 'JOINED') {
        return {
          statusCode: 200,
          body: { success: true, message: 'Player already invited or joined', status: currentStatus }
        };
      }
    }

    // 4. Get target player
    const targetPlayer = await pubnub.objects.getUUIDMetadata({
      uuid: targetPlayerId,
      include: { customFields: true }
    });

    if (!targetPlayer.data) {
      return {
        statusCode: 404,
        body: { error: 'Target player not found' }
      };
    }

    // 5. Create membership with status="INVITED"
    await pubnub.objects.setMemberships({
      uuid: targetPlayerId,
      channels: [{
        id: `t.${tournamentId}`,
        custom: {
          role: 'player',
          status: 'INVITED',
          invitedAt: Date.now(),
          invitedBy: hostPlayerId,
          currentRound: 0,
          currentGameId: null,
          eliminatedInRound: null,
          finalPlacement: null,
          roundsPlayed: 0
        }
      }]
    });

    // 6. Publish to target player's personal channel
    await pubnub.publish({
      channel: `user.${targetPlayerId}`,
      message: {
        v: 1,
        type: 'TOURNAMENT_INVITATION',
        tournamentId,
        tournamentName: tournamentMetadata.tournamentName || `Tournament ${tournamentId}`,
        hostPlayerId,
        hostName: hostMember.uuid.name,
        tileCount: tournamentMetadata.tileCount,
        emojiTheme: tournamentMetadata.emojiTheme,
        maxPlayers: tournamentMetadata.maxPlayers,
        advancementRule: tournamentMetadata.advancementRule,
        invitedAt: Date.now()
      }
    });

    // 7. Publish to admin channel
    await pubnub.publish({
      channel: `admin.t.${tournamentId}`,
      message: {
        v: 1,
        type: 'PLAYER_INVITED',
        tournamentId,
        playerId: targetPlayerId,
        playerName: targetPlayer.data.name,
        status: 'INVITED'
      }
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        targetPlayerId,
        tournamentId,
        status: 'INVITED'
      }
    };
  } catch (error) {
    console.error('[inviteTournamentPlayer] Error:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to send invitation', details: error.message }
    };
  }
}

/**
 * Get tournament status and members
 */
async function getTournamentStatus(pubnub, body) {
  const { tournamentId } = body;

  if (!tournamentId) {
    return {
      statusCode: 400,
      body: { error: 'Missing tournamentId' }
    };
  }

  try {
    const tournamentResponse = await pubnub.objects.getChannelMetadata({
      channel: `t.${tournamentId}`,
      include: { customFields: true }
    });

    const membersResponse = await pubnub.objects.getChannelMembers({
      channel: `t.${tournamentId}`,
      include: {
        UUIDFields: true,
        customUUIDFields: true,
        customFields: true
      },
      limit: 100
    });

    return {
      statusCode: 200,
      body: {
        tournament: tournamentResponse.data,
        members: membersResponse.data
      }
    };
  } catch (error) {
    console.error('[getTournamentStatus] Error:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to get tournament status', details: error.message }
    };
  }
}
