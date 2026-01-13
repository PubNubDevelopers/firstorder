/**
 * Tournament API - Handles communication with Netlify tournament function
 *
 * Mirrors gameApi.js patterns for tournament operations
 */

// Use relative URL for tournament function to work across all deployments
const TOURNAMENT_FUNCTION_URL = '/.netlify/functions/tournament';

/**
 * Create a new tournament
 * @param {string} playerId - Player's unique ID
 * @param {string} playerName - Player's display name
 * @param {Object} options - Tournament options
 * @param {Object} location - Player location data from geolocation
 * @returns {Promise<{success: boolean, tournamentId: string, tournamentName: string, status: string}>}
 */
export async function createTournament(playerId, playerName, options, location) {
  if (!TOURNAMENT_FUNCTION_URL) {
    throw new Error('VITE_PUBNUB_FUNCTION_URL not configured in .env');
  }

  const response = await fetch(`${TOURNAMENT_FUNCTION_URL}?operation=create_tournament`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      playerId,
      playerName,
      options: {
        tournamentName: options.gameName || null,
        tileCount: options.tileCount || 5,
        emojiTheme: options.emojiTheme || 'food',
        maxPlayers: options.maxPlayers || 16,
        advancementRule: options.advancementRule || 2,
        tilePinningEnabled: options.tilePinningEnabled || false,
        verifiedPositionsEnabled: options.verifiedPositionsEnabled || false,
        inviteOnly: options.inviteOnly || false
      },
      location: location || null
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create tournament');
  }

  return response.json();
}

/**
 * List all tournaments (CREATED status)
 * Query App Context directly from client
 * @param {Object} pubnub - PubNub instance
 * @returns {Promise<{success: boolean, tournaments: Array}>}
 */
export async function listTournaments(pubnub) {
  if (!pubnub) {
    throw new Error('PubNub instance is required');
  }

  console.log('[listTournaments] Querying App Context for tournaments...');

  try {
    const tournaments = [];
    let page = null;
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    do {
      iterations++;
      console.log(`[listTournaments] *** ITERATION ${iterations} ***`);

      if (iterations > MAX_ITERATIONS) {
        console.error('[listTournaments] MAX ITERATIONS REACHED - Breaking infinite loop!');
        break;
      }

      const params = {
        limit: 100,
        include: {
          customFields: true,
          statusField: true,
          typeField: true
        },
        filter: "type == 'tournament' && status == 'CREATED'"
      };

      if (page) {
        params.page = page;
      }

      console.log('[listTournaments] Calling getAllChannelMetadata with params:', params);
      const response = await pubnub.objects.getAllChannelMetadata(params);
      console.log('[listTournaments] Got response:', {
        dataLength: response.data?.length || 0,
        next: response.next,
        prev: response.prev,
        totalCount: response.totalCount,
        status: response.status
      });

      if (response.data) {
        for (const channel of response.data) {
          if (!channel.id || typeof channel.id !== 'string' || !channel.id.startsWith('t.')) continue;
          if (channel.custom) {
            const custom = channel.custom;
            const tournamentId = channel.id.replace('t.', '');

            console.log('[listTournaments] Found CREATED tournament:', tournamentId);

            // Check for duplicate
            if (!tournaments.some(t => t.tournamentId === tournamentId)) {
              // Query tournament members
              try {
                const membersResponse = await pubnub.objects.getChannelMembers({
                  channel: channel.id,
                  include: {
                    UUIDFields: true,
                    customFields: true
                  }
                });

                const members = membersResponse.data || [];

                tournaments.push({
                  tournamentId,
                  tournamentName: channel.name,
                  status: channel.status,
                  tileCount: custom.tileCount,
                  emojiTheme: custom.emojiTheme,
                  maxPlayers: custom.maxPlayers,
                  advancementRule: custom.advancementRule,
                  playerCount: members.length,
                  createdAt: custom.createdAt,
                  hostPlayerId: custom.hostPlayerId,
                  hostName: custom.hostName,
                  inviteOnly: custom.inviteOnly || false
                });
              } catch (memberError) {
                console.error('[listTournaments] Error fetching members for', tournamentId, ':', memberError);
              }
            } else {
              console.log('[listTournaments] Duplicate detected - skipping');
            }
          }
        }
      }

      const previousPage = page;
      page = response.next;

      console.log('[listTournaments] Pagination:', { previousPage, newPage: page, continuing: !!(page && page !== 'NA') });

      if (page && page === previousPage) {
        console.error('[listTournaments] SAME PAGE RETURNED - Breaking infinite loop!');
        break;
      }
    } while (page && page !== 'NA');

    console.log('[listTournaments] Total tournaments found:', tournaments.length);

    // Sort by creation time (newest first)
    tournaments.sort((a, b) => b.createdAt - a.createdAt);

    return { success: true, tournaments };
  } catch (error) {
    console.error('[listTournaments] Error:', error);
    throw error;
  }
}

/**
 * Join a tournament
 * @param {string} tournamentId - Tournament ID
 * @param {string} playerId - Player's unique ID
 * @param {string} playerName - Player's display name
 * @param {Object} location - Player location data from geolocation
 * @returns {Promise<{success: boolean, tournamentId: string, status: string}>}
 */
export async function joinTournament(tournamentId, playerId, playerName, location) {
  if (!TOURNAMENT_FUNCTION_URL) {
    throw new Error('TOURNAMENT_FUNCTION_URL not configured');
  }

  const response = await fetch(`${TOURNAMENT_FUNCTION_URL}?operation=join_tournament`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tournamentId,
      playerId,
      playerName,
      location: location || null
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to join tournament');
  }

  return response.json();
}

/**
 * Invite a player to a tournament
 * @param {string} tournamentId - Tournament ID
 * @param {string} hostPlayerId - Host player ID
 * @param {string} targetPlayerId - Target player ID to invite
 * @returns {Promise<{success: boolean, targetPlayerId: string, tournamentId: string, status: string}>}
 */
export async function inviteTournamentPlayer(tournamentId, hostPlayerId, targetPlayerId) {
  if (!TOURNAMENT_FUNCTION_URL) {
    throw new Error('VITE_PUBNUB_FUNCTION_URL not configured in .env');
  }

  const response = await fetch(`${TOURNAMENT_FUNCTION_URL}?operation=invite_tournament_player`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tournamentId,
      hostPlayerId,
      targetPlayerId
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send tournament invitation');
  }

  return response.json();
}

/**
 * Get tournament status and members
 * @param {Object} pubnub - PubNub instance
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<{tournament: object, members: array}>}
 */
export async function getTournamentStatus(pubnub, tournamentId) {
  if (!pubnub) {
    throw new Error('PubNub instance is required');
  }

  // Query tournament channel metadata
  const channelResponse = await pubnub.objects.getChannelMetadata({
    channel: `t.${tournamentId}`,
    include: { customFields: true }
  });

  // Query tournament members
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
    tournament: channelResponse.data,
    members: membersResponse.data
  };
}

/**
 * Generate a random 8-character tournament ID
 * @returns {string}
 */
export function generateTournamentId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let tournamentId = '';
  for (let i = 0; i < 8; i++) {
    tournamentId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return tournamentId;
}
