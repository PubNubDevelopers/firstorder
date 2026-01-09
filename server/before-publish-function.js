/**
 * Swap It! - Before Publish Function
 *
 * Handles game logic during play on PubNub Functions
 * Bound to channel pattern: game.*
 *
 * This function processes:
 * - MOVE_SUBMIT: Validates moves, updates state, checks for winner
 */

export default (request) => {
  const pubnub = require('pubnub');

  const message = request.message;
  const channel = request.channels[0];

  // Extract gameId from channel (format: game.[gameId])
  const gameId = channel.split('.')[1];

  if (!gameId) {
    console.log('Invalid channel format:', channel);
    return request.ok();
  }

  // Route based on message type
  if (message.type === 'MOVE_SUBMIT') {
    return handleMoveSubmit(message, gameId, request, pubnub);
  } else if (message.type === 'PROGRESS_UPDATE') {
    // Allow progress updates to pass through
    return request.ok();
  }

  // Unknown message type, allow it through
  return request.ok();
};

/**
 * Handle MOVE_SUBMIT message
 * Validates move, updates state, checks for winner
 * v3.0.0: Uses User objects for player game state
 */
function handleMoveSubmit(message, gameId, request, pubnub) {
  const { playerId, order } = message;
  const channelId = `game.${gameId}`;

  // Validate order is a valid permutation
  if (!isValidOrder(order)) {
    console.log('Invalid order submitted');
    return request.ok();
  }

  // 1. Load game metadata from Channel custom fields
  return pubnub.objects.getChannelMetadata({
    channel: channelId,
    include: { customFields: true }
  }).then((gameResponse) => {
    console.log('=== MOVE SUBMIT DEBUG (v3.0.0) ===');

    if (!gameResponse.data || !gameResponse.data.custom) {
      console.log('Game not found in App Context');
      return request.ok();
    }

    const gameCustom = gameResponse.data.custom;
    const phase = gameCustom.phase || gameResponse.data.status;

    console.log('Game phase:', phase);
    console.log('Player ID:', playerId);
    console.log('Submitted order:', JSON.stringify(order));

    // Ignore if game not LIVE
    if (phase !== 'LIVE') {
      console.log('Game not in LIVE state - aborting');
      return request.ok();
    }

    // Parse goalOrder from custom field
    const goalOrder = JSON.parse(gameCustom.goalOrder);
    console.log('Goal order:', JSON.stringify(goalOrder));

    // 2. Get player game state from Membership custom fields
    return pubnub.objects.getMemberships({
      uuid: playerId,
      include: { customFields: true },
      filter: `channel.id == '${channelId}'`
    }).then((membershipResponse) => {
      if (!membershipResponse.data || membershipResponse.data.length === 0) {
        console.log('Player membership not found - aborting');
        return request.ok();
      }

      const membership = membershipResponse.data[0];
      const membershipCustom = membership.custom || {};

      // Extract player game state from Membership
      const currentMoveCount = membershipCustom.moveCount || 0;
      const correctnessHistory = JSON.parse(membershipCustom.correctnessHistory || '[]');

      // Calculate positions correct
      const positionsCorrect = calculatePositionsCorrect(order, goalOrder);
      console.log('Positions correct:', positionsCorrect);

      // Update player game state
      const newMoveCount = currentMoveCount + 1;
      correctnessHistory.push(positionsCorrect);

      const moveTT = Date.now().toString();

      // 3. Save updated player game state to Membership custom fields
      const updatedMembershipCustom = {
        ...membershipCustom,
        moveCount: newMoveCount,
        positionsCorrect: positionsCorrect,
        currentOrder: JSON.stringify(order),
        correctnessHistory: JSON.stringify(correctnessHistory)
      };

      return pubnub.objects.setMemberships({
        uuid: playerId,
        channels: [{
          id: channelId,
          custom: updatedMembershipCustom
        }]
      }).then(() => {
        // Check for winner - all positions must be correct
        const tileCount = Object.keys(goalOrder).length;
        if (positionsCorrect === tileCount) {
          // Handle win
          return handleWin(gameId, playerId, moveTT, newMoveCount, positionsCorrect, gameCustom, pubnub, request);
        }

        // Publish PROGRESS_UPDATE to game channel
        const progressMessage = {
          v: 1,
          type: 'PROGRESS_UPDATE',
          gameId: gameId,
          playerId: playerId,
          moveCount: newMoveCount,
          positionsCorrect: positionsCorrect,
          moveTT: moveTT
        };
        console.log('Publishing PROGRESS_UPDATE:', JSON.stringify(progressMessage));

        return pubnub.publish({
          channel: `game.${gameId}`,
          message: progressMessage
        }).then(() => {
          console.log('PROGRESS_UPDATE published successfully');
          // Abort the original MOVE_SUBMIT
          return request.abort();
        });
      });
    });
  }).catch((error) => {
    console.error('Error processing move:', error);
    return request.ok();
  });
}

/**
 * Handle win condition
 * Track placement and publish PLAYER_FINISHED, optionally GAME_OVER
 * v3.0.0: Updates User object fields and Channel metadata
 */
function handleWin(gameId, playerId, moveTT, moveCount, positionsCorrect, gameCustom, pubnub, request) {
  const channelId = `game.${gameId}`;

  // 1. Get player name from User object
  return pubnub.objects.getUUIDMetadata({
    uuid: playerId
  }).then((playerResponse) => {
    const playerName = playerResponse.data.name || `Player ${playerId.slice(-4)}`;

    // 2. Query Channel members to get finished players from Membership custom fields
    return pubnub.objects.getChannelMembers({
      channel: channelId,
      include: { UUIDFields: true, customFields: true }
    }).then((membersResponse) => {
      const members = membersResponse.data || [];

      // Extract finished players from Membership custom fields
      const playerStates = members.map(member => {
        const membershipCustom = member.custom || {};
        return {
          uuid: member.uuid.id,
          name: member.uuid.name,
          finished: membershipCustom.finished || false,
          placement: membershipCustom.placement || null,
          finishTT: membershipCustom.finishTT || null,
          moveCount: membershipCustom.moveCount || 0
        };
      });

      // Calculate current placement (count existing finished players + 1)
      const finishedPlayers = playerStates.filter(p => p.finished);
      const currentPlacement = finishedPlayers.length + 1;

      console.log('Player finishing - placement:', currentPlacement);

      // 3. Update this player's Membership with finished status
      return pubnub.objects.getMemberships({
        uuid: playerId,
        include: { customFields: true },
        filter: `channel.id == '${channelId}'`
      }).then(membershipResp => {
        const membership = membershipResp.data[0];
        const membershipCustom = membership.custom || {};

        const updatedMembershipCustom = {
          ...membershipCustom,
          finished: true,
          finishTT: moveTT,
          placement: currentPlacement
        };

        return pubnub.objects.setMemberships({
          uuid: playerId,
          channels: [{
            id: channelId,
            custom: updatedMembershipCustom
          }]
        });
      }).then(() => {
          // 4. Check if this is first-place winner (update Channel metadata)
          const isFirstPlace = currentPlacement === 1;
          let updateChannelPromise = Promise.resolve();

          if (isFirstPlace) {
            updateChannelPromise = pubnub.objects.setChannelMetadata({
              channel: channelId,
              data: {
                custom: {
                  ...gameCustom,
                  winnerPlayerId: playerId,
                  winnerName: playerName,
                  winTT: moveTT
                }
              }
            });
          }

          return updateChannelPromise.then(() => {
            // 5. Check if all placements filled
            const placementCount = gameCustom.placementCount || 1;
            const allPlacementsFilled = (finishedPlayers.length + 1) >= placementCount;

            console.log('Placements filled:', finishedPlayers.length + 1, '/', placementCount);

            // 6. If all placements filled, mark game as OVER
            const endTT = Date.now().toString();
            let gameOverPromise = Promise.resolve();
            if (allPlacementsFilled) {
              gameOverPromise = pubnub.objects.setChannelMetadata({
                channel: channelId,
                data: {
                  status: 'OVER',
                  custom: {
                    ...gameCustom,
                    phase: 'OVER',
                    endTT: endTT,
                    lockedTT: endTT,
                    winnerPlayerId: isFirstPlace ? playerId : gameCustom.winnerPlayerId,
                    winnerName: isFirstPlace ? playerName : gameCustom.winnerName,
                    winTT: isFirstPlace ? moveTT : gameCustom.winTT
                  }
                }
              });
            }

            return gameOverPromise.then(() => {
              // 7. Publish PROGRESS_UPDATE first
              return pubnub.publish({
                channel: `game.${gameId}`,
                message: {
                  v: 1,
                  type: 'PROGRESS_UPDATE',
                  gameId: gameId,
                  playerId: playerId,
                  moveCount: moveCount,
                  positionsCorrect: positionsCorrect,
                  moveTT: moveTT
                }
              }).then(() => {
                // 8. Build placements array from User objects
                const placements = [...finishedPlayers, {
                  uuid: playerId,
                  name: playerName,
                  finished: true,
                  placement: currentPlacement,
                  finishTT: moveTT,
                  moveCount: moveCount
                }].sort((a, b) => a.placement - b.placement).map(p => ({
                  playerId: p.uuid,
                  playerName: p.name,
                  placement: p.placement,
                  finishTT: p.finishTT,
                  moveCount: p.moveCount
                }));

                // 9. Publish PLAYER_FINISHED
                return pubnub.publish({
                  channel: `admin.${gameId}`,
                  message: {
                    v: 1,
                    type: 'PLAYER_FINISHED',
                    gameId: gameId,
                    playerId: playerId,
                    playerName: playerName,
                    placement: currentPlacement,
                    moveCount: moveCount,
                    finishTT: moveTT,
                    placements: placements,
                    allPlacementsFilled: allPlacementsFilled
                  }
                }).then(() => {
                  // 10. If all placements filled, publish GAME_OVER
                  if (allPlacementsFilled) {
                    const goalOrder = JSON.parse(gameCustom.goalOrder);
                    return pubnub.publish({
                      channel: `admin.${gameId}`,
                      message: {
                        v: 1,
                        type: 'GAME_OVER',
                        gameId: gameId,
                        phase: 'OVER',
                        placements: placements,
                        goalOrder: goalOrder,
                        endTT: endTT,
                        // Backward compatibility
                        winnerPlayerId: isFirstPlace ? playerId : gameCustom.winnerPlayerId,
                        winnerName: isFirstPlace ? playerName : gameCustom.winnerName,
                        winTT: isFirstPlace ? moveTT : gameCustom.winTT
                      }
                    });
                  }
                });
              });
            });
          });
        });
      }).then(() => {
        console.log('Player finished successfully');
        // Abort the original MOVE_SUBMIT message
        return request.abort();
      });
    });
  }).catch(error => {
    console.error('Error handling win:', error);
    return request.ok();
  });
}

/**
 * Calculate number of positions that match goal
 */
function calculatePositionsCorrect(order, goalOrder) {
  let correct = 0;
  // Dynamically determine tile count from goalOrder
  const tileCount = Object.keys(goalOrder).length;
  const positions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].slice(0, tileCount);

  for (let pos of positions) {
    if (order[pos] === goalOrder[pos]) {
      correct++;
    }
  }

  return correct;
}

/**
 * Validate order is a valid permutation for variable tile counts
 */
function isValidOrder(order) {
  if (!order || typeof order !== 'object') return false;

  // Dynamically determine tile count from order
  const tileCount = Object.keys(order).length;
  if (tileCount < 4 || tileCount > 8) return false;

  const positions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].slice(0, tileCount);
  const values = [];

  for (let pos of positions) {
    if (!(pos in order)) return false;
    const val = order[pos];
    if (typeof val !== 'number' || val < 0 || val >= tileCount) return false;
    if (values.includes(val)) return false; // Duplicate
    values.push(val);
  }

  return values.length === tileCount;
}
