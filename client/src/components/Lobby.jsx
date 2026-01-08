import React, { useState, useEffect, useCallback } from 'react';
import { createGame, joinGame as joinGameApi, listGames } from '../utils/gameApi';
import { usePubNub } from '../hooks/usePubNub';
import CreateGameModal from './CreateGameModal';
import HelpModal from './HelpModal';
import { getLocationDisplay } from '../utils/flagEmojis';
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
                <span className="location-flags">
                  {getLocationDisplay(game.playerLocations?.[pid])}
                </span>
                <span className="player-name">
                  {game.playerNames[pid] || pid.substring(0, 20)}
                </span>
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
    if (!pubnub) {
      console.log('PubNub not initialized yet, skipping game list fetch');
      return;
    }

    try {
      console.log('Fetching game list...');
      const result = await listGames(pubnub);
      console.log('Game list result:', result);
      console.log('Number of games:', result.games?.length || 0);
      setAvailableGames(result.games || []);
    } catch (err) {
      console.error('Error fetching game list:', err);
      // Set empty array on error to prevent undefined issues
      setAvailableGames([]);
    }
  }, [pubnub]);

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

  // Subscribe to lobby channel with presence
  useEffect(() => {
    console.log('Lobby useEffect - isConnected:', isConnected);
    if (!isConnected) return;

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

    console.log('Subscription complete, fetching initial presence...');
    // Fetch initial presence data
    fetchLobbyPresence();

    return () => {
      unsubscribeLobby();
    };
  }, [
    isConnected,
    subscribe,
    handlePresenceEvent,
    handleGameCreated,
    handleGameStarted,
    handlePlayerJoinedGame,
    handlePlayerLeftGame,
    handleGameDeleted,
    handleGameNameUpdated,
    playerInfo.playerName
    // NOTE: fetchLobbyPresence intentionally excluded to prevent infinite loop
  ]);

  // Fetch game list separately - only once when component mounts
  useEffect(() => {
    fetchGameList();
  }, []); // Empty deps = only runs once on mount

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

  // Filter out single-player games
  const visibleGames = availableGames.filter(game => (game.maxPlayers || 10) > 1);
  console.log('Available games:', availableGames.length, 'Visible games:', visibleGames.length);

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
                <span className="location-flags">
                  {getLocationDisplay(occupant.state?.location)}
                </span>
                {occupant.state?.playerName || `Player ${occupant.uuid.substring(7, 20)}`}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Available Games */}
        <div className="lobby-section">
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
