import React from 'react';
import PlayerName from './PlayerName';
import { EMOJI_THEMES } from '../utils/emojiThemes';

/**
 * InvitationList - Shows pending game invitations
 */
export default function InvitationList({
  invitations,
  onAccept,
  onReject,
  loading
}) {
  if (!invitations || invitations.length === 0) return null;

  return (
    <div className="invitations-section">
      <h3>Game Invitations ({invitations.length})</h3>

      {invitations.map(inv => {
        const themeName = EMOJI_THEMES[inv.emojiTheme]?.name || inv.emojiTheme;

        return (
          <div key={inv.gameId} className="invitation-card">
            <div className="invitation-header">
              <h4>{inv.gameName || `Game ${inv.gameId.slice(0, 6)}`}</h4>
              <span className="host-name">from {inv.hostName}</span>
            </div>

            <div className="invitation-details">
              <span>{inv.tileCount}×{inv.tileCount} grid</span>
              <span>•</span>
              <span>Max {inv.maxPlayers} players</span>
              <span>•</span>
              <span>{themeName}</span>
            </div>

            <div className="invitation-actions">
              <button
                className="accept-btn"
                onClick={() => onAccept(inv.gameId)}
                disabled={loading}
              >
                Accept
              </button>
              <button
                className="decline-btn"
                onClick={() => onReject(inv.gameId)}
                disabled={loading}
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
