import React, { useState, useEffect, useCallback } from 'react';
import { usePubNub } from '../hooks/usePubNub';
import { getTournamentStatus, inviteTournamentPlayer } from '../utils/tournamentApi';
import PlayerName from './PlayerName';
import InvitePlayersPanel from './InvitePlayersPanel';

/**
 * TournamentSetup component - host view for setting up tournament and inviting players
 */
export default function TournamentSetup({ tournamentConfig, playerInfo, pubnubConfig, onLeave }) {
  const { tournamentId, isHost } = tournamentConfig;
  const { playerId, playerName } = playerInfo;

  // Tournament state
  const [tournament, setTournament] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invitation tracking
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [invitedPlayers, setInvitedPlayers] = useState({});

  // PubNub connection
  const { pubnub, subscribe, isConnected } = usePubNub(pubnubConfig);

  // Load tournament status on mount
  useEffect(() => {
    if (!pubnub || !isConnected) return;

    const loadTournamentStatus = async () => {
      try {
        const { tournament: tournamentData, members: membersData } = await getTournamentStatus(pubnub, tournamentId);
        setTournament(tournamentData);
        setMembers(membersData);

        // Build invited players map
        const invited = {};
        membersData.forEach(member => {
          const status = member.custom?.status;
          if (status) {
            invited[member.uuid.id] = status;
          }
        });
        setInvitedPlayers(invited);

        setLoading(false);
      } catch (err) {
        console.error('[TournamentSetup] Error loading tournament:', err);
        setError(err.message || 'Failed to load tournament');
        setLoading(false);
      }
    };

    loadTournamentStatus();
  }, [pubnub, isConnected, tournamentId]);

  // Subscribe to admin channel for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    let unsubscribeAdmin;

    (async () => {
      unsubscribeAdmin = await subscribe(
        `admin.t.${tournamentId}`,
        (event) => {
          const message = event.message;
          console.log('[TournamentSetup] Received admin message:', message);

          if (message.type === 'PLAYER_INVITED') {
            setInvitedPlayers(prev => ({
              ...prev,
              [message.playerId]: 'INVITED'
            }));
          } else if (message.type === 'INVITATION_ACCEPTED') {
            setInvitedPlayers(prev => ({
              ...prev,
              [message.playerId]: 'JOINED'
            }));
            // Reload tournament status to get updated member list
            getTournamentStatus(pubnub, tournamentId).then(({ members: membersData }) => {
              setMembers(membersData);
            });
          } else if (message.type === 'INVITATION_DENIED') {
            setInvitedPlayers(prev => ({
              ...prev,
              [message.playerId]: 'DENIED'
            }));
          } else if (message.type === 'PLAYER_JOINED_TOURNAMENT') {
            console.log('[TournamentSetup] Player joined tournament:', message.playerId);
            setInvitedPlayers(prev => ({
              ...prev,
              [message.playerId]: 'JOINED'
            }));
            // Reload tournament status to get updated member list
            getTournamentStatus(pubnub, tournamentId).then(({ members: membersData }) => {
              setMembers(membersData);
            });
          }
        }
      );
    })();

    return () => {
      if (unsubscribeAdmin) unsubscribeAdmin();
    };
  }, [isConnected, subscribe, tournamentId, pubnub]);

  // Subscribe to lobby for finding players to invite
  useEffect(() => {
    if (!isConnected || !isHost) return;

    let unsubscribeLobby;

    (async () => {
      unsubscribeLobby = await subscribe(
        'lobby',
        (event) => {
          const message = event.message;

          if (message.type === 'PLAYER_JOINED_LOBBY') {
            setLobbyPlayers(prev => {
              if (prev.some(p => p.playerId === message.playerId)) {
                return prev;
              }
              return [...prev, {
                playerId: message.playerId,
                playerName: message.playerName
              }];
            });
          } else if (message.type === 'PLAYER_LEFT_LOBBY') {
            setLobbyPlayers(prev => prev.filter(p => p.playerId !== message.playerId));
          }
        }
      );
    })();

    return () => {
      if (unsubscribeLobby) unsubscribeLobby();
    };
  }, [isConnected, subscribe, isHost]);

  // Handle player invitation
  const handleInvitePlayer = useCallback(async (targetPlayerId) => {
    try {
      await inviteTournamentPlayer(tournamentId, playerId, targetPlayerId);
      console.log('[TournamentSetup] Invited player:', targetPlayerId);
    } catch (err) {
      console.error('[TournamentSetup] Error inviting player:', err);
      setError(err.message || 'Failed to invite player');
    }
  }, [tournamentId, playerId]);

  // Calculate joined player count
  const joinedCount = members.filter(m => m.custom?.status === 'JOINED').length;
  const canStart = joinedCount >= 8;

  if (loading) {
    return (
      <div className="game-container">
        <div className="loading">Loading tournament...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-container">
        <div className="error-message">{error}</div>
        <button onClick={onLeave}>Back to Lobby</button>
      </div>
    );
  }

  const tournamentName = tournament?.name || `Tournament ${tournamentId}`;
  const custom = tournament?.custom || {};

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-info">
          <h1>{tournamentName}</h1>
          <div className="game-status">
            <span className="status-badge status-created">Setup</span>
            <span>{joinedCount} / {custom.maxPlayers} players</span>
            <span>Top {custom.advancementRule} advance</span>
          </div>
        </div>
        <button className="leave-button" onClick={onLeave}>
          Leave Tournament
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="game-content">
        {/* Participants List */}
        <div className="players-panel">
          <h2>Participants</h2>
          <div className="players-list">
            {members.map(member => {
              const status = member.custom?.status || 'UNKNOWN';
              const role = member.custom?.role;
              const isCurrentPlayer = member.uuid.id === playerId;

              return (
                <div
                  key={member.uuid.id}
                  className={`player-item ${isCurrentPlayer ? 'current-player' : ''}`}
                >
                  <div className="player-name-wrapper">
                    <PlayerName
                      playerName={member.uuid.name}
                      location={member.uuid.custom?.playerLocation}
                      isCurrentPlayer={isCurrentPlayer}
                    />
                    {role === 'host' && <span className="host-badge">👑 Host</span>}
                  </div>
                  <div className="player-status">
                    {status === 'JOINED' && <span className="status-joined">✓ Joined</span>}
                    {status === 'INVITED' && <span className="status-invited">⏳ Invited</span>}
                    {status === 'DENIED' && <span className="status-denied">✗ Declined</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {!canStart && (
            <div className="hint">
              Need at least 8 players to start the tournament
            </div>
          )}
        </div>

        {/* Invite Players Panel (host only) */}
        {isHost && custom.inviteOnly && (
          <InvitePlayersPanel
            lobbyPlayers={lobbyPlayers}
            invitedPlayers={invitedPlayers}
            onInvitePlayer={handleInvitePlayer}
            currentPlayerId={playerId}
          />
        )}

        {/* Tournament Info */}
        <div className="game-settings">
          <h2>Tournament Rules</h2>
          <div className="setting-item">
            <span className="setting-label">Tiles:</span>
            <span className="setting-value">{custom.tileCount}</span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Theme:</span>
            <span className="setting-value">{custom.emojiTheme}</span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Max Players:</span>
            <span className="setting-value">{custom.maxPlayers}</span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Advancement:</span>
            <span className="setting-value">Top {custom.advancementRule} advance</span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Tile Pinning:</span>
            <span className="setting-value">{custom.tilePinningEnabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Verified Positions:</span>
            <span className="setting-value">{custom.verifiedPositionsEnabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
      </div>

      {/* Start Tournament Button (host only) */}
      {isHost && (
        <div className="game-actions">
          <button
            className="start-button"
            disabled={!canStart}
            onClick={() => console.log('Start tournament - Phase 2 functionality')}
          >
            {canStart ? 'Start Tournament' : `Need ${8 - joinedCount} more players`}
          </button>
        </div>
      )}
    </div>
  );
}
