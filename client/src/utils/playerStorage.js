/**
 * Player UUID and profile management using localStorage
 */

const PLAYER_UUID_KEY = 'swapit:player:uuid';
const PLAYER_NAME_KEY = 'swapit:player:name';
const PLAYER_LOCATION_KEY = 'swapit:player:location';

/**
 * Get or create a persistent player UUID
 * @returns {string} Player UUID
 */
export function getOrCreatePlayerUUID() {
  let uuid = localStorage.getItem(PLAYER_UUID_KEY);

  if (!uuid) {
    // Generate UUID v4-like format
    uuid = 'player-' + Date.now() + '-' +
           Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
    localStorage.setItem(PLAYER_UUID_KEY, uuid);
  }

  return uuid;
}

/**
 * Store player display name
 * @param {string} name - Display name
 */
export function savePlayerName(name) {
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

/**
 * Get stored player display name
 * @returns {string|null} Stored name or null
 */
export function getPlayerName() {
  return localStorage.getItem(PLAYER_NAME_KEY);
}

/**
 * Store player location data
 * @param {Object} locationData - Location data from IP geolocation
 */
export function savePlayerLocation(locationData) {
  localStorage.setItem(PLAYER_LOCATION_KEY, JSON.stringify(locationData));
}

/**
 * Get stored player location data
 * @returns {Object|null} Location data or null
 */
export function getPlayerLocation() {
  const data = localStorage.getItem(PLAYER_LOCATION_KEY);
  return data ? JSON.parse(data) : null;
}

/**
 * Clear player data (for testing)
 */
export function clearPlayerData() {
  localStorage.removeItem(PLAYER_UUID_KEY);
  localStorage.removeItem(PLAYER_NAME_KEY);
  localStorage.removeItem(PLAYER_LOCATION_KEY);
}
