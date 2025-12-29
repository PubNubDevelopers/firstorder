/**
 * Swap It! - On Request Function
 *
 * HTTP endpoint for all game management operations
 *
 * Endpoint: POST /game_master?operation=<operation>
 * Operations:
 *   - create_game: Creates a new game with initial player
 *   - join_game: Adds a player to an existing game
 *   - start_game: Starts the game (CREATED → LIVE)
 *   - update_game_name: Update game name (host only, CREATED phase)
 */

/**
 * Emoji themes - 10 themes with 12 emojis each
 */
const EMOJI_THEMES = {
  food: ['🍕', '🍔', '🍟', '🌮', '🍣', '🍜', '🍰', '🍪', '🍩', '🥗', '🍇', '🍌'],
  animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮'],
  sports: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🏒', '🥊'],
  transport: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '✈️'],
  nature: ['🌸', '🌺', '🌻', '🌷', '🌹', '🌲', '🌳', '🌴', '🍀', '🌿', '🍁', '🌾'],
  music: ['🎸', '🎹', '🎺', '🎷', '🎻', '🥁', '🎤', '🎧', '🎼', '🎵', '🎶', '🎪'],
  space: ['🚀', '🛸', '🌍', '🌎', '🌏', '🌙', '⭐', '🌟', '💫', '✨', '☄️', '🪐'],
  weather: ['☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '🌈'],
  faces: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇'],
  objects: ['⚽', '🎁', '🎈', '🎉', '🎊', '🎀', '🔑', '💎', '📱', '💻', '⌚', '📷']
};

export default (request) => {
  const pubnub = require('pubnub');
  const db = require('kvstore');

  const operation = request.params.operation;

  // Parse body - PubNub sends it as a string that needs to be parsed
  let body;
  try {
    body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  } catch (e) {
    return Promise.resolve({
      status: 400,
      body: { error: 'Invalid JSON in request body' }
    });
  }

  // Route based on operation
  if (operation === 'create_game') {
    return createGame(body, db, pubnub);
  } else if (operation === 'join_game') {
    return joinGame(body, db, pubnub);
  } else if (operation === 'start_game') {
    return startGame(body, db, pubnub);
  } else if (operation === 'get_game') {
    return getGame(body, db);
  } else if (operation === 'list_games') {
    return listGames(body, db);
  } else if (operation === 'leave_game') {
    return leaveGame(body, db, pubnub);
  } else if (operation === 'update_game_name') {
    return updateGameName(body, db, pubnub);
  } else if (operation === 'clear_games') {
    return clearGames(db, pubnub);
  }

  return Promise.resolve({
    status: 400,
    body: { error: 'Invalid operation. Use: create_game, join_game, start_game, get_game, list_games, leave_game, update_game_name, or clear_games' }
  });
};

/**
 * Create a new game
 *
 * Expected body:
 * {
 *   "playerId": "player-uuid",
 *   "playerName": "Player Name",
 *   "options": {
 *     "tileCount": 5,
 *     "emojiTheme": "food",
 *     "maxPlayers": 1,
 *     "gameName": "My Game" | null
 *   },
 *   "location": { country, countryCode, region, regionName, city }
 * }
 *
 * Returns:
 * {
 *   "success": true,
 *   "gameId": "A7K2Q9XJ",
 *   "phase": "CREATED"
 * }
 */
function createGame(body, db, pubnub) {
  const { playerId, playerName, options, location } = body;

  if (!playerId) {
    return Promise.resolve({
      status: 400,
      body: { error: 'Missing playerId' }
    });
  }

  // Validate game options
  const validation = validateGameOptions(options);
  if (!validation.valid) {
    return Promise.resolve({
      status: 400,
      body: { error: validation.error }
    });
  }

  // Generate unique 8-character game ID
  const gameId = generateGameId();
  const gameKey = `swapit:game:${gameId}`;

  // Create new game state with options
  const gameState = {
    gameId: gameId,
    phase: 'CREATED',
    gameName: options.gameName || null,
    tileCount: options.tileCount,
    emojiTheme: options.emojiTheme,
    maxPlayers: options.maxPlayers,
    players: {
      [playerId]: {
        playerId: playerId,
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

  // Store game state
  return db.set(gameKey, gameState).then(() => {
    // Add game to active games index
    const activeGamesKey = 'swapit:games:active';
    return db.get(activeGamesKey).then((activeGames) => {
      const games = activeGames || [];
      games.push(gameId);
      return db.set(activeGamesKey, games);
    }).then(() => {
      // Publish PLAYER_JOINED to admin channel for initial player
      const adminChannel = `admin.${gameId}`;
      return pubnub.publish({
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
    }).then(() => {
      // Publish GAME_CREATED to lobby channel
      return pubnub.publish({
        channel: 'lobby',
        message: {
          v: 1,
          type: 'GAME_CREATED',
          gameId: gameId,
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
    }).then(() => {
      return {
        status: 200,
        body: {
          success: true,
          gameId: gameId,
          gameName: gameState.gameName,
          phase: 'CREATED',
          players: gameState.playerIds
        }
      };
    }).catch((error) => {
      console.error('Error publishing game events:', error);
      return {
        status: 500,
        body: { error: 'Failed to publish game events' }
      };
    });
  }).catch((error) => {
    console.error('Error creating game:', error);
    return {
      status: 500,
      body: { error: 'Failed to create game' }
    };
  });
}

/**
 * Join an existing game
 *
 * Expected body:
 * {
 *   "gameId": "A7K2Q9XJ",
 *   "playerId": "player-uuid",
 *   "playerName": "Player Name",
 *   "location": { country, countryCode, region, regionName, city }
 * }
 *
 * Returns:
 * {
 *   "success": true,
 *   "gameId": "A7K2Q9XJ",
 *   "players": ["player1", "player2"]
 * }
 */
function joinGame(body, db, pubnub) {
  const { gameId, playerId, playerName, location } = body;

  if (!gameId || !playerId) {
    return Promise.resolve({
      status: 400,
      body: { error: 'Missing gameId or playerId' }
    });
  }

  const gameKey = `swapit:game:${gameId}`;

  return db.get(gameKey).then((game) => {
    if (!game) {
      return {
        status: 404,
        body: { error: 'Game not found' }
      };
    }

    // Check if game has already started
    if (game.phase !== 'CREATED') {
      return {
        status: 403,
        body: { error: 'Cannot join game that has already started' }
      };
    }

    // Check if player already joined
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

    // Check if game is full
    const maxPlayers = game.maxPlayers || 99;
    if (game.playerIds.length >= maxPlayers) {
      return {
        status: 403,
        body: { error: `Game is full (max ${maxPlayers} players)` }
      };
    }

    // Add player to game
    game.players[playerId] = {
      playerId: playerId,
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
      if (!game.playerNames) {
        game.playerNames = {};
      }
      game.playerNames[playerId] = playerName;
    }

    // Add player location if provided
    if (location) {
      if (!game.playerLocations) {
        game.playerLocations = {};
      }
      game.playerLocations[playerId] = location;
    }

    // Update game state
    return db.set(gameKey, game).then(() => {
      // Publish PLAYER_JOINED to admin channel
      const adminChannel = `admin.${gameId}`;
      return pubnub.publish({
        channel: adminChannel,
        message: {
          v: 1,
          type: 'PLAYER_JOINED',
          gameId: gameId,
          playerId: playerId,
          playerIds: game.playerIds,
          playerNames: game.playerNames
        }
      }).then(() => {
        // Also publish to lobby channel
        return pubnub.publish({
          channel: 'lobby',
          message: {
            v: 1,
            type: 'PLAYER_JOINED_GAME',
            gameId: gameId,
            playerId: playerId,
            playerIds: game.playerIds,
            playerNames: game.playerNames,
            playerLocations: game.playerLocations || {},
            playerCount: game.playerIds.length
          }
        });
      }).then(() => {
        return {
          status: 200,
          body: {
            success: true,
            gameId: gameId,
            phase: game.phase,
            players: game.playerIds
          }
        };
      }).catch((error) => {
        console.error('Error publishing player joined events:', error);
        return {
          status: 500,
          body: { error: 'Failed to publish player joined event' }
        };
      });
    }).catch((error) => {
      console.error('Error joining game:', error);
      return {
        status: 500,
        body: { error: 'Failed to join game' }
      };
    });
  }).catch((error) => {
    console.error('Error loading game:', error);
    return {
      status: 500,
      body: { error: 'Database error' }
    };
  });
}

/**
 * Start the game (CREATED → LIVE)
 *
 * Expected body:
 * {
 *   "gameId": "A7K2Q9XJ",
 *   "playerId": "player-uuid"
 * }
 *
 * Returns:
 * {
 *   "success": true,
 *   "gameId": "A7K2Q9XJ",
 *   "phase": "LIVE"
 * }
 */
function startGame(body, db, pubnub) {
  const { gameId, playerId } = body;

  if (!gameId || !playerId) {
    return Promise.resolve({
      status: 400,
      body: { error: 'Missing gameId or playerId' }
    });
  }

  const gameKey = `swapit:game:${gameId}`;

  return db.get(gameKey).then((game) => {
    if (!game) {
      return {
        status: 404,
        body: { error: 'Game not found' }
      };
    }

    // Check if game is in CREATED state
    if (game.phase !== 'CREATED') {
      return {
        status: 403,
        body: { error: 'Game already started or finished' }
      };
    }

    // Verify player is in roster
    if (!game.playerIds.includes(playerId)) {
      return {
        status: 403,
        body: { error: 'Player not in game roster' }
      };
    }

    // Get game options with defaults for backward compatibility
    const tileCount = game.tileCount || 4;
    const emojiTheme = game.emojiTheme || 'food';

    // Generate emoji tiles from theme
    const emojis = selectEmojisFromTheme(emojiTheme, tileCount);
    const tiles = {};
    for (let i = 0; i < tileCount; i++) {
      tiles[i.toString()] = emojis[i];
    }

    // Generate goal order (random permutation)
    const goalOrder = generateDynamicGoalOrder(tileCount);

    // Generate initial order with 0 positions correct
    const initialOrder = generateDynamicInitialOrder(goalOrder, tileCount);

    // Update all player records with initial order
    for (const pid of game.playerIds) {
      game.players[pid].currentOrder = initialOrder;
      game.players[pid].moveCount = 0;
      game.players[pid].positionsCorrect = 0;
      game.players[pid].correctnessHistory = [];
    }

    // Set phase to LIVE - client will handle countdown display but game is live
    game.phase = 'LIVE';
    game.tiles = tiles;
    game.goalOrder = goalOrder;
    game.initialOrder = initialOrder;
    game.startTT = Date.now().toString();

    return db.set(gameKey, game).then(() => {
      console.log('Game initialized and set to LIVE');

      // Remove game from active games index
      const activeGamesKey = 'swapit:games:active';
      return db.get(activeGamesKey).then((activeGames) => {
        const games = (activeGames || []).filter(id => id !== gameId);
        return db.set(activeGamesKey, games);
      }).then(() => {
        // Publish GAME_STARTED to lobby channel
        return pubnub.publish({
          channel: 'lobby',
          message: {
            v: 1,
            type: 'GAME_STARTED',
            gameId: gameId
          }
        });
      }).then(() => {
        return {
          status: 200,
          body: {
            success: true,
            gameId: gameId,
            phase: 'LIVE',
            tiles: tiles,
            initialOrder: initialOrder,
            goalOrder: goalOrder  // Include for testing
          }
        };
      });
    }).catch((error) => {
      console.error('Error updating game state:', error);
      return {
        status: 500,
        body: { error: 'Failed to start game' }
      };
    });
  }).catch((error) => {
    console.error('Error loading game:', error);
    return {
      status: 500,
      body: { error: 'Database error' }
    };
  });
}

/**
 * Generate a random 8-character game ID
 */
function generateGameId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let gameId = '';
  for (let i = 0; i < 8; i++) {
    gameId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return gameId;
}

/**
 * Generate a random goal order (permutation of 0-3)
 */
function generateGoalOrder() {
  const values = [0, 1, 2, 3];

  // Fisher-Yates shuffle
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  return {
    a: values[0],
    b: values[1],
    c: values[2],
    d: values[3]
  };
}

/**
 * Generate initial order with 0 positions correct
 */
function generateInitialOrder(goalOrder) {
  let initialOrder;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    initialOrder = generateGoalOrder(); // Generate random order
    attempts++;

    if (attempts > maxAttempts) {
      // Fallback: manually create order with 0 correct
      // If goal is {a:0, b:1, c:2, d:3}, use {a:1, b:0, c:3, d:2}
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

/**
 * Calculate number of positions that match goal
 */
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

/**
 * Select random emojis from a theme
 * @param {string} themeKey - Theme key (e.g., 'food', 'animals')
 * @param {number} count - Number of emojis to select (4-8)
 * @returns {Array<string>} Array of emoji strings
 */
function selectEmojisFromTheme(themeKey, count) {
  const theme = EMOJI_THEMES[themeKey];
  if (!theme) return null;

  // Fisher-Yates shuffle
  const shuffled = [...theme].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Generate position letters for variable tile counts
 * @param {number} tileCount - Number of tiles (4-8)
 * @returns {Array<string>} Array of position letters
 */
function generatePositions(tileCount) {
  const positions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  return positions.slice(0, tileCount);
}

/**
 * Generate a random goal order for variable tile counts
 * @param {number} tileCount - Number of tiles (4-8)
 * @returns {Object} Goal order object
 */
function generateDynamicGoalOrder(tileCount) {
  const positions = generatePositions(tileCount);
  const values = Array.from({ length: tileCount }, (_, i) => i);

  // Fisher-Yates shuffle
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  const order = {};
  for (let i = 0; i < tileCount; i++) {
    order[positions[i]] = values[i];
  }

  return order;
}

/**
 * Generate initial order with 0 positions correct for variable tile counts
 * @param {Object} goalOrder - Goal order object
 * @param {number} tileCount - Number of tiles (4-8)
 * @returns {Object} Initial order object
 */
function generateDynamicInitialOrder(goalOrder, tileCount) {
  let initialOrder;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    initialOrder = generateDynamicGoalOrder(tileCount);
    attempts++;

    if (attempts > maxAttempts) {
      // Fallback: create order with 0 correct by swapping pairs
      const positions = generatePositions(tileCount);
      initialOrder = {};

      // Swap adjacent pairs
      for (let i = 0; i < tileCount - 1; i += 2) {
        initialOrder[positions[i]] = goalOrder[positions[i + 1]];
        initialOrder[positions[i + 1]] = goalOrder[positions[i]];
      }

      // Handle odd tile count
      if (tileCount % 2 === 1) {
        // Swap last with first
        const lastPos = positions[tileCount - 1];
        const firstPos = positions[0];
        initialOrder[lastPos] = goalOrder[firstPos];
        initialOrder[firstPos] = goalOrder[lastPos];
      }
      break;
    }
  } while (calculateDynamicPositionsCorrect(initialOrder, goalOrder, tileCount) !== 0);

  return initialOrder;
}

/**
 * Calculate number of positions that match goal for variable tile counts
 * @param {Object} order - Current order object
 * @param {Object} goalOrder - Goal order object
 * @param {number} tileCount - Number of tiles (4-8)
 * @returns {number} Number of correct positions
 */
function calculateDynamicPositionsCorrect(order, goalOrder, tileCount) {
  let correct = 0;
  const positions = generatePositions(tileCount);

  for (let pos of positions) {
    if (order[pos] === goalOrder[pos]) {
      correct++;
    }
  }

  return correct;
}

/**
 * Validate game options
 * @param {Object} options - Game options object
 * @returns {Object} Validation result { valid: boolean, error?: string }
 */
function validateGameOptions(options) {
  const { tileCount, emojiTheme, maxPlayers, gameName } = options || {};

  if (!tileCount || tileCount < 4 || tileCount > 8) {
    return { valid: false, error: 'Tile count must be between 4 and 8' };
  }

  const validThemes = Object.keys(EMOJI_THEMES);
  if (!emojiTheme || !validThemes.includes(emojiTheme)) {
    return { valid: false, error: 'Invalid emoji theme' };
  }

  if (!maxPlayers || maxPlayers < 1 || maxPlayers > 99) {
    return { valid: false, error: 'Max players must be between 1 and 99' };
  }

  if (gameName && gameName.length > 30) {
    return { valid: false, error: 'Game name too long (max 30 characters)' };
  }

  return { valid: true };
}

/**
 * Get current game state
 *
 * Expected body:
 * {
 *   "gameId": "A7K2Q9XJ"
 * }
 *
 * Returns:
 * {
 *   "success": true,
 *   "gameId": "A7K2Q9XJ",
 *   "phase": "CREATED" | "LIVE" | "LOCKED",
 *   "playerIds": ["player1", "player2"],
 *   "tiles": {...},         // Only if LIVE or LOCKED
 *   "initialOrder": {...},  // Only if LIVE or LOCKED
 *   "goalOrder": {...}      // Only if LOCKED or for creator during testing
 * }
 */
function getGame(body, db) {
  const { gameId } = body;

  if (!gameId) {
    return Promise.resolve({
      status: 400,
      body: { error: 'Missing gameId' }
    });
  }

  const gameKey = `swapit:game:${gameId}`;

  return db.get(gameKey).then((game) => {
    if (!game) {
      return {
        status: 404,
        body: { error: 'Game not found' }
      };
    }

    const response = {
      success: true,
      gameId: game.gameId,
      gameName: game.gameName || null,
      phase: game.phase,
      playerIds: game.playerIds,
      playerNames: game.playerNames || {},
      maxPlayers: game.maxPlayers || 99,
      tileCount: game.tileCount || 4,
      emojiTheme: game.emojiTheme || 'food'
    };

    // Include game data if started
    if (game.phase === 'LIVE' || game.phase === 'LOCKED') {
      response.tiles = game.tiles;
      response.initialOrder = game.initialOrder;
    }

    // Include goal order if locked
    if (game.phase === 'LOCKED') {
      response.goalOrder = game.goalOrder;
      response.winnerPlayerId = game.winnerPlayerId;
    }

    return {
      status: 200,
      body: response
    };
  }).catch((error) => {
    console.error('Error loading game:', error);
    return {
      status: 500,
      body: { error: 'Database error' }
    };
  });
}

/**
 * List all active games (CREATED phase)
 *
 * Expected body:
 * {} (empty object)
 *
 * Returns:
 * {
 *   "success": true,
 *   "games": [
 *     {
 *       "gameId": "A7K2Q9XJ",
 *       "phase": "CREATED",
 *       "playerIds": ["player1", "player2"],
 *       "playerNames": {"player1": "Alice", "player2": "Bob"},
 *       "playerCount": 2,
 *       "createdAt": 1234567890
 *     }
 *   ]
 * }
 */
function listGames(body, db) {
  const activeGamesKey = 'swapit:games:active';

  return db.get(activeGamesKey).then((activeGameIds) => {
    const gameIds = activeGameIds || [];

    // Fetch all games in parallel
    const gamePromises = gameIds.map((gameId) => {
      const gameKey = `swapit:game:${gameId}`;
      return db.get(gameKey).then((game) => {
        if (game && game.phase === 'CREATED') {
          return {
            gameId: game.gameId,
            gameName: game.gameName || null,
            tileCount: game.tileCount || 4,
            emojiTheme: game.emojiTheme || 'food',
            maxPlayers: game.maxPlayers || 99,
            phase: game.phase,
            playerIds: game.playerIds,
            playerNames: game.playerNames || {},
            playerLocations: game.playerLocations || {},
            playerCount: game.playerIds.length,
            createdAt: game.createdAt
          };
        }
        return null;
      }).catch((error) => {
        console.error(`Error loading game ${gameId}:`, error);
        return null;
      });
    });

    return Promise.all(gamePromises).then((games) => {
      // Filter out nulls and sort by creation time (newest first)
      const validGames = games.filter((game) => game !== null);
      validGames.sort((a, b) => b.createdAt - a.createdAt);

      return {
        status: 200,
        body: {
          success: true,
          games: validGames
        }
      };
    });
  }).catch((error) => {
    console.error('Error loading active games:', error);
    return {
      status: 500,
      body: { error: 'Database error' }
    };
  });
}

/**
 * Leave a game (CREATED phase only)
 *
 * Expected body:
 * {
 *   "gameId": "A7K2Q9XJ",
 *   "playerId": "player-uuid"
 * }
 *
 * Returns:
 * {
 *   "success": true,
 *   "gameId": "A7K2Q9XJ",
 *   "playerIds": ["player1"]
 * }
 */
function leaveGame(body, db, pubnub) {
  const { gameId, playerId } = body;

  if (!gameId || !playerId) {
    return Promise.resolve({
      status: 400,
      body: { error: 'Missing gameId or playerId' }
    });
  }

  const gameKey = `swapit:game:${gameId}`;

  return db.get(gameKey).then((game) => {
    if (!game) {
      return {
        status: 404,
        body: { error: 'Game not found' }
      };
    }

    // Check if game is in CREATED state
    if (game.phase !== 'CREATED') {
      return {
        status: 403,
        body: { error: 'Cannot leave game that has already started' }
      };
    }

    // Check if player is in game
    if (!game.playerIds.includes(playerId)) {
      return {
        status: 404,
        body: { error: 'Player not in game' }
      };
    }

    // Check if leaving player is the host (first player in playerIds)
    const isHost = game.playerIds[0] === playerId;

    // If host is leaving and there are other players, cancel the game
    if (isHost && game.playerIds.length > 1) {
      // Remove from active games index
      const activeGamesKey = 'swapit:games:active';
      return db.get(activeGamesKey).then((activeGames) => {
        const games = (activeGames || []).filter((id) => id !== gameId);
        return db.set(activeGamesKey, games);
      }).then(() => {
        // Publish GAME_CANCELED to admin channel (for players in game)
        const adminChannel = `admin.${gameId}`;
        return pubnub.publish({
          channel: adminChannel,
          message: {
            v: 1,
            type: 'GAME_CANCELED',
            gameId: gameId,
            reason: 'The host has left and canceled the game.'
          }
        });
      }).then(() => {
        // Publish GAME_DELETED to lobby channel
        return pubnub.publish({
          channel: 'lobby',
          message: {
            v: 1,
            type: 'GAME_DELETED',
            gameId: gameId
          }
        });
      }).then(() => {
        // Delete the game
        return db.set(gameKey, null);
      }).then(() => {
        return {
          status: 200,
          body: {
            success: true,
            message: 'Game canceled (host left)'
          }
        };
      }).catch((error) => {
        console.error('Error canceling game:', error);
        return {
          status: 500,
          body: { error: 'Failed to cancel game' }
        };
      });
    }

    // Remove player from game
    game.playerIds = game.playerIds.filter((id) => id !== playerId);
    delete game.players[playerId];
    if (game.playerNames) {
      delete game.playerNames[playerId];
    }

    // If no players left, delete game
    if (game.playerIds.length === 0) {
      // Remove from active games index first
      const activeGamesKey = 'swapit:games:active';
      return db.get(activeGamesKey).then((activeGames) => {
        const games = (activeGames || []).filter((id) => id !== gameId);
        return db.set(activeGamesKey, games);
      }).then(() => {
        // Publish GAME_DELETED to lobby channel
        return pubnub.publish({
          channel: 'lobby',
          message: {
            v: 1,
            type: 'GAME_DELETED',
            gameId: gameId
          }
        });
      }).then(() => {
        // Delete the game by setting to null (KVStore doesn't have remove method)
        return db.set(gameKey, null);
      }).then(() => {
        return {
          status: 200,
          body: {
            success: true,
            message: 'Game deleted (no players remaining)'
          }
        };
      }).catch((error) => {
        console.error('Error deleting game:', error);
        return {
          status: 500,
          body: { error: 'Failed to delete game' }
        };
      });
    }

    // Update game state
    return db.set(gameKey, game).then(() => {
      // Publish PLAYER_LEFT to admin channel
      const adminChannel = `admin.${gameId}`;
      return pubnub.publish({
        channel: adminChannel,
        message: {
          v: 1,
          type: 'PLAYER_LEFT',
          gameId: gameId,
          playerId: playerId,
          playerIds: game.playerIds,
          playerNames: game.playerNames
        }
      });
    }).then(() => {
      // Publish PLAYER_LEFT_GAME to lobby channel
      return pubnub.publish({
        channel: 'lobby',
        message: {
          v: 1,
          type: 'PLAYER_LEFT_GAME',
          gameId: gameId,
          playerId: playerId,
          playerIds: game.playerIds,
          playerNames: game.playerNames
        }
      });
    }).then(() => {
      return {
        status: 200,
        body: {
          success: true,
          gameId: gameId,
          playerIds: game.playerIds
        }
      };
    }).catch((error) => {
      console.error('Error leaving game:', error);
      return {
        status: 500,
        body: { error: 'Failed to leave game' }
      };
    });
  }).catch((error) => {
    console.error('Error loading game:', error);
    return {
      status: 500,
      body: { error: 'Database error' }
    };
  });
}

/**
 * Update game name (host only, CREATED phase only)
 *
 * Expected body:
 * {
 *   "gameId": "A7K2Q9XJ",
 *   "playerId": "player-uuid",
 *   "gameName": "New Game Name"
 * }
 *
 * Returns:
 * {
 *   "success": true,
 *   "gameName": "New Game Name"
 * }
 */
function updateGameName(body, db, pubnub) {
  const { gameId, playerId, gameName } = body;

  if (!gameId || !playerId || !gameName) {
    return Promise.resolve({
      status: 400,
      body: { error: 'Missing required fields' }
    });
  }

  if (gameName.length > 30) {
    return Promise.resolve({
      status: 400,
      body: { error: 'Game name too long (max 30 characters)' }
    });
  }

  const gameKey = `swapit:game:${gameId}`;

  return db.get(gameKey).then((game) => {
    if (!game) {
      return {
        status: 404,
        body: { error: 'Game not found' }
      };
    }

    if (game.phase !== 'CREATED') {
      return {
        status: 403,
        body: { error: 'Cannot edit name after game started' }
      };
    }

    if (game.playerIds[0] !== playerId) {
      return {
        status: 403,
        body: { error: 'Only host can edit game name' }
      };
    }

    game.gameName = gameName.trim();

    return db.set(gameKey, game).then(() => {
      return pubnub.publish({
        channel: 'lobby',
        message: {
          v: 1,
          type: 'GAME_NAME_UPDATED',
          gameId: gameId,
          gameName: game.gameName
        }
      }).then(() => {
        return {
          status: 200,
          body: { success: true, gameName: game.gameName }
        };
      });
    });
  }).catch((error) => {
    console.error('Error updating game name:', error);
    return {
      status: 500,
      body: { error: 'Database error' }
    };
  });
}

/**
 * Clear all games from KVStore
 * Deletes all games and clears the active games index
 * @param {object} db - KVStore database
 * @param {object} pubnub - PubNub instance
 * @returns {Promise<{status: number, body: object}>}
 */
function clearGames(db, pubnub) {
  const activeGamesKey = "swapit:games:active";

  // Get all active games
  return db.get(activeGamesKey).then((activeGames) => {
    const gameIds = activeGames || [];

    if (gameIds.length === 0) {
      return {
        status: 200,
        body: {
          success: true,
          message: "No games to clear",
          gamesDeleted: 0
        }
      };
    }

    // Delete each game by setting to null
    const deletePromises = gameIds.map((gameId) => {
      const gameKey = `swapit:game:${gameId}`;
      return db.set(gameKey, null).then(() => {
        // Publish GAME_DELETED to lobby channel for each game
        return pubnub.publish({
          channel: "lobby",
          message: {
            v: 1,
            type: "GAME_DELETED",
            gameId: gameId
          }
        });
      });
    });

    // Wait for all games to be deleted
    return Promise.all(deletePromises).then(() => {
      // Clear the active games index
      return db.set(activeGamesKey, []);
    }).then(() => {
      return {
        status: 200,
        body: {
          success: true,
          message: `Cleared ${gameIds.length} game(s) from KVStore`,
          gamesDeleted: gameIds.length
        }
      };
    });
  }).catch((error) => {
    console.error("Error clearing games:", error);
    return {
      status: 500,
      body: { error: "Failed to clear games" }
    };
  });
}
