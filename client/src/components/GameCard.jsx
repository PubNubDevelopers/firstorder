import React from 'react';
import PlayerName from './PlayerName';
import { EMOJI_THEMES } from '../utils/emojiThemes';

/**
 * GameCard - Modern card-based display for available games
 * Displays game info with visual hierarchy and one-click join
 */
export default function GameCard({ game, onJoin, loading }) {
  const { gameId, gameName, tileCount, emojiTheme, maxPlayers, playerIds, playerNames, playerLocations } = game;

  // Calculate progress
  const playerCount = playerIds.length;
  const progressPercent = (playerCount / maxPlayers) * 100;
  const isFull = playerCount >= maxPlayers;

  // Get theme display name
  const themeName = EMOJI_THEMES[emojiTheme]?.name || emojiTheme;

  // Get first 4 players for display
  const displayPlayers = playerIds.slice(0, 4);
  const hasMorePlayers = playerIds.length > 4;

  return (
    <div className="game-card">
      {/* Header: Game name + status badge */}
      <div className="game-card-header">
        <h3 className="game-card-title">
          {gameName || `Game ${gameId.slice(0, 4)}`}
        </h3>
        {isFull && <span className="badge badge-full">Full</span>}
        {!isFull && playerCount > 0 && <span className="badge badge-waiting">Waiting</span>}
        {playerCount === 0 && <span className="badge badge-new">New</span>}
      </div>

      {/* Meta row: Grid size, theme */}
      <div className="game-card-meta">
        <span className="meta-item">
          <span className="meta-icon">🎯</span>
          Grid: {tileCount}×{tileCount}
        </span>
        <span className="meta-separator">•</span>
        <span className="meta-item">
          <span className="meta-icon">🎨</span>
          {themeName}
        </span>
      </div>

      {/* Progress bar */}
      <div className="game-card-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="progress-text">
          {playerCount} of {maxPlayers} player{maxPlayers !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Player avatars */}
      {playerCount > 0 && (
        <div className="game-card-players">
          {displayPlayers.map(playerId => {
            const playerName = playerNames[playerId] || `Player ${playerId.slice(-4)}`;
            const location = playerLocations?.[playerId];
            return (
              <div key={playerId} className="player-avatar">
                <PlayerName name={playerName} location={location} className="avatar-flag" />
              </div>
            );
          })}
          {hasMorePlayers && (
            <div className="player-avatar player-more">
              +{playerIds.length - 4}
            </div>
          )}
        </div>
      )}

      {/* Action button */}
      <button
        className={`game-card-join ${isFull ? 'disabled' : ''}`}
        onClick={() => !isFull && !loading && onJoin(gameId)}
        disabled={isFull || loading}
      >
        {isFull ? 'Game Full' : 'Join Game →'}
      </button>

      {/* Game ID (subtle, bottom) */}
      <div className="game-card-code">
        Code: <span className="code-mono">{gameId}</span>
      </div>
    </div>
  );
}
