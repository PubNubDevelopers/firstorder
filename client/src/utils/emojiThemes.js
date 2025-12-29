/**
 * Emoji theme definitions for game creation
 */

export const EMOJI_THEMES = {
  food: {
    name: 'Food',
    emojis: ['🍕', '🍔', '🍟', '🌮', '🍣', '🍜', '🍰', '🍪', '🍩', '🥗', '🍇', '🍌']
  },
  animals: {
    name: 'Animals',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮']
  },
  sports: {
    name: 'Sports',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🏒', '🥊']
  },
  transport: {
    name: 'Transport',
    emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '✈️']
  },
  nature: {
    name: 'Nature',
    emojis: ['🌸', '🌺', '🌻', '🌷', '🌹', '🌲', '🌳', '🌴', '🍀', '🌿', '🍁', '🌾']
  },
  music: {
    name: 'Music',
    emojis: ['🎸', '🎹', '🎺', '🎷', '🎻', '🥁', '🎤', '🎧', '🎼', '🎵', '🎶', '🎪']
  },
  space: {
    name: 'Space',
    emojis: ['🚀', '🛸', '🌍', '🌎', '🌏', '🌙', '⭐', '🌟', '💫', '✨', '☄️', '🪐']
  },
  weather: {
    name: 'Weather',
    emojis: ['☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '🌈']
  },
  faces: {
    name: 'Faces',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇']
  },
  objects: {
    name: 'Objects',
    emojis: ['⚽', '🎁', '🎈', '🎉', '🎊', '🎀', '🔑', '💎', '📱', '💻', '⌚', '📷']
  }
};

/**
 * Select random emojis from a theme
 * @param {string} themeKey - The theme key
 * @param {number} count - Number of emojis to select
 * @returns {string[]|null} Array of emojis or null if theme not found
 */
export function selectEmojisFromTheme(themeKey, count) {
  const theme = EMOJI_THEMES[themeKey];
  if (!theme) return null;

  const shuffled = [...theme.emojis].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get all theme keys
 * @returns {string[]} Array of theme keys
 */
export function getThemeKeys() {
  return Object.keys(EMOJI_THEMES);
}
