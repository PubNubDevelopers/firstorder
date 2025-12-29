/**
 * Local Development Server
 * Mimics PubNub Functions behavior for local testing
 */

const express = require('express');
const cors = require('cors');
const PubNub = require('pubnub');
const storage = require('node-persist');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize storage (mimics PubNub KV Store)
let db;
storage.init().then(() => {
  db = storage;
  console.log('✅ Storage initialized');
});

// Initialize PubNub
const pubnub = new PubNub({
  publishKey: process.env.PUBNUB_PUBLISH_KEY || 'pub-c-66ab3e60-11b7-4792-a753-92b7e510a21e',
  subscribeKey: process.env.PUBNUB_SUBSCRIBE_KEY || 'sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe',
  userId: 'local-server'
});

console.log('✅ PubNub initialized');

/**
 * On Request Function endpoint
 */
app.post('/game_master', async (req, res) => {
  const operation = req.query.operation;
  const body = req.body;

  console.log(`📥 Received ${operation} request:`, body);

  try {
    let result;

    if (operation === 'create_game') {
      result = await createGame(body);
    } else if (operation === 'join_game') {
      result = await joinGame(body);
    } else if (operation === 'start_game') {
      result = await startGame(body);
    } else if (operation === 'get_game') {
      result = await getGame(body);
    } else {
      return res.status(400).json({
        error: 'Invalid operation. Use: create_game, join_game, start_game, or get_game'
      });
    }

    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create Game
 */
async function createGame(body) {
  const { playerId, playerName } = body;

  if (!playerId) {
    return {
      status: 400,
      body: { error: 'Missing playerId' }
    };
  }

  const gameId = generateGameId();
  const gameKey = `swapit:game:${gameId}`;

  const gameState = {
    gameId: gameId,
    phase: 'CREATED',
    players: {
      [playerId]: {
        playerId: playerId,
        playerName: playerName || `Player ${playerId.slice(-4)}`,
        moveCount: 0,
        currentOrder: null,
        correctnessHistory: [],
        positionsCorrect: 0,
        finished: false,
        finishTT: null
      }
    },
    playerIds: [playerId],
    playerNames: {
      [playerId]: playerName || `Player ${playerId.slice(-4)}`
    },
    createdAt: Date.now(),
    startTT: null,
    winnerPlayerId: null,
    winTT: null,
    lockedTT: null,
    goalOrder: null,
    initialOrder: null,
    tiles: null
  };

  await db.setItem(gameKey, gameState);

  // Publish PLAYER_JOINED
  const adminChannel = `admin.${gameId}`;
  await pubnub.publish({
    channel: adminChannel,
    message: {
      v: 1,
      type: 'PLAYER_JOINED',
      gameId: gameId,
      playerId: playerId,
      playerIds: gameState.playerIds,
      playerNames: gameState.playerNames
    }
  });

  console.log(`✅ Game created: ${gameId}`);

  return {
    status: 200,
    body: {
      success: true,
      gameId: gameId,
      phase: 'CREATED',
      players: gameState.playerIds
    }
  };
}

/**
 * Join Game
 */
async function joinGame(body) {
  const { gameId, playerId, playerName } = body;

  if (!gameId || !playerId) {
    return {
      status: 400,
      body: { error: 'Missing gameId or playerId' }
    };
  }

  const gameKey = `swapit:game:${gameId}`;
  const game = await db.getItem(gameKey);

  if (!game) {
    return {
      status: 404,
      body: { error: 'Game not found' }
    };
  }

  if (game.phase !== 'CREATED') {
    return {
      status: 403,
      body: { error: 'Cannot join game that has already started' }
    };
  }

  if (game.playerIds.includes(playerId)) {
    return {
      status: 200,
      body: {
        success: true,
        gameId: gameId,
        phase: game.phase,
        players: game.playerIds,
        message: 'Player already in game'
      }
    };
  }

  const displayName = playerName || `Player ${playerId.slice(-4)}`;

  game.players[playerId] = {
    playerId: playerId,
    playerName: displayName,
    moveCount: 0,
    currentOrder: null,
    correctnessHistory: [],
    positionsCorrect: 0,
    finished: false,
    finishTT: null
  };
  game.playerIds.push(playerId);
  if (!game.playerNames) game.playerNames = {};
  game.playerNames[playerId] = displayName;

  await db.setItem(gameKey, game);

  // Publish PLAYER_JOINED
  const adminChannel = `admin.${gameId}`;
  await pubnub.publish({
    channel: adminChannel,
    message: {
      v: 1,
      type: 'PLAYER_JOINED',
      gameId: gameId,
      playerId: playerId,
      playerIds: game.playerIds,
      playerNames: game.playerNames
    }
  });

  console.log(`✅ Player joined: ${playerId} → ${gameId}`);

  return {
    status: 200,
    body: {
      success: true,
      gameId: gameId,
      phase: game.phase,
      players: game.playerIds
    }
  };
}

/**
 * Start Game
 */
async function startGame(body) {
  const { gameId, playerId } = body;

  if (!gameId || !playerId) {
    return {
      status: 400,
      body: { error: 'Missing gameId or playerId' }
    };
  }

  const gameKey = `swapit:game:${gameId}`;
  const game = await db.getItem(gameKey);

  if (!game) {
    return {
      status: 404,
      body: { error: 'Game not found' }
    };
  }

  if (game.phase !== 'CREATED') {
    return {
      status: 403,
      body: { error: 'Game already started or finished' }
    };
  }

  if (!game.playerIds.includes(playerId)) {
    return {
      status: 403,
      body: { error: 'Player not in game roster' }
    };
  }

  const emojis = ['🍕', '🚀', '🐶', '🎸'];
  const tiles = {
    '0': emojis[0],
    '1': emojis[1],
    '2': emojis[2],
    '3': emojis[3]
  };

  const goalOrder = generateGoalOrder();
  const initialOrder = generateInitialOrder(goalOrder);

  for (const pid of game.playerIds) {
    game.players[pid].currentOrder = initialOrder;
    game.players[pid].moveCount = 0;
    game.players[pid].positionsCorrect = 0;
    game.players[pid].correctnessHistory = [];
  }

  // Set phase to COUNTDOWN - client will publish countdown messages and GAME_START
  game.phase = 'COUNTDOWN';
  game.tiles = tiles;
  game.goalOrder = goalOrder;
  game.initialOrder = initialOrder;
  game.startTT = Date.now().toString();

  await db.setItem(gameKey, game);

  console.log(`✅ Game initialized for countdown: ${gameId}`);

  return {
    status: 200,
    body: {
      success: true,
      gameId: gameId,
      phase: 'COUNTDOWN',
      tiles: tiles,
      initialOrder: initialOrder,
      goalOrder: goalOrder
    }
  };
}

/**
 * Get Game
 */
async function getGame(body) {
  const { gameId } = body;

  if (!gameId) {
    return {
      status: 400,
      body: { error: 'Missing gameId' }
    };
  }

  const gameKey = `swapit:game:${gameId}`;
  const game = await db.getItem(gameKey);

  if (!game) {
    return {
      status: 404,
      body: { error: 'Game not found' }
    };
  }

  const response = {
    success: true,
    gameId: game.gameId,
    phase: game.phase,
    playerIds: game.playerIds,
    playerNames: game.playerNames || {}
  };

  if (game.phase === 'LIVE' || game.phase === 'LOCKED') {
    response.tiles = game.tiles;
    response.initialOrder = game.initialOrder;
  }

  if (game.phase === 'LOCKED') {
    response.goalOrder = game.goalOrder;
    response.winnerPlayerId = game.winnerPlayerId;
  }

  return {
    status: 200,
    body: response
  };
}

/**
 * Subscribe to game channels and handle moves
 */
pubnub.addListener({
  message: async (event) => {
    const { channel, message } = event;

    // Handle game.* channels
    if (channel.startsWith('game.')) {
      const gameId = channel.split('.')[1];

      if (message.type === 'MOVE_SUBMIT') {
        await handleMoveSubmit(message, gameId);
      }
    }

    // Handle admin.* channels
    if (channel.startsWith('admin.')) {
      const gameId = channel.split('.')[1];

      if (message.type === 'GAME_START') {
        await handleGameStart(message, gameId);
      }
    }
  }
});

// Subscribe to all game and admin channels
// Server Side Subscribe is not recommended
// We'll go with it for now but should be replaced with webhooks
pubnub.subscribe({
  channels: ['game.*', 'admin.*'],
  withPresence: false
});

/**
 * Handle Game Start
 * Updates game phase from COUNTDOWN to LIVE when client publishes GAME_START
 */
async function handleGameStart(_message, gameId) {
  const gameKey = `swapit:game:${gameId}`;

  const gameState = await db.getItem(gameKey);

  if (!gameState) {
    console.log('❌ Game not found for GAME_START');
    return;
  }

  if (gameState.phase !== 'COUNTDOWN') {
    console.log('❌ Game not in COUNTDOWN state for GAME_START');
    return;
  }

  // Update phase to LIVE
  gameState.phase = 'LIVE';
  await db.setItem(gameKey, gameState);

  console.log(`✅ Game started: ${gameId}`);
}

/**
 * Handle Move Submit
 */
async function handleMoveSubmit(message, gameId) {
  const { playerId, order } = message;
  const gameKey = `swapit:game:${gameId}`;

  if (!isValidOrder(order)) {
    console.log('❌ Invalid order submitted');
    return;
  }

  const gameState = await db.getItem(gameKey);

  if (!gameState || gameState.phase !== 'LIVE') {
    console.log('❌ Game not in LIVE state');
    return;
  }

  if (!gameState.playerIds.includes(playerId)) {
    console.log('❌ Player not in roster');
    return;
  }

  const playerState = gameState.players[playerId];
  if (!playerState) {
    console.log('❌ Player state not found');
    return;
  }

  playerState.currentOrder = order;
  playerState.moveCount += 1;

  const positionsCorrect = calculatePositionsCorrect(order, gameState.goalOrder);
  playerState.positionsCorrect = positionsCorrect;
  playerState.correctnessHistory.push(positionsCorrect);

  const moveTT = Date.now().toString();

  await db.setItem(gameKey, gameState);

  // Publish PROGRESS_UPDATE
  await pubnub.publish({
    channel: `game.${gameId}`,
    message: {
      v: 1,
      type: 'PROGRESS_UPDATE',
      gameId: gameId,
      playerId: playerId,
      moveCount: playerState.moveCount,
      positionsCorrect: positionsCorrect,
      moveTT: moveTT
    }
  });

  console.log(`✅ Move processed: ${playerId} - ${positionsCorrect}/4 correct`);

  // Check for winner
  if (positionsCorrect === 4) {
    await handleWin(gameId, playerId, moveTT, gameState);
  }
}

/**
 * Handle Win
 */
async function handleWin(gameId, playerId, moveTT, gameState) {
  const gameKey = `swapit:game:${gameId}`;

  gameState.players[playerId].finished = true;
  gameState.players[playerId].finishTT = moveTT;

  if (!gameState.winnerPlayerId) {
    gameState.winnerPlayerId = playerId;
    gameState.winTT = moveTT;
  }

  gameState.phase = 'LOCKED';
  gameState.lockedTT = Date.now().toString();

  await db.setItem(gameKey, gameState);

  // Publish GAME_OVER
  await pubnub.publish({
    channel: `admin.${gameId}`,
    message: {
      v: 1,
      type: 'GAME_OVER',
      gameId: gameId,
      phase: 'LOCKED',
      winnerPlayerId: gameState.winnerPlayerId,
      goalOrder: gameState.goalOrder,
      winTT: gameState.winTT
    }
  });

  console.log(`🏆 Game over - winner: ${gameState.winnerPlayerId}`);
}

// Utility functions
function generateGameId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let gameId = '';
  for (let i = 0; i < 8; i++) {
    gameId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return gameId;
}

function generateGoalOrder() {
  const values = [0, 1, 2, 3];
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return { a: values[0], b: values[1], c: values[2], d: values[3] };
}

function generateInitialOrder(goalOrder) {
  let initialOrder;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    initialOrder = generateGoalOrder();
    attempts++;

    if (attempts > maxAttempts) {
      initialOrder = {
        a: goalOrder.b,
        b: goalOrder.a,
        c: goalOrder.d,
        d: goalOrder.c
      };
      break;
    }
  } while (calculatePositionsCorrect(initialOrder, goalOrder) !== 0);

  return initialOrder;
}

function calculatePositionsCorrect(order, goalOrder) {
  let correct = 0;
  const positions = ['a', 'b', 'c', 'd'];
  for (let pos of positions) {
    if (order[pos] === goalOrder[pos]) {
      correct++;
    }
  }
  return correct;
}

function isValidOrder(order) {
  if (!order || typeof order !== 'object') return false;
  const positions = ['a', 'b', 'c', 'd'];
  const values = [];
  for (let pos of positions) {
    if (!(pos in order)) return false;
    const val = order[pos];
    if (typeof val !== 'number' || val < 0 || val > 3) return false;
    if (values.includes(val)) return false;
    values.push(val);
  }
  return values.length === 4;
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Local Swap It! server running on http://localhost:${PORT}`);
  console.log(`📡 Endpoint: http://localhost:${PORT}/game_master`);
  console.log(`\n💡 Update your .env file:`);
  console.log(`   VITE_PUBNUB_FUNCTION_URL=http://localhost:${PORT}/game_master\n`);
});
