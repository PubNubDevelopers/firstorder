import React, { useState, useMemo, useEffect } from 'react';
import { getThemeKeys, EMOJI_THEMES } from '../utils/emojiThemes';
import { getRandomMovieName } from '../utils/movieNames';

/**
 * CreateGameModal component - modal for creating new games with options
 */
export default function CreateGameModal({ playerInfo, onCreateGame, onCreateTournament, onCancel }) {
  // Generate random movie name once when component mounts
  const defaultMovieName = useMemo(() => getRandomMovieName(), []);

  const [tileCount, setTileCount] = useState(5);
  const [emojiTheme, setEmojiTheme] = useState('food');
  const [playerMode, setPlayerMode] = useState('multiplayer'); // 'single', 'multiplayer', or 'tournament'
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [placementCount, setPlacementCount] = useState(2); // Default for 2 players
  const [advancementRule, setAdvancementRule] = useState(2); // For tournament mode: 1-4 players advance
  const [gameName, setGameName] = useState(defaultMovieName);
  const [gameplayMode, setGameplayMode] = useState('verified'); // 'none', 'pinning', 'verified' - default to easiest
  const [inviteOnly, setInviteOnly] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
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
    } else if (playerMode === 'tournament') {
      // Tournament mode: set default maxPlayers to 16 if not already set
      if (maxPlayers < 8) {
        setMaxPlayers(16);
      }
    }
  }, [maxPlayers, playerMode, placementCount]);

  const handleCreate = async () => {
    setLoading(true);
    setError('');

    if (playerMode === 'tournament') {
      // Tournament mode
      if (maxPlayers < 8 || maxPlayers > 100) {
        setError('Tournament must have 8-100 players');
        setLoading(false);
        return;
      }

      const tournamentOptions = {
        tileCount,
        emojiTheme,
        maxPlayers,
        advancementRule,
        gameName: gameName.trim() || null,
        tilePinningEnabled: gameplayMode === 'pinning',
        verifiedPositionsEnabled: gameplayMode === 'verified',
        inviteOnly
      };

      console.log('[CreateGameModal] Creating tournament with options:', tournamentOptions);

      try {
        await onCreateTournament(tournamentOptions);
      } catch (err) {
        setError(err.message || 'Failed to create tournament');
        setLoading(false);
      }
    } else {
      // Regular game mode
      const gameOptions = {
        tileCount,
        emojiTheme,
        maxPlayers: playerMode === 'single' ? 1 : maxPlayers,
        placementCount: playerMode === 'single' ? 1 : placementCount,
        gameName: gameName.trim() || null,
        tilePinningEnabled: gameplayMode === 'pinning',
        verifiedPositionsEnabled: gameplayMode === 'verified',
        inviteOnly
      };

      console.log('[CreateGameModal] Creating game with options:', gameOptions);

      try {
        await onCreateGame(gameOptions);
      } catch (err) {
        setError(err.message || 'Failed to create game');
        setLoading(false);
      }
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

        <h2>{playerMode === 'tournament' ? 'Create New Tournament' : 'Create New Game'}</h2>

        {error && <div className="error-message">{error}</div>}

        {/* Scrollable Body */}
        <div className="modal-body">
          <div className="create-game-form-grid">

            {/* LEFT COLUMN */}
            <div className="form-column">
              {/* Game Name Input */}
              <div className="form-group">
                <label>Game Name</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Enter game name"
                      value={gameName}
                      onChange={(e) => setGameName(e.target.value)}
                      maxLength={30}
                      disabled={loading}
                      className="styled-input"
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

              {/* Emoji Theme */}
              <div className="form-group">
                <label>Emoji Theme</label>
                <select
                  value={emojiTheme}
                  onChange={(e) => setEmojiTheme(e.target.value)}
                  disabled={loading}
                  className="styled-select"
                >
                  {getThemeKeys().map(key => (
                    <option key={key} value={key}>
                      {EMOJI_THEMES[key].name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Number of Tiles */}
              <div className="form-group">
                <label>Number of Tiles</label>
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

              {/* Player Assistance Modes */}
              <div className="form-group">
                <label>Player Assistance Modes</label>
                <div className="radio-group">
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
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="form-column">
              {/* Player Mode */}
              <div className="form-group">
                <label>Player Mode</label>
                <div className="radio-group">
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
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="playerMode"
                      value="tournament"
                      checked={playerMode === 'tournament'}
                      onChange={(e) => handlePlayerModeChange(e.target.value)}
                      disabled={loading}
                    />
                    <span>Tournament</span>
                  </label>
                </div>
              </div>

              {/* Private Checkbox */}
              {(playerMode === 'multiplayer' || playerMode === 'tournament') && (
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={inviteOnly}
                      onChange={(e) => {
                        console.log('[CreateGameModal] inviteOnly checkbox changed to:', e.target.checked);
                        setInviteOnly(e.target.checked);
                      }}
                      disabled={loading}
                    />
                    <span>Private (Invite-Only)</span>
                  </label>
                </div>
              )}

              {/* Finish Positions - Only for multiplayer */}
              {playerMode === 'multiplayer' && (
                <div className="form-group">
                  <label>Finish Positions</label>
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

              {/* Max Players - Show for multiplayer and tournament */}
              {playerMode === 'multiplayer' && (
                <div className="form-group">
                  <label>Max Players</label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(
                      Math.min(10, Math.max(2, parseInt(e.target.value) || 2))
                    )}
                    disabled={loading}
                    className="styled-input"
                    style={{ width: '150px' }}
                  />
                </div>
              )}

              {/* Tournament-specific fields */}
              {playerMode === 'tournament' && (
                <>
                  <div className="form-group">
                    <label>Max Players</label>
                    <input
                      type="number"
                      min="8"
                      max="100"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(
                        Math.min(100, Math.max(8, parseInt(e.target.value) || 16))
                      )}
                      disabled={loading}
                      className="styled-input"
                      style={{ width: '150px' }}
                    />
                    <span className="hint">Minimum 8 players required</span>
                  </div>

                  <div className="form-group">
                    <label>Advancement Rule</label>
                    <select
                      value={advancementRule}
                      onChange={(e) => setAdvancementRule(parseInt(e.target.value))}
                      disabled={loading}
                      className="styled-select"
                    >
                      <option value="1">Top 1 advances</option>
                      <option value="2">Top 2 advance</option>
                      <option value="3">Top 3 advance</option>
                      <option value="4">Top 4 advance</option>
                    </select>
                    <span className="hint">How many players advance from each game per round</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="modal-footer">
          <div className="modal-actions">
            <button onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? 'Creating...' : (playerMode === 'tournament' ? 'Create Tournament' : 'Create Game')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
