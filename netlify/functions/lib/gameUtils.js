/**
 * Game utility functions shared across operations
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

/**
 * Generate a random 8-character game ID
 * @returns {string} Game ID
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
 * Validate game options
 * @param {Object} options - Game options
 * @returns {{valid: boolean, error?: string}}
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

  if (!maxPlayers || maxPlayers < 1 || maxPlayers > 10) {
    return { valid: false, error: 'Max players must be between 1 and 10' };
  }

  if (gameName && gameName.length > 30) {
    return { valid: false, error: 'Game name too long (max 30 characters)' };
  }

  return { valid: true };
}

/**
 * Select emojis from a theme
 * @param {string} themeKey - Theme key
 * @param {number} count - Number of emojis to select
 * @returns {Array<string>|null} Array of emojis or null if invalid theme
 */
function selectEmojisFromTheme(themeKey, count) {
  const theme = EMOJI_THEMES[themeKey];
  if (!theme) return null;

  const shuffled = [...theme].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Generate goal order with random permutation
 * @param {number} tileCount - Number of tiles
 * @returns {Object} Goal order object
 */
function generateGoalOrder(tileCount) {
  const positions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
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
 * Calculate positions correct between two orders
 * @param {Object} order - Current order
 * @param {Object} goalOrder - Goal order
 * @returns {number} Number of correct positions
 */
function calculatePositionsCorrect(order, goalOrder) {
  if (!order || !goalOrder) return 0;

  let correct = 0;
  const tileCount = Object.keys(goalOrder).length;
  const positions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].slice(0, tileCount);

  for (const pos of positions) {
    if (order[pos] === goalOrder[pos]) {
      correct++;
    }
  }

  return correct;
}

/**
 * Generate initial order with 0 positions correct
 * @param {Object} goalOrder - Goal order to differ from
 * @param {number} tileCount - Number of tiles
 * @returns {Object} Initial order object
 */
function generateInitialOrder(goalOrder, tileCount) {
  const positions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].slice(0, tileCount);
  const values = Object.values(goalOrder);

  let attempts = 0;
  const maxAttempts = 1000;

  while (attempts < maxAttempts) {
    // Shuffle values
    const shuffled = [...values].sort(() => Math.random() - 0.5);

    // Create order
    const order = {};
    for (let i = 0; i < tileCount; i++) {
      order[positions[i]] = shuffled[i];
    }

    // Check if 0 positions correct
    if (calculatePositionsCorrect(order, goalOrder) === 0) {
      return order;
    }

    attempts++;
  }

  // Fallback: force 0 correct by rotating
  const order = {};
  for (let i = 0; i < tileCount; i++) {
    order[positions[i]] = values[(i + 1) % tileCount];
  }

  return order;
}

module.exports = {
  EMOJI_THEMES,
  generateGameId,
  validateGameOptions,
  selectEmojisFromTheme,
  generateGoalOrder,
  generateInitialOrder,
  calculatePositionsCorrect
};
