import React, { useState } from 'react';
import PlayerName from './PlayerName';

/**
 * InvitePlayersPanel - Host UI for inviting lobby players to private games
 */
export default function InvitePlayersPanel({
  pubnub,
  gameId,
  hostPlayerId,
  lobbyPlayers,
  invitedPlayers,  // Map of playerId → status
  onRefresh
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInvite = async (targetPlayerId) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/.netlify/functions/game?operation=invite_player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          hostPlayerId,
          targetPlayerId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invitation');
      }

      const result = await response.json();
      console.log(`[InvitePlayersPanel] Invited ${targetPlayerId}:`, result);

      // Refresh will happen via admin channel subscription

    } catch (err) {
      console.error('[InvitePlayersPanel] Error inviting player:', err);
      setError(`Failed to invite player: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="invite-players-panel">
      <div className="panel-header">
        <h3>Invite Players</h3>
        <button
          className="refresh-btn"
          onClick={onRefresh}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {lobbyPlayers.length === 0 ? (
        <div className="no-players">
          <p>No players currently in lobby</p>
        </div>
      ) : (
        <div className="player-list">
          {lobbyPlayers.map(player => {
            const status = invitedPlayers[player.uuid];
            const canInvite = !status;

            return (
              <div key={player.uuid} className="player-item">
                <PlayerName
                  name={player.playerName || player.uuid}
                  location={player.location}
                  className="player-name"
                />

                <div className="player-actions">
                  {!status && (
                    <button
                      className="invite-btn"
                      onClick={() => handleInvite(player.uuid)}
                      disabled={loading}
                    >
                      Invite
                    </button>
                  )}

                  {status === 'INVITED' && (
                    <span className="status-badge invited">Invited</span>
                  )}

                  {status === 'JOINED' && (
                    <span className="status-badge joined">✓ Joined</span>
                  )}

                  {status === 'DENIED' && (
                    <span className="status-badge denied">Declined</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
