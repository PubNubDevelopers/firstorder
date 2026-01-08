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
 */
function handleMoveSubmit(message, gameId, request, pubnub) {
  const { playerId, order } = message;
  const channelId = `game.${gameId}`;

  // Validate order is a valid permutation
  if (!isValidOrder(order)) {
    console.log('Invalid order submitted');
    return request.ok();
  }

  // Load game state from App Context
  return pubnub.objects.getChannelMetadata({
    channel: channelId,
    include: { customFields: true }
  }).then((response) => {
    console.log('=== MOVE SUBMIT DEBUG ===');

    // Parse game state from custom fields
    if (!response.data || !response.data.custom || !response.data.custom.gameState) {
      console.log('Game not found in App Context');
      return request.ok();
    }

    const gameState = JSON.parse(response.data.custom.gameState);

    console.log('Game state phase:', gameState?.phase);
    console.log('Player ID:', playerId);
    console.log('Submitted order:', JSON.stringify(order));

    // Ignore if game doesn't exist or not LIVE
    if (!gameState || gameState.phase !== 'LIVE') {
      console.log('Game not in LIVE state - aborting');
      return request.ok();
    }

    // Verify player is in roster
    if (!gameState.playerIds.includes(playerId)) {
      console.log('Player not in roster - aborting');
      return request.ok();
    }

    // Get player state from game object
    const playerState = gameState.players[playerId];
    if (!playerState) {
      console.log('Player state not found - aborting');
      return request.ok();
    }

    console.log('Goal order:', JSON.stringify(gameState.goalOrder));

    // Update player state
    playerState.currentOrder = order;
    playerState.moveCount += 1;

    // Calculate positions correct
    const positionsCorrect = calculatePositionsCorrect(order, gameState.goalOrder);
    console.log('Positions correct:', positionsCorrect);

    playerState.positionsCorrect = positionsCorrect;
    playerState.correctnessHistory.push(positionsCorrect);

    const moveTT = Date.now().toString();

    // Save game state to App Context
    return pubnub.objects.setChannelMetadata({
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
    }).then(() => {
      // Check for winner - all positions must be correct
      const tileCount = Object.keys(gameState.goalOrder).length;
      if (positionsCorrect === tileCount) {
        // Handle win (publishes PROGRESS_UPDATE and GAME_OVER)
        return handleWin(gameId, playerId, moveTT, playerState, gameState, pubnub, request);
      }

      // Publish PROGRESS_UPDATE to game channel
      const progressMessage = {
        v: 1,
        type: 'PROGRESS_UPDATE',
        gameId: gameId,
        playerId: playerId,
        moveCount: playerState.moveCount,
        positionsCorrect: positionsCorrect,
        moveTT: moveTT
      };
      console.log('Publishing PROGRESS_UPDATE:', JSON.stringify(progressMessage));

      return pubnub.publish({
        channel: `game.${gameId}`,
        message: progressMessage
      }).then(() => {
        console.log('PROGRESS_UPDATE published successfully');
        // Abort the original MOVE_SUBMIT (we've published PROGRESS_UPDATE instead)
        return request.abort();
      });
    });
  }).catch((error) => {
    console.error('Error processing move:', error);
    return request.ok();
  });
}

/**
 * Handle win condition
 * Lock game and publish GAME_OVER
 */
function handleWin(gameId, playerId, moveTT, playerState, gameState, pubnub, request) {
  const channelId = `game.${gameId}`;

  // Update player finished status
  gameState.players[playerId].finished = true;
  gameState.players[playerId].finishTT = moveTT;

  // Set winner if not already set
  if (!gameState.winnerPlayerId) {
    gameState.winnerPlayerId = playerId;
    gameState.winnerName = gameState.playerNames[playerId] || `Player ${playerId.slice(-4)}`;
    gameState.winTT = moveTT;
  }

  // Mark game as over (keep for analytics)
  gameState.phase = 'OVER';
  gameState.endTT = Date.now().toString();
  gameState.lockedTT = gameState.endTT; // Keep for backward compatibility

  // Save game state to App Context
  return pubnub.objects.setChannelMetadata({
    channel: channelId,
    data: {
      name: gameState.gameName || `Game ${gameId}`,
      description: `First Order game - Status: ${gameState.phase}`,
      status: gameState.phase, // Use basic status field (will be 'OVER')
      custom: {
        gameState: JSON.stringify(gameState),
        playerCount: gameState.playerIds.length,
        createdAt: gameState.createdAt
      }
    }
  }).then(() => {
    // First publish PROGRESS_UPDATE (so client sees 4/4)
    return pubnub.publish({
      channel: `game.${gameId}`,
      message: {
        v: 1,
        type: 'PROGRESS_UPDATE',
        gameId: gameId,
        playerId: playerId,
        moveCount: playerState.moveCount,
        positionsCorrect: playerState.positionsCorrect,
        moveTT: moveTT
      }
    }).then(() => {
      // Then publish GAME_OVER to admin channel
      return pubnub.publish({
        channel: `admin.${gameId}`,
        message: {
          v: 1,
          type: 'GAME_OVER',
          gameId: gameId,
          phase: 'OVER',
          winnerPlayerId: gameState.winnerPlayerId,
          winnerName: gameState.winnerName,
          goalOrder: gameState.goalOrder,
          winTT: gameState.winTT,
          endTT: gameState.endTT
        }
      });
    }).then(() => {
      console.log('Game over - winner:', gameState.winnerPlayerId);
      // Abort the original MOVE_SUBMIT message
      return request.abort();
    });
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
