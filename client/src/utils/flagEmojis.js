/**
 * Flag emoji utilities for displaying player locations
 */

/**
 * Convert ISO country code to flag emoji
 * @param {string} countryCode - ISO 2-letter country code (e.g., 'US')
 * @returns {string} Flag emoji or globe emoji if invalid
 */
export function countryCodeToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) {
    return '🌍';
  }

  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());

  return String.fromCodePoint(...codePoints);
}

/**
 * US state icons - no longer needed, keeping for backward compatibility
 * Now using text abbreviations instead (e.g., 🇺🇸 CA)
 */
export const US_STATE_FLAGS = {
  // Deprecated - using text abbreviations now
};

/**
 * Get location display string with flag(s)
 * @param {Object} locationData - Location data object
 * @param {string} locationData.countryCode - ISO country code
 * @param {string} locationData.region - State/region code
 * @returns {string} Flag emoji(s) for display
 */
export function getLocationDisplay(locationData) {
  if (!locationData) {
    return '🌍';
  }

  const countryFlag = countryCodeToFlag(locationData.countryCode);

  // Special handling for USA - show flag + state abbreviation
  if (locationData.countryCode === 'US' && locationData.region) {
    return `${countryFlag} ${locationData.region}`;
  }

  return countryFlag;
}
