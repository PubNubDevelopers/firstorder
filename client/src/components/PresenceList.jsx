import React from 'react';
import { getLocationDisplay } from '../utils/flagEmojis';

/**
 * PresenceList - Sidebar widget showing online players
 * Displays who's currently in the lobby
 */
export default function PresenceList({ players }) {
  const playerCount = players.length;

  return (
    <div className="sidebar-widget presence-list">
      <h3 className="widget-title">Who's Here</h3>

      {playerCount === 0 ? (
        <div className="presence-empty">
          <p>Waiting for players...</p>
        </div>
      ) : (
        <>
          <div className="presence-items">
            {players.map(player => (
              <div key={player.uuid} className="presence-item">
                <span className="presence-avatar">👤</span>
                <span className="presence-name">{player.playerName}</span>
                {player.location && (
                  <span className="presence-location">
                    {getLocationDisplay(player.location, true)}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="presence-count">
            {playerCount} player{playerCount !== 1 ? 's' : ''} online
          </div>
        </>
      )}
    </div>
  );
}
