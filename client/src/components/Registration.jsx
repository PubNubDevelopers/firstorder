import React, { useState, useEffect } from 'react';
import { getOrCreatePlayerUUID, savePlayerName, getPlayerName, savePlayerLocation } from '../utils/playerStorage';
import { fetchPlayerLocation } from '../utils/geolocation';

/**
 * Registration component - first page every player sees
 */
export default function Registration({ onRegister }) {
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get or create UUID on mount
    const uuid = getOrCreatePlayerUUID();
    setPlayerId(uuid);

    // Pre-fill name if previously saved
    const savedName = getPlayerName();
    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);

    try {
      // Fetch location in background
      const location = await fetchPlayerLocation();
      if (location) {
        savePlayerLocation(location);
      }

      // Save name for future sessions
      savePlayerName(playerName.trim());

      // Navigate to lobby
      onRegister({
        playerId,
        playerName: playerName.trim()
      });
    } catch (err) {
      setError('Failed to enter lobby');
      setLoading(false);
    }
  };

  return (
    <div className="registration">
      <h1>First Order</h1>
      <p className="game-info">A multiplayer tile-swapping race game</p>

      {error && <div className="error-message">{error}</div>}

      <div className="registration-form">
        <p className="player-id-display">Your Player ID: {playerId}</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Enter your display name"
            value={playerName}
            onChange={(e) => {
              setPlayerName(e.target.value);
              setError('');
            }}
            maxLength={20}
            autoFocus
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Entering Lobby...' : 'Enter Lobby'}
          </button>
        </form>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
}
