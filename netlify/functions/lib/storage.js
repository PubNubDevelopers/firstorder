/**
 * Storage adapter using PubNub App Context (Objects API) v3.0.0
 *
 * Architecture:
 * - Channel Metadata: Game-level configuration (tileCount, emojiTheme, tiles, etc.)
 * - User Metadata: Player profiles + per-game state (moveCount, currentOrder, etc.)
 * - Memberships: Track which players belong to which games
 *
 * Breaking change from v2.x:
 * - No more monolithic gameState JSON blob
 * - Individual custom fields for each game property
 * - Player data stored in User objects, not Channel metadata
 */

/**
 * Helper: Convert game data object to Channel custom fields
 */
function gameToChannelFields(gameData) {
  return {
    gameId: gameData.gameId,
    gameName: gameData.gameName || null,
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
 * Helper: Convert per-player game state to User custom field keys
 */
function playerGameStateToUserFields(gameId, playerGameState) {
  const prefix = `game_${gameId}_`;
  return {
    [`${prefix}moveCount`]: playerGameState.moveCount || 0,
    [`${prefix}positionsCorrect`]: playerGameState.positionsCorrect || 0,
    [`${prefix}finished`]: playerGameState.finished || false,
    [`${prefix}finishTT`]: playerGameState.finishTT || null,
    [`${prefix}placement`]: playerGameState.placement || null,
    [`${prefix}currentOrder`]: playerGameState.currentOrder ? JSON.stringify(playerGameState.currentOrder) : null,
    [`${prefix}correctnessHistory`]: JSON.stringify(playerGameState.correctnessHistory || [])
  };
}

/**
 * Helper: Extract player game state from User custom fields
 */
function userFieldsToPlayerGameState(gameId, userCustom) {
  const prefix = `game_${gameId}_`;
  return {
    moveCount: userCustom[`${prefix}moveCount`] || 0,
    positionsCorrect: userCustom[`${prefix}positionsCorrect`] || 0,
    finished: userCustom[`${prefix}finished`] || false,
    finishTT: userCustom[`${prefix}finishTT`] || null,
    placement: userCustom[`${prefix}placement`] || null,
    currentOrder: userCustom[`${prefix}currentOrder`] ? JSON.parse(userCustom[`${prefix}currentOrder`]) : null,
    correctnessHistory: JSON.parse(userCustom[`${prefix}correctnessHistory`] || '[]')
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

    // Parse JSON fields
    return {
      gameId: custom.gameId,
      gameName: custom.gameName,
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
        description: `First Order game - Status: ${gameData.phase}`,
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
 * Add player to game (create Membership)
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} playerId - Player ID (UUID)
 * @param {string} gameId - Game ID
 * @param {string} role - Player role ('host' | 'player')
 * @returns {Promise<void>}
 */
async function addPlayerToGame(pubnub, playerId, gameId, role = 'player') {
  try {
    const channelId = `game.${gameId}`;

    await pubnub.objects.setMemberships({
      uuid: playerId,
      channels: [{
        id: channelId,
        custom: {
          role: role,
          joinedAt: Date.now()
        }
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
 * Get player's game-specific state from User custom fields
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} playerId - Player ID (UUID)
 * @param {string} gameId - Game ID
 * @returns {Promise<Object>} Player game state
 */
async function getPlayerGameState(pubnub, playerId, gameId) {
  try {
    const user = await getPlayer(pubnub, playerId);
    if (!user || !user.custom) {
      // Return default state if user doesn't exist
      return {
        moveCount: 0,
        positionsCorrect: 0,
        finished: false,
        finishTT: null,
        placement: null,
        currentOrder: null,
        correctnessHistory: []
      };
    }

    return userFieldsToPlayerGameState(gameId, user.custom);
  } catch (error) {
    console.error('[storage.getPlayerGameState] Error:', error);
    throw error;
  }
}

/**
 * Set/update player's game-specific state in User custom fields
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} playerId - Player ID (UUID)
 * @param {string} gameId - Game ID
 * @param {Object} gameState - Player game state
 * @returns {Promise<void>}
 */
async function setPlayerGameState(pubnub, playerId, gameId, gameState) {
  try {
    // Get existing user data
    const user = await getPlayer(pubnub, playerId);
    const existingCustom = user?.custom || {};

    // Merge game state fields into custom
    const gameFields = playerGameStateToUserFields(gameId, gameState);
    const updatedCustom = {
      ...existingCustom,
      ...gameFields
    };

    // Update user metadata
    await pubnub.objects.setUUIDMetadata({
      uuid: playerId,
      data: {
        name: user?.name || playerId,
        custom: updatedCustom
      }
    });
  } catch (error) {
    console.error('[storage.setPlayerGameState] Error:', error);
    throw error;
  }
}

/**
 * Delete player's game-specific state from User custom fields
 * @param {PubNub} pubnub - PubNub instance
 * @param {string} playerId - Player ID (UUID)
 * @param {string} gameId - Game ID
 * @returns {Promise<void>}
 */
async function deletePlayerGameState(pubnub, playerId, gameId) {
  try {
    const user = await getPlayer(pubnub, playerId);
    if (!user || !user.custom) {
      return; // Nothing to delete
    }

    // Remove all game-specific fields
    const prefix = `game_${gameId}_`;
    const updatedCustom = {};

    for (const [key, value] of Object.entries(user.custom)) {
      if (!key.startsWith(prefix)) {
        updatedCustom[key] = value;
      }
    }

    // Update user metadata without game fields
    await pubnub.objects.setUUIDMetadata({
      uuid: playerId,
      data: {
        name: user.name,
        custom: updatedCustom
      }
    });
  } catch (error) {
    console.error('[storage.deletePlayerGameState] Error:', error);
    throw error;
  }
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
        try {
          playerLocations[playerId] = JSON.parse(member.uuid.custom.playerLocation);
        } catch (e) {
          playerLocations[playerId] = null;
        }
      }

      players[playerId] = {
        playerId,
        ...playerGameState
      };

      if (playerGameState.finished && playerGameState.placement) {
        placements.push({
          playerId,
          playerName,
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
