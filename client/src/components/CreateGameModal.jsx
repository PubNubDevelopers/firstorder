import React, { useState, useMemo, useEffect } from 'react';
import { getThemeKeys, EMOJI_THEMES } from '../utils/emojiThemes';
import { getRandomMovieName } from '../utils/movieNames';

/**
 * CreateGameModal component - modal for creating new games with options
 */
export default function CreateGameModal({ playerInfo, onCreateGame, onCancel }) {
  // Generate random movie name once when component mounts
  const defaultMovieName = useMemo(() => getRandomMovieName(), []);

  const [tileCount, setTileCount] = useState(5);
  const [emojiTheme, setEmojiTheme] = useState('food');
  const [playerMode, setPlayerMode] = useState('multiplayer'); // 'single' or 'multiplayer'
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [placementCount, setPlacementCount] = useState(2); // Default for 2 players
  const [gameName, setGameName] = useState(defaultMovieName);
  const [gameplayMode, setGameplayMode] = useState('none'); // 'none', 'pinning', 'verified'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-adjust placementCount when maxPlayers or playerMode changes
  useEffect(() => {
    if (playerMode === 'single') {
      setPlacementCount(1);
    } else if (playerMode === 'multiplayer') {
      if (maxPlayers === 2) {
        setPlacementCount(Math.min(2, placementCount));
      } else if (maxPlayers >= 3) {
        // Default to 3 for multiplayer with 3+ players
        if (placementCount < 3) {
          setPlacementCount(3);
        }
      }
    }
  }, [maxPlayers, playerMode, placementCount]);

  const handleCreate = async () => {
    setLoading(true);
    setError('');

    try {
      await onCreateGame({
        tileCount,
        emojiTheme,
        maxPlayers: playerMode === 'single' ? 1 : maxPlayers,
        placementCount: playerMode === 'single' ? 1 : placementCount,
        gameName: gameName.trim() || null,
        tilePinningEnabled: gameplayMode === 'pinning',
        verifiedPositionsEnabled: gameplayMode === 'verified'
      });
    } catch (err) {
      setError(err.message || 'Failed to create game');
      setLoading(false);
    }
  };

  // Handle player mode change
  const handlePlayerModeChange = (mode) => {
    setPlayerMode(mode);
    if (mode === 'single') {
      // Single player mode doesn't need maxPlayers input, it's always 1
    } else {
      // Default to 2 for multiplayer if coming from single player
      if (maxPlayers === 1) {
        setMaxPlayers(2);
      }
    }
  };

  // Generate a new random movie name
  const handleRefreshMovieName = () => {
    setGameName(getRandomMovieName());
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content create-game-modal" onClick={(e) => e.stopPropagation()}>
        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
          </div>
        )}
        <h2>Create New Game</h2>

        {error && <div className="error-message">{error}</div>}

        {/* Game Name Input */}
        <div className="form-group form-row" style={{ alignItems: 'flex-start' }}>
          <label style={{ paddingTop: '8px' }}>Game Name:</label>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Enter game name"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                maxLength={30}
                disabled={loading}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={handleRefreshMovieName}
                disabled={loading}
                className="refresh-button"
                title="Get a different movie name"
              >
                🎬
              </button>
            </div>
            <span className="hint">Random movie name generated</span>
          </div>
        </div>

        {/* Tile Count Selector */}
        <div className="form-group form-row">
          <label>Number of Tiles:</label>
          <div className="tile-count-selector">
            {[4, 5, 6, 7, 8].map(count => (
              <button
                key={count}
                type="button"
                className={`tile-count-option ${tileCount === count ? 'selected' : ''}`}
                onClick={() => setTileCount(count)}
                disabled={loading}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Selector */}
        <div className="form-group form-row">
          <label>Emoji Theme:</label>
          <select
            value={emojiTheme}
            onChange={(e) => setEmojiTheme(e.target.value)}
            disabled={loading}
          >
            {getThemeKeys().map(key => (
              <option key={key} value={key}>
                {EMOJI_THEMES[key].name}
              </option>
            ))}
          </select>
        </div>

        {/* Player Mode Toggle */}
        <div className="form-group">
          <label>Player Mode</label>

          <label className="radio-label">
            <input
              type="radio"
              name="playerMode"
              value="multiplayer"
              checked={playerMode === 'multiplayer'}
              onChange={(e) => handlePlayerModeChange(e.target.value)}
              disabled={loading}
            />
            <span>Multiplayer</span>
          </label>

          <label className="radio-label">
            <input
              type="radio"
              name="playerMode"
              value="single"
              checked={playerMode === 'single'}
              onChange={(e) => handlePlayerModeChange(e.target.value)}
              disabled={loading}
            />
            <span>Single Player</span>
          </label>
        </div>

        {/* Max Players Input - Only show for multiplayer */}
        {playerMode === 'multiplayer' && (
          <div className="form-group form-row">
            <label>Max Players:</label>
            <input
              type="number"
              min="2"
              max="10"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(
                Math.min(10, Math.max(2, parseInt(e.target.value) || 2))
              )}
              disabled={loading}
            />
          </div>
        )}

        {/* Placement Count Selector - Only show for multiplayer */}
        {playerMode === 'multiplayer' && (
          <div className="form-group form-row">
            <label>Finish Positions:</label>
            <div className="tile-count-selector">
              <button
                type="button"
                className={`tile-count-option ${placementCount === 1 ? 'selected' : ''}`}
                onClick={() => setPlacementCount(1)}
                disabled={loading}
              >
                1
              </button>
              {maxPlayers >= 2 && (
                <button
                  type="button"
                  className={`tile-count-option ${placementCount === 2 ? 'selected' : ''}`}
                  onClick={() => setPlacementCount(2)}
                  disabled={loading}
                >
                  2
                </button>
              )}
              {maxPlayers >= 3 && (
                <button
                  type="button"
                  className={`tile-count-option ${placementCount === 3 ? 'selected' : ''}`}
                  onClick={() => setPlacementCount(3)}
                  disabled={loading}
                >
                  3
                </button>
              )}
            </div>
          </div>
        )}

        {/* Player Assistance Modes Selection */}
        <div className="form-group">
          <label>Player Assistance Modes</label>

          <label className="radio-label">
            <input
              type="radio"
              name="gameplayMode"
              value="verified"
              checked={gameplayMode === 'verified'}
              onChange={(e) => setGameplayMode(e.target.value)}
              disabled={loading}
            />
            <span>Verified Matches (easiest)</span>
          </label>

          <label className="radio-label">
            <input
              type="radio"
              name="gameplayMode"
              value="pinning"
              checked={gameplayMode === 'pinning'}
              onChange={(e) => setGameplayMode(e.target.value)}
              disabled={loading}
            />
            <span>Tile Pinning (easy)</span>
          </label>

          <label className="radio-label">
            <input
              type="radio"
              name="gameplayMode"
              value="none"
              checked={gameplayMode === 'none'}
              onChange={(e) => setGameplayMode(e.target.value)}
              disabled={loading}
            />
            <span>None (hard)</span>
          </label>
        </div>

        <div className="modal-actions">
          <button onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className="primary"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      </div>
    </div>
  );
}
