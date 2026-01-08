import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createGame, joinGame as joinGameApi, listGames } from '../utils/gameApi';
import { usePubNub } from '../hooks/usePubNub';
import CreateGameModal from './CreateGameModal';
import HelpModal from './HelpModal';
import GameGrid from './GameGrid';
import QuickActions from './QuickActions';
import PresenceList from './PresenceList';
import RecentGames from './RecentGames';
import { getPlayerLocation } from '../utils/playerStorage';
import musicPlayer from '../utils/musicPlayer';
import '../styles/lobby-v2.css';

/**
 * LobbyV2 - Redesigned lobby with three-zone layout
 * - Header: Title, user info, action buttons
 * - Left Sidebar: Quick actions, presence, recent games
 * - Center: Game grid with cards
 */
export default function LobbyV2({ playerInfo, pubnubConfig, onJoinGame, onLeave, onViewHistory }) {
  console.log('[LobbyV2] Component render - playerInfo:', playerInfo?.playerName, 'pubnubConfig.userId:', pubnubConfig?.userId);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [leavingLobby, setLeavingLobby] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [availableGames, setAvailableGames] = useState([]);
  const [recentGames, setRecentGames] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [quickplaySearching, setQuickplaySearching] = useState(false);
  const [musicMuted, setMusicMuted] = useState(musicPlayer.isMuted);

  const initializedRef = useRef(false);
  const gameListFetchedRef = useRef(false);

  const { isConnected, subscribe, unsubscribe, hereNow, pubnub } = usePubNub(pubnubConfig);

  // Start background music when lobby loads and reset fetch ref on unmount
  useEffect(() => {
    musicPlayer.play();
    return () => {
      musicPlayer.stop();
      // Reset fetch ref so game list will be fetched again when returning to lobby
      gameListFetchedRef.current = false;
    };
  }, []);

  // Handle music mute toggle
  const handleMusicToggle = () => {
    const newMutedState = musicPlayer.toggleMute();
    setMusicMuted(newMutedState);
  };

  // Fetch initial presence list
  const fetchLobbyPresence = useCallback(async () => {
    try {
      console.log('Fetching lobby presence...');
      const result = await hereNow('lobby');
      const occupants = result.channels?.lobby?.occupants || [];
      setLobbyPlayers(occupants);
    } catch (err) {
      console.error('Error fetching lobby presence:', err);
    }
  }, [hereNow]);

  // Fetch initial game list
  const fetchGameList = useCallback(async () => {
    if (!pubnub) return;

    try {
      console.log('Fetching game list...');
      const result = await listGames(pubnub);
      setAvailableGames(result.games || []);
    } catch (err) {
      console.error('Error fetching game list:', err);
      setAvailableGames([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - we check pubnub exists inside the function

  // Fetch recent completed games (for sidebar widget)
  const fetchRecentGames = useCallback(async () => {
    if (!pubnub) return;

    try {
      // Use PubNub App Context to get recent completed games
      const response = await pubnub.objects.getAllChannelMetadata({
        limit: 5,
        include: {
          customFields: true,
          statusField: true
        },
        filter: "status == 'OVER'"
      });

      const games = [];
      if (response.data) {
        for (const channel of response.data) {
          if (channel.id.startsWith('game.') && channel.custom?.gameState) {
            const gameState = JSON.parse(channel.custom.gameState);
            if (gameState.phase === 'OVER' && gameState.endTT) {
              games.push({
                gameId: gameState.gameId,
                gameName: gameState.gameName,
                placements: gameState.placements || [],
                winnerPlayerId: gameState.winnerPlayerId,
                winnerName: gameState.winnerName,
                endTT: parseInt(gameState.endTT)
              });
            }
          }
        }
      }

      // Sort by endTT descending
      games.sort((a, b) => b.endTT - a.endTT);
      setRecentGames(games);
    } catch (err) {
      console.error('Error fetching recent games:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - we check pubnub exists inside the function

  // Handle presence events
  const handlePresenceEvent = useCallback((event) => {
    const { action, uuid, state } = event;

    if (action === 'join' || action === 'state-change') {
      setLobbyPlayers(prev => {
        const filtered = prev.filter(occupant => occupant.uuid !== uuid);
        return [...filtered, { uuid, state: state || {} }];
      });
    } else if (action === 'leave' || action === 'timeout') {
      setLobbyPlayers(prev => prev.filter(occupant => occupant.uuid !== uuid));
    }
  }, []);

  // Handle real-time game events
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
      if (prev.some(g => g.gameId === message.gameId)) return prev;
      const updated = [...prev, newGame];
      updated.sort((a, b) => b.createdAt - a.createdAt);
      return updated;
    });
  }, []);

  const handleGameStarted = useCallback((message) => {
    setAvailableGames(prev => prev.filter(g => g.gameId !== message.gameId));
  }, []);

  const handlePlayerJoinedGame = useCallback((message) => {
    setAvailableGames(prev => prev.map(game =>
      game.gameId === message.gameId
        ? {
            ...game,
            playerIds: message.playerIds,
            playerNames: message.playerNames || {},
            playerLocations: message.playerLocations || {},
            playerCount: message.playerIds.length
          }
        : game
    ));
  }, []);

  const handlePlayerLeftGame = useCallback((message) => {
    setAvailableGames(prev => prev.map(game =>
      game.gameId === message.gameId
        ? {
            ...game,
            playerIds: message.playerIds,
            playerNames: message.playerNames || {},
            playerCount: message.playerIds.length
          }
        : game
    ));
  }, []);

  const handleGameDeleted = useCallback((message) => {
    setAvailableGames(prev => prev.filter(g => g.gameId !== message.gameId));
  }, []);

  const handleGameNameUpdated = useCallback((message) => {
    setAvailableGames(prev => prev.map(game =>
      game.gameId === message.gameId ? { ...game, gameName: message.gameName } : game
    ));
  }, []);

  // Subscribe to lobby channel
  useEffect(() => {
    console.log('[LobbyV2] useEffect triggered - isConnected:', isConnected, 'playerName:', playerInfo.playerName, 'initialized:', initializedRef.current);

    if (!isConnected) {
      console.log('[LobbyV2] Waiting for PubNub connection...');
      return;
    }

    if (initializedRef.current) {
      console.log('[LobbyV2] Already initialized, skipping');
      return;
    }

    console.log('[LobbyV2] Initializing lobby subscriptions');
    initializedRef.current = true;

    const unsubscribeLobby = subscribe(
      'lobby',
      (event) => {
        if (event.action) {
          handlePresenceEvent(event);
          return;
        }

        const { message } = event;
        if (!message) return;

        switch (message.type) {
          case 'GAME_CREATED':
            handleGameCreated(message);
            break;
          case 'GAME_STARTED':
            handleGameStarted(message);
            break;
          case 'PLAYER_JOINED_GAME':
            handlePlayerJoinedGame(message);
            break;
          case 'PLAYER_LEFT_GAME':
            handlePlayerLeftGame(message);
            break;
          case 'GAME_DELETED':
            handleGameDeleted(message);
            break;
          case 'GAME_NAME_UPDATED':
            handleGameNameUpdated(message);
            break;
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

    // Fetch initial presence data
    console.log('[LobbyV2] Fetching initial presence');
    fetchLobbyPresence();

    return () => {
      console.log('[LobbyV2] Cleanup - unsubscribing from lobby');
      initializedRef.current = false;
      if (unsubscribeLobby) {
        unsubscribeLobby();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, playerInfo.playerName]);

  // Fetch game list and recent games when pubnub is ready - ONLY ONCE
  useEffect(() => {
    console.log('[LobbyV2] Game list fetch effect - pubnub exists:', !!pubnub, 'already fetched:', gameListFetchedRef.current);

    if (!pubnub) {
      console.log('[LobbyV2] No PubNub instance yet, skipping fetch');
      return;
    }

    if (gameListFetchedRef.current) {
      console.log('[LobbyV2] Game list ALREADY FETCHED - preventing duplicate fetch');
      return;
    }

    console.log('[LobbyV2] *** FETCHING GAME LIST FOR THE FIRST AND ONLY TIME ***');
    gameListFetchedRef.current = true;
    fetchGameList();
    fetchRecentGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchGameList, fetchRecentGames]); // Run when fetch functions are available (stable with empty deps)

  // Handle create game
  const handleCreateGame = async (options) => {
    setLoading(true);
    setError('');

    try {
      const location = await getPlayerLocation();
      const result = await createGame(
        playerInfo.playerId,
        playerInfo.playerName,
        options,
        location
      );

      setShowCreateModal(false);
      onJoinGame({
        gameId: result.gameId,
        gameName: result.gameName,
        playerId: playerInfo.playerId,
        playerName: playerInfo.playerName,
        isCreator: true
      });
    } catch (err) {
      setError(err.message || 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  // Handle join game
  const handleJoinGame = async (gameId) => {
    setLoading(true);
    setError('');

    try {
      const location = await getPlayerLocation();
      const result = await joinGameApi(gameId, playerInfo.playerId, playerInfo.playerName, location);

      onJoinGame({
        gameId,
        gameName: result.gameName || null,
        playerId: playerInfo.playerId,
        playerName: playerInfo.playerName,
        isCreator: false
      });
    } catch (err) {
      setError(err.message || 'Failed to join game');
      setLoading(false);
    }
  };

  // Handle quickplay - join first available game or create one
  const handleQuickplay = async () => {
    setQuickplaySearching(true);
    setError('');

    try {
      // Find first non-full game
      const availableGame = availableGames.find(g => g.playerCount < g.maxPlayers);

      if (availableGame) {
        await handleJoinGame(availableGame.gameId);
      } else {
        // No games available, create a quick game with defaults
        await handleCreateGame({
          tileCount: 4,
          emojiTheme: 'food',
          maxPlayers: 2,
          gameName: `${playerInfo.playerName}'s Quick Game`
        });
      }
    } catch (err) {
      setError(err.message || 'Quickplay failed');
    } finally {
      setQuickplaySearching(false);
    }
  };

  // Handle leave lobby
  const handleLeave = async () => {
    setLeavingLobby(true);
    setTimeout(() => {
      musicPlayer.stop();
      onLeave();
    }, 500);
  };

  // Format lobby players with names from state
  const formattedLobbyPlayers = lobbyPlayers.map(occupant => ({
    ...occupant,
    playerName: occupant.state?.playerName || 'Anonymous',
    location: occupant.state?.location
  }));

  return (
    <div className="lobby-v2">
      {/* Header */}
      <header className="lobby-header">
        <button
          className="leave-lobby-btn"
          onClick={handleLeave}
          disabled={leavingLobby}
        >
          {leavingLobby ? 'Leaving...' : '← Leave'}
        </button>

        <div className="header-center">
          <h1>First Order Lobby</h1>
          <p className="welcome-text">Welcome, {playerInfo.playerName}!</p>
        </div>

        <div className="header-actions">
          <button
            className="icon-btn history-btn"
            onClick={onViewHistory}
            title="View Games History"
            aria-label="View Games History"
          >
            📜
          </button>
          <button
            className="icon-btn music-btn"
            onClick={handleMusicToggle}
            title={musicMuted ? "Unmute Music" : "Mute Music"}
            aria-label={musicMuted ? "Unmute Music" : "Mute Music"}
          >
            {musicMuted ? '🔇' : '🎵'}
          </button>
          <button
            className="icon-btn help-btn"
            onClick={() => setShowHelp(true)}
            title="How to Play"
            aria-label="How to Play"
          >
            ?
          </button>
        </div>
      </header>

      {/* Main Content: Three-zone layout */}
      <div className="lobby-content">
        {/* Left Sidebar */}
        <aside className="lobby-sidebar">
          <QuickActions
            onCreateGame={() => setShowCreateModal(true)}
            onQuickplay={handleQuickplay}
            quickplaySearching={quickplaySearching}
          />

          <PresenceList players={formattedLobbyPlayers} />

          <RecentGames games={recentGames} onViewHistory={onViewHistory} />
        </aside>

        {/* Center Stage: Game Grid */}
        <main className="lobby-main">
          {error && <div className="error-banner">{error}</div>}

          <GameGrid
            games={availableGames}
            onJoinGame={handleJoinGame}
            loading={loading}
          />
        </main>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateGameModal
          onCreateGame={handleCreateGame}
          onClose={() => setShowCreateModal(false)}
          loading={loading}
        />
      )}

      {showHelp && (
        <HelpModal onClose={() => setShowHelp(false)} />
      )}

      {/* Loading overlay */}
      {leavingLobby && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
}
