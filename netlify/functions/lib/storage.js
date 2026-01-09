/**
 * Storage adapter using PubNub App Context (Objects API) v3.0.0
 *
 * Architecture:
 * - Channel Metadata: Game-level configuration (tileCount, emojiTheme, tiles, etc.)
 * - User Metadata: Player profiles only (name, playerLocation)
 * - Memberships: Player-game relationships + per-player game state (moveCount, currentOrder, etc.)
 *
 * Breaking change from v2.x:
 * - No more monolithic gameState JSON blob
 * - Individual custom fields for each game property
 * - Per-player game data stored in Membership custom fields, not User objects
 */

/**
 * Helper: Convert game data object to Channel custom fields
 * Note: gameId and gameName are stored in basic channel.id and channel.name fields
 */
function gameToChannelFields(gameData) {
  return {
    tileCount: gameData.tileCount,
    emojiTheme: gameData.emojiTheme,
    maxPlayers: gameData.maxPlayers,
    placementCount: gameData.placementCount,
    tilePinningEnabled: gameData.tilePinningEnabled || false,
    verifiedPositionsEnabled: gameData.verifiedPositionsEnabled || false,
    tiles: gameData.tiles ? JSON.stringify(gameData.tiles) : null,
    goalOrder: gameData.goalOrder ? JSON.stringify(gameData.goalOrder) : null,
    initialOrder: gameData.initialOrder ? JSON.stringify(gameData.initialOrder) : null,
    createdAt: gameData.createdAt,
    startTT: gameData.startTT || null,
    winTT: gameData.winTT || null,
    lockedTT: gameData.lockedTT || null,
    endTT: gameData.endTT || null,
    hostLeftTT: gameData.hostLeftTT || null,
    winnerPlayerId: gameData.winnerPlayerId || null,
    winnerName: gameData.winnerName || null
  };
}

/**
 * Helper: Convert per-player game state to Membership custom fields
 */
function playerGameStateToMembershipFields(playerGameState) {
  return {
    role: playerGameState.role || 'player',
    joinedAt: playerGameState.joinedAt || Date.now(),
    moveCount: playerGameState.moveCount || 0,
    positionsCorrect: playerGameState.positionsCorrect || 0,
    finished: playerGameState.finished || false,
    finishTT: playerGameState.finishTT || null,
    placement: playerGameState.placement || null,
    currentOrder: playerGameState.currentOrder ? JSON.stringify(playerGameState.currentOrder) : null,
    correctnessHistory: JSON.stringify(playerGameState.correctnessHistory || [])
  };
}

/**
 * Helper: Extract player game state from Membership custom fields
 */
function membershipFieldsToPlayerGameState(membershipCustom) {
  return {
    role: membershipCustom.role || 'player',
    joinedAt: membershipCustom.joinedAt,
    moveCount: membershipCustom.moveCount || 0,
    positionsCorrect: membershipCustom.positionsCorrect || 0,
    finished: membershipCustom.finished || false,
    finishTT: membershipCustom.finishTT || null,
    placement: membershipCustom.placement || null,
    currentOrder: membershipCustom.currentOrder ? JSON.parse(membershipCustom.currentOrder) : null,
    correctnessHistory: JSON.parse(membershipCustom.correctnessHistory || '[]')
  };
}

/**
 * Get game metadata (Channel custom fields only, no player data)
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} gameId - Game ID
 * @returns {Promise<Object|null>} Game metadata or null if not found
 */
async function getGameMetadata(pubnub, gameId) {
  try {
    const channelId = `game.${gameId}`;

    const response = await pubnub.objects.getChannelMetadata({
      channel: channelId,
      include: { customFields: true }
    });

    if (!response.data || !response.data.custom) {
      return null;
    }

    const custom = response.data.custom;

    // Parse JSON fields and include basic channel fields
    return {
      gameId: gameId, // From channel.id (game.{gameId})
      gameName: response.data.name || null, // From channel.name
      phase: custom.phase || response.data.status,
      tileCount: custom.tileCount,
      emojiTheme: custom.emojiTheme,
      maxPlayers: custom.maxPlayers,
      placementCount: custom.placementCount,
      tilePinningEnabled: custom.tilePinningEnabled,
      verifiedPositionsEnabled: custom.verifiedPositionsEnabled,
      tiles: custom.tiles ? JSON.parse(custom.tiles) : null,
      goalOrder: custom.goalOrder ? JSON.parse(custom.goalOrder) : null,
      initialOrder: custom.initialOrder ? JSON.parse(custom.initialOrder) : null,
      createdAt: custom.createdAt,
      startTT: custom.startTT,
      winTT: custom.winTT,
      lockedTT: custom.lockedTT,
      endTT: custom.endTT,
      hostLeftTT: custom.hostLeftTT,
      winnerPlayerId: custom.winnerPlayerId,
      winnerName: custom.winnerName
    };
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    console.error('[storage.getGameMetadata] Error:', error);
    throw error;
  }
}

/**
 * Set/update game metadata (Channel custom fields only)
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} gameId - Game ID
 * @param {Object} gameData - Game metadata object
 * @returns {Promise<void>}
 */
async function setGameMetadata(pubnub, gameId, gameData) {
  try {
    const channelId = `game.${gameId}`;
    const customFields = gameToChannelFields(gameData);

    // Add phase field for consistency
    customFields.phase = gameData.phase;

    await pubnub.objects.setChannelMetadata({
      channel: channelId,
      data: {
        name: gameData.gameName || `Game ${gameId}`,
        status: gameData.phase, // Use basic status field for filtering
        custom: customFields
      }
    });
  } catch (error) {
    console.error('[storage.setGameMetadata] Error:', error);
    throw error;
  }
}

/**
 * Get player User metadata
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} playerId - Player ID (UUID)
 * @returns {Promise<Object|null>} User metadata or null if not found
 */
async function getPlayer(pubnub, playerId) {
  try {
    const response = await pubnub.objects.getUUIDMetadata({
      uuid: playerId,
      include: { customFields: true }
    });

    return response.data || null;
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    console.error('[storage.getPlayer] Error:', error);
    throw error;
  }
}

/**
 * Set/update player User metadata
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} playerId - Player ID (UUID)
 * @param {Object} playerData - Player data {name, playerLocation, custom}
 * @returns {Promise<void>}
 */
async function setPlayer(pubnub, playerId, playerData) {
  try {
    await pubnub.objects.setUUIDMetadata({
      uuid: playerId,
      data: {
        name: playerData.name || playerId,
        custom: {
          playerLocation: playerData.playerLocation || null,
          ...playerData.custom
        }
      }
    });
  } catch (error) {
    console.error('[storage.setPlayer] Error:', error);
    throw error;
  }
}

/**
 * Get all players (members) in a game with their User metadata
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} gameId - Game ID
 * @returns {Promise<Array>} Array of member objects with uuid and membership data
 */
async function getGamePlayers(pubnub, gameId) {
  try {
    const channelId = `game.${gameId}`;

    const response = await pubnub.objects.getChannelMembers({
      channel: channelId,
      include: {
        UUIDFields: true,
        customUUIDFields: true,
        customFields: true
      },
      limit: 100
    });

    return response.data || [];
  } catch (error) {
    if (error.status === 404) {
      return [];
    }
    console.error('[storage.getGamePlayers] Error:', error);
    throw error;
  }
}

/**
 * Add player to game (create Membership with initial game state)
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} playerId - Player ID (UUID)
 * @param {string} gameId - Game ID
 * @param {string} role - Player role ('host' | 'player')
 * @param {Object} initialGameState - Initial player game state (optional)
 * @returns {Promise<void>}
 */
async function addPlayerToGame(pubnub, playerId, gameId, role = 'player', initialGameState = {}) {
  try {
    const channelId = `game.${gameId}`;

    const membershipCustom = playerGameStateToMembershipFields({
      role,
      joinedAt: Date.now(),
      moveCount: initialGameState.moveCount || 0,
      positionsCorrect: initialGameState.positionsCorrect || 0,
      finished: initialGameState.finished || false,
      finishTT: initialGameState.finishTT || null,
      placement: initialGameState.placement || null,
      currentOrder: initialGameState.currentOrder || null,
      correctnessHistory: initialGameState.correctnessHistory || []
    });

    await pubnub.objects.setMemberships({
      uuid: playerId,
      channels: [{
        id: channelId,
        custom: membershipCustom
      }]
    });
  } catch (error) {
    console.error('[storage.addPlayerToGame] Error:', error);
    throw error;
  }
}

/**
 * Remove player from game (delete Membership)
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} playerId - Player ID (UUID)
 * @param {string} gameId - Game ID
 * @returns {Promise<void>}
 */
async function removePlayerFromGame(pubnub, playerId, gameId) {
  try {
    const channelId = `game.${gameId}`;

    await pubnub.objects.removeMemberships({
      uuid: playerId,
      channels: [channelId]
    });
  } catch (error) {
    console.error('[storage.removePlayerFromGame] Error:', error);
    throw error;
  }
}

/**
 * Get player's game-specific state from Membership custom fields
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} playerId - Player ID (UUID)
 * @param {string} gameId - Game ID
 * @returns {Promise<Object>} Player game state
 */
async function getPlayerGameState(pubnub, playerId, gameId) {
  try {
    const channelId = `game.${gameId}`;

    const response = await pubnub.objects.getMemberships({
      uuid: playerId,
      include: { customFields: true },
      filter: `channel.id == '${channelId}'`
    });

    if (!response.data || response.data.length === 0) {
      // Return default state if membership doesn't exist
      return {
        role: 'player',
        joinedAt: null,
        moveCount: 0,
        positionsCorrect: 0,
        finished: false,
        finishTT: null,
        placement: null,
        currentOrder: null,
        correctnessHistory: []
      };
    }

    const membership = response.data[0];
    return membershipFieldsToPlayerGameState(membership.custom || {});
  } catch (error) {
    console.error('[storage.getPlayerGameState] Error:', error);
    throw error;
  }
}

/**
 * Set/update player's game-specific state in Membership custom fields
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} playerId - Player ID (UUID)
 * @param {string} gameId - Game ID
 * @param {Object} gameState - Player game state
 * @returns {Promise<void>}
 */
async function setPlayerGameState(pubnub, playerId, gameId, gameState) {
  try {
    const channelId = `game.${gameId}`;

    // Get existing membership to preserve role/joinedAt
    const existing = await getPlayerGameState(pubnub, playerId, gameId);

    // Merge new game state with existing
    const updatedState = {
      role: existing.role || gameState.role || 'player',
      joinedAt: existing.joinedAt || gameState.joinedAt || Date.now(),
      ...gameState
    };

    const membershipCustom = playerGameStateToMembershipFields(updatedState);

    await pubnub.objects.setMemberships({
      uuid: playerId,
      channels: [{
        id: channelId,
        custom: membershipCustom
      }]
    });
  } catch (error) {
    console.error('[storage.setPlayerGameState] Error:', error);
    throw error;
  }
}

/**
 * Delete player's game-specific state (handled by removePlayerFromGame)
 * This function is a no-op since removing the Membership removes all data
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} playerId - Player ID (UUID)
 * @param {string} gameId - Game ID
 * @returns {Promise<void>}
 */
async function deletePlayerGameState(pubnub, playerId, gameId) {
  // Player game state is in Membership custom fields
  // It's automatically deleted when Membership is removed
  // This is a no-op for API compatibility
  return;
}

/**
 * Get full game state (reconstruct from Channel + User data)
 * Used by getGame API endpoint to maintain backward compatibility
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} gameId - Game ID
 * @returns {Promise<Object|null>} Full game state or null if not found
 */
async function getGame(pubnub, gameId) {
  try {
    // Get game metadata
    const gameMetadata = await getGameMetadata(pubnub, gameId);
    if (!gameMetadata) {
      return null;
    }

    // Get members (players)
    const members = await getGamePlayers(pubnub, gameId);

    // Reconstruct player data
    const players = {};
    const playerIds = [];
    const playerNames = {};
    const playerLocations = {};
    const placements = [];

    for (const member of members) {
      const playerId = member.uuid.id;
      const playerName = member.uuid.name;
      const playerGameState = await getPlayerGameState(pubnub, playerId, gameId);

      playerIds.push(playerId);
      playerNames[playerId] = playerName;

      if (member.uuid.custom?.playerLocation) {
        // playerLocation is now stored as a string (e.g., "USA - AZ" or "Canada")
        playerLocations[playerId] = member.uuid.custom.playerLocation;
      }

      players[playerId] = {
        playerId,
        ...playerGameState
      };

      if (playerGameState.finished && playerGameState.placement) {
        placements.push({
          playerId,
          playerName,
          playerLocation: member.uuid.custom?.playerLocation || null,
          placement: playerGameState.placement,
          finishTT: playerGameState.finishTT,
          moveCount: playerGameState.moveCount
        });
      }
    }

    // Sort placements by placement number
    placements.sort((a, b) => a.placement - b.placement);

    // Return reconstructed game state
    return {
      ...gameMetadata,
      players,
      playerIds,
      playerNames,
      playerLocations,
      placements
    };
  } catch (error) {
    console.error('[storage.getGame] Error:', error);
    throw error;
  }
}

/**
 * Delete game (Channel metadata)
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
      console.error('[storage.deleteGame] Error:', error);
      throw error;
    }
  }
}

/**
 * List all active games (CREATED status only)
 * Used by Netlify Functions (not recommended due to cold start timeouts)
 * @param {PubNub} pubnub - PubNub instance
 * @returns {Promise<Array>} List of active games
 */
async function listActiveGames(pubnub) {
  console.log('[storage.listActiveGames] WARNING: This function should be called from client, not Netlify Functions');
  try {
    const games = [];
    let page = null;

    do {
      const params = {
        limit: 100,
        include: { customFields: true, statusField: true },
        filter: "status == 'CREATED'"
      };

      if (page) {
        params.page = page;
      }

      const response = await pubnub.objects.getAllChannelMetadata(params);

      if (response.data) {
        for (const channel of response.data) {
          if (!channel.id.startsWith('game.')) continue;

          const custom = channel.custom;

          // Get members for player count
          const members = await getGamePlayers(pubnub, custom.gameId);

          games.push({
            gameId: custom.gameId,
            gameName: custom.gameName,
            tileCount: custom.tileCount,
            emojiTheme: custom.emojiTheme,
            maxPlayers: custom.maxPlayers,
            phase: custom.phase || channel.status,
            playerIds: members.map(m => m.uuid.id),
            playerNames: Object.fromEntries(members.map(m => [m.uuid.id, m.uuid.name])),
            playerCount: members.length,
            createdAt: custom.createdAt
          });
        }
      }

      page = response.next;
    } while (page && page !== 'NA');

    games.sort((a, b) => b.createdAt - a.createdAt);
    return games;
  } catch (error) {
    console.error('[storage.listActiveGames] Error:', error);
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

    do {
      const params = {
        limit: 100,
        include: { customFields: true }
      };

      if (page) {
        params.page = page;
      }

      const response = await pubnub.objects.getAllChannelMetadata(params);

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
    } while (page && page !== 'NA');

    return deletedCount;
  } catch (error) {
    console.error('[storage.clearAllGames] Error:', error);
    throw error;
  }
}

module.exports = {
  // v3.0.0 new APIs
  getGameMetadata,
  setGameMetadata,
  getPlayer,
  setPlayer,
  getGamePlayers,
  addPlayerToGame,
  removePlayerFromGame,
  getPlayerGameState,
  setPlayerGameState,
  deletePlayerGameState,

  // v2.x compatibility (reconstructs from new structure)
  getGame,
  deleteGame,
  listActiveGames,
  clearAllGames
};
