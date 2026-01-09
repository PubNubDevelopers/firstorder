/**
 * IP Geolocation service
 * Uses ipapi.co free tier (30k requests/month, no API key required)
 */

const IP_API_URL = 'https://ipapi.co/json/';

/**
 * Fetch location data from client IP address
 * @returns {Promise<Object>} Location data { country, countryCode, state, stateCode }
 */
export async function fetchIPLocation() {
  try {
    // ipapi.co free tier - no API key required
    // Returns: country_name, country_code, region (state full name), region_code (state code)
    const response = await fetch(IP_API_URL);

    if (!response.ok) {
      throw new Error('Geolocation API request failed');
    }

    const data = await response.json();

    // Check for error response
    if (data.error) {
      throw new Error(data.reason || 'Geolocation API returned error');
    }

    // Normalize to our format
    return {
      country: data.country_name,      // e.g., "United States"
      countryCode: data.country_code,  // e.g., "US"
      state: data.region,              // e.g., "Arizona"
      stateCode: data.region_code      // e.g., "AZ"
    };
  } catch (error) {
    console.error('[geolocation] Error fetching IP location:', error);
    // Return default location on error
    return {
      country: 'Unknown',
      countryCode: 'XX',
      state: null,
      stateCode: null
    };
  }
}

/**
 * Format location as display string
 * - For US: "USA - AZ"
 * - For other countries: "Canada"
 * @param {Object} location - Location data
 * @returns {string} Formatted location string
 */
export function formatLocationString(location) {
  if (!location || !location.countryCode) {
    return 'Unknown';
  }

  // For United States, include state code
  if (location.countryCode === 'US' && location.stateCode) {
    return `USA - ${location.stateCode}`;
  }

  // For other countries, just show country name
  return location.country;
}

/**
 * Get country flag emoji from country code
 * @param {string} countryCode - Two-letter country code (e.g., "US", "CA")
 * @returns {string} Flag emoji
 */
export function getCountryFlag(countryCode) {
  if (!countryCode || countryCode === 'XX') {
    return '🌍'; // Earth emoji for unknown
  }

  // Convert country code to flag emoji
  // Flag emojis are regional indicator symbols (U+1F1E6 - U+1F1FF)
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
}

/**
 * Get location display with flag
 * - For US: "🇺🇸 USA - AZ"
 * - For other countries: "🇨🇦 Canada"
 * @param {Object} location - Location data
 * @returns {string} Flag emoji + location string
 */
export function getLocationDisplay(location) {
  if (!location) {
    return '🌍 Unknown';
  }

  const flag = getCountryFlag(location.countryCode);
  const locationStr = formatLocationString(location);

  return `${flag} ${locationStr}`;
}
