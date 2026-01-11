import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createGame, joinGame as joinGameApi, listGames } from '../utils/gameApi';
import { usePubNub } from '../hooks/usePubNub';
import CreateGameModal from './CreateGameModal';
import HelpModal from './HelpModal';
import PlayerName from './PlayerName';
import InvitationList from './InvitationList';
import { getPlayerLocation } from '../utils/playerStorage';
import { EMOJI_THEMES } from '../utils/emojiThemes';
import musicPlayer from '../utils/musicPlayer';

/**
 * GameCard component - Accordion-style game card with expandable player list
 */
function GameCard({ game, playerInfo, onJoin, loading }) {
  const [expanded, setExpanded] = useState(false);
  const hostId = game.playerIds[0];
  const isAlreadyJoined = game.playerIds.includes(playerInfo.playerId);
  const isFull = game.playerCount >= (game.maxPlayers || 10);

  return (
    <div className="game-card">
      {/* Collapsed Header - Always Visible */}
      <div className="game-card-header">
        <div
          className="header-content"
          onClick={() => setExpanded(!expanded)}
          style={{ cursor: 'pointer', flex: 1 }}
        >
          <h3>
            {game.gameName || `Game ${game.gameId}`}
            <span className="game-id-badge">{game.gameId}</span>
          </h3>
          <div className="game-properties">
            {game.emojiTheme && (
              <span className="theme-badge">
                🎨 {EMOJI_THEMES[game.emojiTheme]?.name || 'Theme'}
              </span>
            )}
            {game.tileCount && (
              <span className="tile-badge">
                🎯 {game.tileCount} tiles
              </span>
            )}
            <span className="player-count-badge">
              👥 {game.playerCount} of {game.maxPlayers || 10}
            </span>
          </div>
        </div>
        <button
          className="join-game-button-header"
          disabled={loading || isAlreadyJoined || isFull}
          onClick={(e) => {
            e.stopPropagation();
            onJoin(game.gameId);
          }}
        >
          {isFull ? 'Full' : isAlreadyJoined ? 'Joined' : 'Join'}
        </button>
        <span
          className={`accordion-icon ${expanded ? 'expanded' : ''}`}
          onClick={() => setExpanded(!expanded)}
          style={{ cursor: 'pointer' }}
        >
          ▼
        </span>
      </div>

      {/* Expandable Player List */}
      {expanded && (
        <div className="game-card-body">
          <div className="player-list">
            {game.playerIds.map(pid => (
              <div key={pid} className="player-item">
                {pid === hostId && <span className="host-icon">👑</span>}
                <PlayerName
                  name={game.playerNames[pid] || pid.substring(0, 20)}
                  location={game.playerLocations?.[pid]}
                  className="player-name"
                />
                {pid === hostId && <span className="host-badge">Host</span>}
              </div>
            ))}
          </div>

          <button
            className="join-game-button"
            disabled={loading || isAlreadyJoined || isFull}
            onClick={(e) => {
              e.stopPropagation();
              onJoin(game.gameId);
            }}
          >
            {isFull ? 'Full' : isAlreadyJoined ? 'Joined' : 'Join Game'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Lobby component - game setup screen with presence and real-time game listing
 */
export default function Lobby({ playerInfo, pubnubConfig, onJoinGame, onLeave, onViewHistory }) {
  const [gameId, setGameId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [leavingLobby, setLeavingLobby] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [availableGames, setAvailableGames] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [musicMuted, setMusicMuted] = useState(musicPlayer.isMuted);
  const [invitations, setInvitations] = useState([]);
  const [invitationCount, setInvitationCount] = useState(0);
  const [gameFilter, setGameFilter] = useState('public');  // 'public' | 'private'

  const { isConnected, subscribe, unsubscribe, hereNow, pubnub } = usePubNub(pubnubConfig);

  // Start background music when lobby loads
  useEffect(() => {
    musicPlayer.play();
    return () => {
      musicPlayer.stop();
    };
  }, []);

  // Handle music mute toggle
  const handleMusicToggle = () => {
    const newMutedState = musicPlayer.toggleMute();
    setMusicMuted(newMutedState);
  };

  // Fetch initial presence list with state
  const fetchLobbyPresence = useCallback(async () => {
    try {
      console.log('Fetching lobby presence with hereNow...');
      const result = await hereNow('lobby');
      console.log('hereNow result:', result);
      const occupants = result.channels?.lobby?.occupants || [];
      console.log('Extracted occupants:', occupants);
      // Store occupants with state information
      setLobbyPlayers(occupants);
    } catch (err) {
      console.error('Error fetching lobby presence:', err);
    }
  }, [hereNow]);

  // Fetch initial game list
  const fetchGameList = useCallback(async () => {
    if (!pubnub || !playerInfo?.playerId) {
      console.log('PubNub not initialized yet, skipping game list fetch');
      return;
    }

    try {
      console.log('Fetching game list...');
      const result = await listGames(pubnub);
      console.log('Game list result:', result);
      console.log('Number of games:', result.games?.length || 0);

      // For each private game, check if user has membership
      const gamesWithMembership = await Promise.all(
        (result.games || []).map(async (game) => {
          if (!game.inviteOnly) {
            return { ...game, hasInvitation: false };
          }

          // Check if user has membership in this private game
          try {
            const membersResponse = await pubnub.objects.getChannelMembers({
              channel: `game.${game.gameId}`,
              include: { UUIDFields: true, customFields: true }
            });

            const userMembership = membersResponse.data?.find(
              m => m.uuid.id === playerInfo.playerId
            );

            return {
              ...game,
              hasInvitation: !!userMembership,
              membershipStatus: userMembership?.custom?.status
            };
          } catch (error) {
            console.error(`[fetchGameList] Error checking membership for ${game.gameId}:`, error);
            return { ...game, hasInvitation: false };
          }
        })
      );

      setAvailableGames(gamesWithMembership);
    } catch (err) {
      console.error('Error fetching game list:', err);
      // Set empty array on error to prevent undefined issues
      setAvailableGames([]);
    }
  }, [pubnub, playerInfo?.playerId]);

  // Handle presence events (join, leave, timeout)
  const handlePresenceEvent = useCallback((event) => {
    const { action, uuid, state } = event;
    console.log('Handling presence event:', { action, uuid, state });

    if (action === 'join' || action === 'state-change') {
      setLobbyPlayers(prev => {
        // Remove existing entry if present
        const filtered = prev.filter(occupant => occupant.uuid !== uuid);
        // Add new/updated entry with state
        return [...filtered, { uuid, state: state || {} }];
      });
    } else if (action === 'leave' || action === 'timeout') {
      setLobbyPlayers(prev => prev.filter(occupant => occupant.uuid !== uuid));
    }
  }, []);

  // Handle GAME_CREATED message
  const handleGameCreated = useCallback((message) => {
    const newGame = {
      gameId: message.gameId,
      gameName: message.gameName || null,
      tileCount: message.tileCount || 4,
      emojiTheme: message.emojiTheme || 'food',
      maxPlayers: message.maxPlayers || 10,
      phase: 'CREATED',
      playerIds: message.playerIds,
      playerNames: message.playerNames || {},
      playerLocations: message.playerLocations || {},
      playerCount: message.playerIds.length,
      createdAt: message.createdAt
    };

    setAvailableGames(prev => {
      // Check if game already exists
      if (prev.some(g => g.gameId === message.gameId)) {
        return prev;
      }
      // Add new game and sort by creation time (newest first)
      const updated = [...prev, newGame];
      updated.sort((a, b) => b.createdAt - a.createdAt);
      return updated;
    });
  }, []);

  // Handle GAME_STARTED message
  const handleGameStarted = useCallback((message) => {
    setAvailableGames(prev => prev.filter(g => g.gameId !== message.gameId));
  }, []);

  // Handle PLAYER_JOINED_GAME message
  const handlePlayerJoinedGame = useCallback((message) => {
    setAvailableGames(prev => prev.map(game => {
      if (game.gameId === message.gameId) {
        return {
          ...game,
          playerIds: message.playerIds,
          playerNames: message.playerNames || {},
          playerCount: message.playerIds.length
        };
      }
      return game;
    }));
  }, []);

  // Handle PLAYER_LEFT_GAME message
  const handlePlayerLeftGame = useCallback((message) => {
    setAvailableGames(prev => prev.map(game => {
      if (game.gameId === message.gameId) {
        return {
          ...game,
          playerIds: message.playerIds,
          playerNames: message.playerNames || {},
          playerCount: message.playerIds.length
        };
      }
      return game;
    }));
  }, []);

  // Handle GAME_DELETED message
  const handleGameDeleted = useCallback((message) => {
    setAvailableGames(prev => prev.filter(g => g.gameId !== message.gameId));
  }, []);

  // Handle GAME_NAME_UPDATED message
  const handleGameNameUpdated = useCallback((message) => {
    setAvailableGames(prev => prev.map(game => {
      if (game.gameId === message.gameId) {
        return { ...game, gameName: message.gameName };
      }
      return game;
    }));
  }, []);

  // Handle messages on personal user channel
  const handleUserMessage = useCallback((event) => {
    const message = event.message;

    if (message.type === 'GAME_INVITATION') {
      console.log('[Lobby] Received game invitation:', message);

      // Add to invitations state
      setInvitations(prev => {
        // Avoid duplicates
        const exists = prev.some(inv => inv.gameId === message.gameId);
        if (exists) return prev;

        return [...prev, {
          gameId: message.gameId,
          gameName: message.gameName,
          hostPlayerId: message.hostPlayerId,
          hostName: message.hostName,
          tileCount: message.tileCount,
          emojiTheme: message.emojiTheme,
          maxPlayers: message.maxPlayers,
          invitedAt: message.invitedAt
        }];
      });

      // Increment notification count
      setInvitationCount(prev => prev + 1);

      // Show toast notification (TODO: implement toast component)
      console.log(`[Lobby] Invitation from ${message.hostName} to ${message.gameName || 'a game'}!`);
    }
  }, []);

  // Subscribe to lobby channel with presence and user channel
  useEffect(() => {
    console.log('Lobby useEffect - isConnected:', isConnected);
    if (!isConnected || !playerInfo?.playerId) return;

    console.log('Subscribing to lobby channel with presence...');
    const unsubscribeLobby = subscribe(
      'lobby',
      (event) => {
        console.log('Lobby event received:', event);

        // Handle presence events - these have an 'action' property
        if (event.action) {
          console.log('Processing presence event:', event.action, event.uuid);
          handlePresenceEvent(event);
          return;
        }

        // Handle message events
        const { message } = event;

        if (!message) {
          console.log('Event has no message:', event);
          return;
        }

        console.log('Processing message:', message.type);
        if (message.type === 'GAME_CREATED') {
          handleGameCreated(message);
        } else if (message.type === 'GAME_STARTED') {
          handleGameStarted(message);
        } else if (message.type === 'PLAYER_JOINED_GAME') {
          handlePlayerJoinedGame(message);
        } else if (message.type === 'PLAYER_LEFT_GAME') {
          handlePlayerLeftGame(message);
        } else if (message.type === 'GAME_DELETED') {
          handleGameDeleted(message);
        } else if (message.type === 'GAME_NAME_UPDATED') {
          handleGameNameUpdated(message);
        }
      },
      {
        withPresence: true,
        presenceState: {
          playerName: playerInfo.playerName,
          location: getPlayerLocation()
        }
      }
    );

    // Subscribe to personal user channel for invitations
    const userChannel = `user.${playerInfo.playerId}`;
    console.log(`Subscribing to user channel: ${userChannel}`);
    const unsubscribeUser = subscribe(userChannel, handleUserMessage);

    console.log('Subscriptions complete, fetching initial presence...');
    // Fetch initial presence data
    fetchLobbyPresence();

    return () => {
      unsubscribeLobby();
      unsubscribeUser();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, playerInfo.playerName, playerInfo.playerId]);

  // Fetch game list separately - only once when component mounts
  useEffect(() => {
    fetchGameList();
  }, []); // Empty deps = only runs once on mount

  // Fetch existing invitations on mount
  useEffect(() => {
    if (!pubnub || !playerInfo?.playerId) return;

    async function fetchInvitations() {
      try {
        console.log('[Lobby] Fetching existing invitations...');

        // Get user's memberships
        const response = await pubnub.objects.getMemberships({
          uuid: playerInfo.playerId,
          include: {
            channelFields: true,
            customChannelFields: true,
            customFields: true
          }
        });

        const invites = [];

        for (const membership of response.data || []) {
          const channelId = membership.channel?.id;

          // Only process game channels - ensure channelId is a string
          if (!channelId || typeof channelId !== 'string' || !channelId.startsWith('game.')) continue;

          const status = membership.custom?.status;
          const inviteOnly = membership.channel.custom?.inviteOnly;

          // Only count INVITED status in invite-only games
          if (status === 'INVITED' && inviteOnly) {
            invites.push({
              gameId: membership.channel.custom.gameId,
              gameName: membership.channel.name,
              tileCount: membership.channel.custom.tileCount,
              emojiTheme: membership.channel.custom.emojiTheme,
              maxPlayers: membership.channel.custom.maxPlayers,
              invitedAt: membership.custom.invitedAt || Date.now()
            });
          }
        }

        console.log(`[Lobby] Found ${invites.length} pending invitations`);
        setInvitations(invites);
        setInvitationCount(invites.length);

      } catch (error) {
        console.error('[Lobby] Error fetching invitations:', error);
      }
    }

    fetchInvitations();
  }, [pubnub, playerInfo?.playerId]);

  const handleCreateGameWithOptions = async (options) => {
    setLoading(true);
    setError('');

    try {
      const location = getPlayerLocation();

      // Call PubNub On Request Function to create game (server generates gameId)
      const result = await createGame(
        playerInfo.playerId,
        playerInfo.playerName,
        options,  // { tileCount, emojiTheme, maxPlayers, gameName, tilePinningEnabled, verifiedPositionsEnabled }
        location
      );

      setShowCreateModal(false);

      // Game created successfully, join it
      onJoinGame({
        gameId: result.gameId,
        gameName: result.gameName,
        playerId: playerInfo.playerId,
        playerName: playerInfo.playerName,
        isCreator: true
      });
    } catch (err) {
      setError(err.message || 'Failed to create game');
      setLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!gameId.trim()) {
      setError('Please enter a game ID');
      return;
    }

    const gameIdUpper = gameId.trim().toUpperCase();

    setLoading(true);
    setError('');

    try {
      const location = getPlayerLocation();

      // Call PubNub On Request Function to join game
      await joinGameApi(gameIdUpper, playerInfo.playerId, playerInfo.playerName, location);

      // Successfully joined, connect to game
      onJoinGame({
        gameId: gameIdUpper,
        playerId: playerInfo.playerId,
        playerName: playerInfo.playerName,
        isCreator: false
      });
    } catch (err) {
      setError(err.message || 'Failed to join game');
      setLoading(false);
    }
  };

  const handleAcceptInvitation = useCallback(async (gameId) => {
    setLoading(true);
    setError('');

    try {
      const location = getPlayerLocation();

      // Call joinGame API (which now handles INVITED → JOINED transition)
      await joinGameApi(gameId, playerInfo.playerId, playerInfo.playerName, location);

      // Remove from invitations list
      setInvitations(prev => prev.filter(inv => inv.gameId !== gameId));
      setInvitationCount(prev => Math.max(0, prev - 1));

      // Navigate to game
      onJoinGame({
        gameId,
        playerId: playerInfo.playerId,
        playerName: playerInfo.playerName,
        isCreator: false
      });

    } catch (err) {
      console.error('[Lobby] Error accepting invitation:', err);
      setError(`Failed to accept invitation: ${err.message}`);
      setLoading(false);
    }
  }, [playerInfo, onJoinGame]);

  const handleRejectInvitation = useCallback(async (gameId) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/.netlify/functions/game?operation=reject_invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          playerId: playerInfo.playerId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject invitation');
      }

      // Remove from invitations list
      setInvitations(prev => prev.filter(inv => inv.gameId !== gameId));
      setInvitationCount(prev => Math.max(0, prev - 1));

      setLoading(false);

    } catch (err) {
      console.error('[Lobby] Error rejecting invitation:', err);
      setError(`Failed to reject invitation: ${err.message}`);
      setLoading(false);
    }
  }, [playerInfo.playerId]);

  const handleJoinExistingGame = async (existingGameId) => {
    setLoading(true);
    setError('');

    try {
      const location = getPlayerLocation();

      // Call PubNub On Request Function to join game
      await joinGameApi(existingGameId, playerInfo.playerId, playerInfo.playerName, location);

      // Successfully joined, connect to game
      onJoinGame({
        gameId: existingGameId,
        playerId: playerInfo.playerId,
        playerName: playerInfo.playerName,
        isCreator: false
      });
    } catch (err) {
      setError(err.message || 'Failed to join game');
      setLoading(false);
    }
  };

  // Handle leaving lobby
  const handleLeaveLobby = useCallback(async () => {
    setLeavingLobby(true);
    await new Promise(resolve => setTimeout(resolve, 300)); // Minimum spinner time
    if (onLeave) {
      onLeave();
    }
  }, [onLeave]);

  const isCurrentPlayer = (uuid) => uuid === playerInfo.playerId;

  // Filter out current player and get display names
  const otherPlayers = lobbyPlayers.filter(occupant => occupant.uuid !== playerInfo.playerId);

  // Filter games based on public/private tab and single-player exclusion
  const visibleGames = useMemo(() => {
    return availableGames.filter(game => {
      // Always filter out single-player games
      if ((game.maxPlayers || 10) <= 1) return false;

      if (gameFilter === 'public') {
        // Public tab: show games where inviteOnly is false or undefined
        return !game.inviteOnly;
      } else {
        // Private tab: show games where inviteOnly is true AND user has membership
        return game.inviteOnly && game.hasInvitation;
      }
    });
  }, [availableGames, gameFilter]);

  console.log('Available games:', availableGames.length, 'Visible games:', visibleGames.length, 'Filter:', gameFilter);

  return (
    <div className="lobby">
      <div className="lobby-header">
        <button
          className="leave-lobby-button"
          onClick={handleLeaveLobby}
          disabled={leavingLobby || loading}
        >
          {leavingLobby ? 'Leaving...' : '← Leave Lobby'}
        </button>
        <div>
          <h1>First Order Lobby</h1>
          <p className="game-info">Welcome, {playerInfo.playerName}!</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="history-button"
            onClick={onViewHistory}
            title="View Games History"
          >
            📜 History
          </button>
          <button
            className="music-button"
            onClick={handleMusicToggle}
            title={musicMuted ? "Unmute Music" : "Mute Music"}
          >
            {musicMuted ? '🔇' : '🎵'}
          </button>
          <button className="help-button" onClick={() => setShowHelp(true)} title="How to Play">
            ? Help
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="lobby-content">
        {/* Left Column: Players in Lobby */}
        <div className="lobby-section">
          <h2>Players in Lobby ({otherPlayers.length})</h2>
          <div className="player-list">
            {otherPlayers.length === 0 && (
              <p className="empty-message">No other players online</p>
            )}
            {otherPlayers.map(occupant => (
              <div
                key={occupant.uuid}
                className="player-item"
              >
                <PlayerName
                  name={occupant.state?.playerName || `Player ${occupant.uuid.substring(7, 20)}`}
                  location={occupant.state?.location}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Available Games */}
        <div className="lobby-section">
          {/* Show invitations if any exist */}
          {invitations.length > 0 && (
            <InvitationList
              invitations={invitations}
              onAccept={handleAcceptInvitation}
              onReject={handleRejectInvitation}
              loading={loading}
            />
          )}

          <div className="section-header">
            <h2>Available Games ({visibleGames.length})</h2>
            <button
              className="create-game-button"
              onClick={() => setShowCreateModal(true)}
              disabled={loading}
            >
              + Create New Game
            </button>
          </div>

          {/* Game Filter Tabs */}
          <div className="game-tabs">
            <button
              className={`tab-btn ${gameFilter === 'public' ? 'active' : ''}`}
              onClick={() => setGameFilter('public')}
            >
              Public Games
            </button>
            <button
              className={`tab-btn ${gameFilter === 'private' ? 'active' : ''}`}
              onClick={() => setGameFilter('private')}
            >
              Private Games
              {invitationCount > 0 && (
                <span className="notification-badge">{invitationCount}</span>
              )}
            </button>
          </div>

          <div className="games-grid">
            {visibleGames.length === 0 && (
              <p className="empty-message">No games available. Create one!</p>
            )}
            {visibleGames.map(game => (
              <GameCard
                key={game.gameId}
                game={game}
                playerInfo={playerInfo}
                onJoin={handleJoinExistingGame}
                loading={loading}
              />
            ))}
          </div>

          <div className="join-by-id">
            <div style={{ textAlign: 'center', margin: '20px 0', color: '#999' }}>
              OR
            </div>

            <input
              type="text"
              placeholder="Enter Game ID"
              value={gameId}
              onChange={(e) => {
                setGameId(e.target.value.toUpperCase());
                setError('');
              }}
              maxLength={8}
              disabled={loading}
            />

            <button onClick={handleJoinGame} disabled={loading}>
              {loading ? 'Joining...' : 'Join by ID'}
            </button>
          </div>
        </div>
      </div>

      {/* Create Game Modal */}
      {showCreateModal && (
        <CreateGameModal
          playerInfo={playerInfo}
          onCreateGame={handleCreateGameWithOptions}
          onCancel={() => setShowCreateModal(false)}
        />
      )}

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />

      {/* Loading overlay for leaving lobby */}
      {leavingLobby && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
}
