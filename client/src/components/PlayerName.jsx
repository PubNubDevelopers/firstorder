import React from 'react';
import { getCountryFlag } from '../utils/geolocation';

/**
 * PlayerName component - displays player name with country flag
 *
 * @param {string} name - Player display name
 * @param {string} location - Location string (e.g., "USA - AZ" or "Canada")
 * @param {string} className - Optional CSS class
 */
export default function PlayerName({ name, location, className = '' }) {
  // Extract country code from location string
  const getCountryCodeFromLocation = (locationStr) => {
    if (!locationStr) return null;

    // For "USA - AZ" format
    if (locationStr.startsWith('USA')) {
      return 'US';
    }

    // For other countries, try common mappings
    const countryMap = {
      'Canada': 'CA',
      'United Kingdom': 'GB',
      'Australia': 'AU',
      'Germany': 'DE',
      'France': 'FR',
      'Spain': 'ES',
      'Italy': 'IT',
      'Japan': 'JP',
      'China': 'CN',
      'Brazil': 'BR',
      'Mexico': 'MX',
      'India': 'IN',
      'Netherlands': 'NL',
      'Sweden': 'SE',
      'Norway': 'NO',
      'Denmark': 'DK',
      'Finland': 'FI'
    };

    return countryMap[locationStr] || null;
  };

  const countryCode = location ? getCountryCodeFromLocation(location) : null;
  const flag = countryCode ? getCountryFlag(countryCode) : '';

  // For USA, show flag + state abbreviation (e.g., "🇺🇸 AZ")
  // For other countries, just show flag
  let displayText = name;
  if (location && location.startsWith('USA -')) {
    const stateCode = location.split('-')[1]?.trim();
    displayText = `${flag} ${stateCode} ${name}`;
  } else if (flag) {
    displayText = `${flag} ${name}`;
  }

  return (
    <span className={className} title={location || 'Unknown location'}>
      {displayText}
    </span>
  );
}
