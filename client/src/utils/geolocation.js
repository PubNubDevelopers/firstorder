/**
 * Geolocation utility using ip-api.com
 * Rate limit: 45 requests/minute (free tier)
 */

const IP_API_URL = 'https://ip-api.com/json';

/**
 * Fetch player location based on IP address
 * @returns {Promise<Object|null>} Location data or null if failed
 */
export async function fetchPlayerLocation() {
  try {
    const response = await fetch(
      `${IP_API_URL}?fields=status,country,countryCode,region,regionName,city`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch location');
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error('Location lookup failed');
    }

    return {
      country: data.country,
      countryCode: data.countryCode,
      region: data.region,
      regionName: data.regionName,
      city: data.city
    };
  } catch (error) {
    console.error('Geolocation error:', error);
    return null;
  }
}
