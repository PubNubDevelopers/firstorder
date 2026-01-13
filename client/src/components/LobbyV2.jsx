import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createGame, joinGame as joinGameApi, listGames } from '../utils/gameApi';
import { createTournament, joinTournament as joinTournamentApi, listTournaments } from '../utils/tournamentApi';
import { usePubNub } from '../hooks/usePubNub';
import CreateGameModal from './CreateGameModal';
import HelpModal from './HelpModal';
import GameGrid from './GameGrid';
import QuickActions from './QuickActions';
import PresenceList from './PresenceList';
import RecentGames from './RecentGames';
import InvitationList from './InvitationList';
import { getPlayerLocation } from '../utils/playerStorage';
import { formatLocationString } from '../utils/geolocation';
import musicPlayer from '../utils/musicPlayer';
import '../styles/lobby-v2.css';

/**
 * LobbyV2 - Redesigned lobby with three-zone layout
 * - Header: Title, user info, action buttons
 * - Left Sidebar: Quick actions, presence, recent games
 * - Center: Game grid with cards
 */
export default function LobbyV2({ playerInfo, pubnubConfig, onJoinGame, onCreateTournament, onLeave, onViewHistory }) {
  console.log('[LobbyV2] Component render - playerInfo:', playerInfo?.playerName, 'pubnubConfig.userId:', pubnubConfig?.userId);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [leavingLobby, setLeavingLobby] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [availableGames, setAvailableGames] = useState([]);
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [recentGames, setRecentGames] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [quickplaySearching, setQuickplaySearching] = useState(false);
  const [musicMuted, setMusicMuted] = useState(musicPlayer.isMuted);
  const [invitations, setInvitations] = useState([]);
  const [invitationCount, setInvitationCount] = useState(0);
  const [gameFilter, setGameFilter] = useState('public');  // 'public' | 'private'
  const [viewMode, setViewMode] = useState('games');  // 'games' | 'tournaments'

  const initializedRef = useRef(false);
  const gameListFetchedRef = useRef(false);

  const { isConnected, subscribe, unsubscribe, hereNow, pubnub } = usePubNub(pubnubConfig);

  // Use ref to avoid stale closure with pubnub
  const pubnubRef = useRef(pubnub);
  useEffect(() => {
    pubnubRef.current = pubnub;
  }, [pubnub]);

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
      console.log('[Lobby] Fetching lobby presence...');
      const result = await hereNow('lobby');
      const occupants = result.channels?.lobby?.occupants || [];
      console.log('[Lobby] Raw occupants:', JSON.stringify(occupants, null, 2));
      // Filter out current player and flatten state data
      const filteredOccupants = occupants
        .filter(occ => occ.uuid !== playerInfo?.playerId)
        .map(occ => {
          console.log('[Lobby] Processing occupant:', occ.uuid, 'state:', JSON.stringify(occ.state));
          console.log('[Lobby] State playerName:', occ.state?.playerName, 'typeof:', typeof occ.state?.playerName);
          console.log('[Lobby] State location:', occ.state?.location, 'typeof:', typeof occ.state?.location);
          return {
            uuid: occ.uuid,
            playerName: occ.state?.playerName || 'Anonymous',
            location: occ.state?.location || null
          };
        });
      console.log('[Lobby] Filtered occupants:', JSON.stringify(filteredOccupants, null, 2));
      setLobbyPlayers(filteredOccupants);
    } catch (err) {
      console.error('Error fetching lobby presence:', err);
    }
  }, [hereNow, playerInfo?.playerId]);

  // Fetch initial game list
  const fetchGameList = useCallback(async () => {
    if (!pubnubRef.current || !playerInfo?.playerId) {
      console.log('[fetchGameList] PubNub not ready yet');
      return;
    }

    try {
      console.log('[fetchGameList] Fetching game list with PubNub...');
      const result = await listGames(pubnubRef.current);
      console.log('[fetchGameList] Got games:', result.games?.length || 0);

      // For each private game, check if user has membership
      const gamesWithMembership = await Promise.all(
        (result.games || []).map(async (game) => {
          if (!game.inviteOnly) {
            return { ...game, hasInvitation: false };
          }

          // Check if user has membership in this private game
          try {
            const membersResponse = await pubnubRef.current.objects.getChannelMembers({
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
      console.error('[fetchGameList] Error:', err);
      setAvailableGames([]);
    }
  }, [playerInfo?.playerId]); // Added playerInfo dependency

  // Fetch tournament list
  const fetchTournamentList = useCallback(async () => {
    if (!pubnubRef.current || !playerInfo?.playerId) {
      console.log('[fetchTournamentList] PubNub not ready yet');
      return;
    }

    try {
      console.log('[fetchTournamentList] Fetching tournament list with PubNub...');
      const result = await listTournaments(pubnubRef.current);
      console.log('[fetchTournamentList] Got tournaments:', result.tournaments?.length || 0);

      // For each private tournament, check if user has membership
      const tournamentsWithMembership = await Promise.all(
        (result.tournaments || []).map(async (tournament) => {
          if (!tournament.inviteOnly) {
            return { ...tournament, hasInvitation: false };
          }

          // Check if user has membership in this private tournament
          try {
            const membersResponse = await pubnubRef.current.objects.getChannelMembers({
              channel: `t.${tournament.tournamentId}`,
              include: { UUIDFields: true, customFields: true }
            });

            const userMembership = membersResponse.data?.find(
              m => m.uuid.id === playerInfo.playerId
            );

            return {
              ...tournament,
              hasInvitation: !!userMembership,
              membershipStatus: userMembership?.custom?.status
            };
          } catch (error) {
            console.error(`[fetchTournamentList] Error checking membership for ${tournament.tournamentId}:`, error);
            return { ...tournament, hasInvitation: false };
          }
        })
      );

      setAvailableTournaments(tournamentsWithMembership);
    } catch (err) {
      console.error('[fetchTournamentList] Error:', err);
      setAvailableTournaments([]);
    }
  }, [playerInfo?.playerId]);

  // Fetch recent completed games (for sidebar widget)
  const fetchRecentGames = useCallback(async () => {
    if (!pubnubRef.current) {
      console.log('[fetchRecentGames] PubNub not ready yet');
      return;
    }

    try {
      console.log('[fetchRecentGames] Fetching recent completed games...');
      // Use PubNub App Context to get recent completed games
      const response = await pubnubRef.current.objects.getAllChannelMetadata({
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
          // Only process game channels - ensure channel.id is a string
          if (!channel.id || typeof channel.id !== 'string' || !channel.id.startsWith('game.')) continue;
          if (channel.custom?.gameState) {
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
      console.log('[fetchRecentGames] Got recent games:', games.length);
      setRecentGames(games);
    } catch (err) {
      console.error('[fetchRecentGames] Error:', err);
    }
  }, []); // Empty deps - uses ref to get current pubnub

  // Handle presence events
  const handlePresenceEvent = useCallback((event) => {
    const { action, uuid, state } = event;

    console.log('[Lobby] Presence event:', action, 'uuid:', uuid, 'state:', state);

    // Ignore events for current player
    if (uuid === playerInfo?.playerId) {
      console.log('[Lobby] Ignoring presence event for self');
      return;
    }

    // CRITICAL: Ignore 'join' events - they don't have state yet
    // Only handle 'state-change' events which have the player's name and location
    if (action === 'state-change') {
      console.log('[Lobby] State-change event - adding/updating player:', state?.playerName);
      setLobbyPlayers(prev => {
        const filtered = prev.filter(occupant => occupant.uuid !== uuid);
        // Flatten state data for PresenceList component
        return [...filtered, {
          uuid,
          playerName: state?.playerName || 'Unknown',
          location: state?.location || null
        }];
      });
    } else if (action === 'leave' || action === 'timeout') {
      console.log('[Lobby] Leave/timeout event - removing player');
      setLobbyPlayers(prev => prev.filter(occupant => occupant.uuid !== uuid));
    } else if (action === 'join') {
      console.log('[Lobby] Join event - IGNORING (waiting for state-change event with player data)');
      // Do nothing - wait for state-change event
    }
  }, [playerInfo?.playerId]);

  // Create/update User object when entering lobby (v3.0.0)
  useEffect(() => {
    if (!pubnub || !playerInfo?.playerId) {
      console.log('[LobbyV2] Skipping User object creation - PubNub or playerInfo not ready');
      return;
    }

    async function ensureUserExists() {
      try {
        console.log('[LobbyV2] Ensuring User object exists for', playerInfo.playerId);

        // Check if user exists
        let existingUser = null;
        try {
          const response = await pubnub.objects.getUUIDMetadata({
            uuid: playerInfo.playerId,
            include: { customFields: true }
          });
          existingUser = response.data;
        } catch (err) {
          console.log('[LobbyV2] User object does not exist, will create');
        }

        const playerLocation = getPlayerLocation();
        // Format location as string (e.g., "USA - AZ" or "Canada")
        const locationString = playerLocation ? formatLocationString(playerLocation) : null;

        if (!existingUser) {
          // Create new user
          console.log('[LobbyV2] Creating new User object with location:', locationString);
          await pubnub.objects.setUUIDMetadata({
            uuid: playerInfo.playerId,
            data: {
              name: playerInfo.playerName,
              custom: {
                playerLocation: locationString
              }
            }
          });
          console.log('[LobbyV2] User object created successfully');
        } else {
          // Update existing user (in case name or location changed)
          console.log('[LobbyV2] Updating existing User object');
          await pubnub.objects.setUUIDMetadata({
            uuid: playerInfo.playerId,
            data: {
              name: playerInfo.playerName,
              custom: {
                ...existingUser.custom,
                playerLocation: locationString
              }
            }
          });
          console.log('[LobbyV2] User object updated successfully');
        }
      } catch (error) {
        console.error('[LobbyV2] Error creating/updating User:', error);
      }
    }

    ensureUserExists();
  }, [pubnub, playerInfo?.playerId, playerInfo?.playerName]);

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
      createdAt: message.createdAt,
      inviteOnly: message.inviteOnly || false
    };

    setAvailableGames(prev => {
      if (prev.some(g => g.gameId === message.gameId)) return prev;
      const updated = [...prev, newGame];
      updated.sort((a, b) => b.createdAt - a.createdAt);
      return updated;
    });
  }, []);

  // Handle real-time tournament events
  const handleTournamentCreated = useCallback((message) => {
    const newTournament = {
      tournamentId: message.tournamentId,
      tournamentName: message.tournamentName || null,
      tileCount: message.tileCount || 5,
      emojiTheme: message.emojiTheme || 'food',
      maxPlayers: message.maxPlayers || 16,
      advancementRule: message.advancementRule || 2,
      status: 'CREATED',
      playerCount: message.playerCount || 1,
      createdAt: message.createdAt,
      hostPlayerId: message.hostPlayerId,
      hostName: message.hostName,
      inviteOnly: message.inviteOnly || false
    };

    setAvailableTournaments(prev => {
      if (prev.some(t => t.tournamentId === message.tournamentId)) return prev;
      const updated = [...prev, newTournament];
      updated.sort((a, b) => b.createdAt - a.createdAt);
      return updated;
    });
  }, []);

  const handleTournamentStarted = useCallback((message) => {
    setAvailableTournaments(prev => prev.filter(t => t.tournamentId !== message.tournamentId));
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

  // Handle messages on personal user channel
  const handleUserMessage = useCallback((event) => {
    const message = event.message;

    if (message.type === 'GAME_INVITATION') {
      console.log('[LobbyV2] Received game invitation:', message);

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

      // Log notification
      console.log(`[LobbyV2] Invitation from ${message.hostName} to ${message.gameName || 'a game'}!`);
    }
  }, []);

  // Subscribe to lobby channel
  useEffect(() => {
    console.log('[LobbyV2] ====== SUBSCRIPTION EFFECT TRIGGERED ======');
    console.log('[LobbyV2]   isConnected:', isConnected);
    console.log('[LobbyV2]   playerName:', playerInfo.playerName);
    console.log('[LobbyV2]   initializedRef.current:', initializedRef.current);
    console.log('[LobbyV2]   gameListFetchedRef.current:', gameListFetchedRef.current);

    if (!isConnected) {
      console.log('[LobbyV2] SKIP: Waiting for PubNub connection');
      return;
    }

    if (initializedRef.current) {
      console.log('[LobbyV2] SKIP: Already initialized');
      return;
    }

    console.log('[LobbyV2] *** PROCEEDING WITH INITIALIZATION ***');
    initializedRef.current = true;

    // Format location as string for presence state
    const playerLocation = getPlayerLocation();
    const locationString = playerLocation ? formatLocationString(playerLocation) : null;

    console.log('[LobbyV2] Setting presence state with:', {
      playerName: playerInfo.playerName,
      location: locationString,
      playerLocation
    });

    let unsubscribeLobby;
    let unsubscribeUser;

    // Async initialization to wait for presence state to be set
    (async () => {
      try {
        // Subscribe to lobby and WAIT for presence state to be set
        console.log('[LobbyV2] Subscribing to lobby with presence state...');
        unsubscribeLobby = await subscribe(
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
              case 'TOURNAMENT_CREATED':
                handleTournamentCreated(message);
                break;
              case 'TOURNAMENT_STARTED':
                handleTournamentStarted(message);
                break;
            }
          },
          {
            withPresence: true,
            presenceState: {
              playerName: playerInfo.playerName,
              location: locationString
            }
          }
        );

        console.log('[LobbyV2] ✓ Presence state set! Waiting 500ms for state propagation...');

        // CRITICAL: Wait for presence state to propagate through PubNub's infrastructure
        // setState callback confirms the API call succeeded, but state takes ~200-500ms
        // to propagate to all presence queries (hereNow) across PubNub's edge network
        await new Promise(resolve => setTimeout(resolve, 500));

        // Subscribe to personal user channel for invitations (no presence state needed)
        const userChannel = `user.${playerInfo.playerId}`;
        console.log(`[LobbyV2] Subscribing to user channel: ${userChannel}`);
        unsubscribeUser = await subscribe(userChannel, handleUserMessage);

        // NOW fetch initial presence data - setState has propagated!
        console.log('[LobbyV2] Fetching initial presence (after 500ms propagation delay)');
        await fetchLobbyPresence();

        // Fetch game list, tournament list, and recent games - ONLY ONCE per lobby session
        if (!gameListFetchedRef.current && pubnubRef.current) {
          console.log('[LobbyV2] *** FETCHING GAME LIST AND TOURNAMENT LIST FOR THE FIRST AND ONLY TIME ***');
          gameListFetchedRef.current = true;
          fetchGameList();
          fetchTournamentList();
          fetchRecentGames();
        }
      } catch (error) {
        console.error('[LobbyV2] Error during subscription setup:', error);
      }
    })();

    return () => {
      console.log('[LobbyV2] Cleanup - unsubscribing from lobby');
      initializedRef.current = false;
      if (unsubscribeLobby) {
        unsubscribeLobby();
      }
      if (unsubscribeUser) {
        unsubscribeUser();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, playerInfo.playerName, playerInfo.playerId]);

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

  // Handle create tournament
  const handleCreateTournament = async (options) => {
    setLoading(true);
    setError('');

    try {
      const location = await getPlayerLocation();
      const result = await createTournament(
        playerInfo.playerId,
        playerInfo.playerName,
        options,
        location
      );

      console.log('[LobbyV2] Tournament created successfully:', result.tournamentId);

      setShowCreateModal(false);
      onCreateTournament(result.tournamentId, true);
    } catch (err) {
      setError(err.message || 'Failed to create tournament');
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

  // Handle join tournament
  const handleJoinTournament = async (tournamentId) => {
    setLoading(true);
    setError('');

    try {
      const location = await getPlayerLocation();
      await joinTournamentApi(tournamentId, playerInfo.playerId, playerInfo.playerName, location);

      onCreateTournament(tournamentId, false);
    } catch (err) {
      setError(err.message || 'Failed to join tournament');
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

  // Handle accept invitation
  const handleAcceptInvitation = useCallback(async (gameId) => {
    setLoading(true);
    setError('');

    try {
      const location = await getPlayerLocation();
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
      console.error('[LobbyV2] Error accepting invitation:', err);
      setError(`Failed to accept invitation: ${err.message}`);
      setLoading(false);
    }
  }, [playerInfo, onJoinGame]);

  // Handle reject invitation
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
      console.error('[LobbyV2] Error rejecting invitation:', err);
      setError(`Failed to reject invitation: ${err.message}`);
      setLoading(false);
    }
  }, [playerInfo.playerId]);

  // Fetch existing invitations on mount
  useEffect(() => {
    if (!pubnubRef.current || !playerInfo?.playerId) return;

    async function fetchInvitations() {
      try {
        console.log('[LobbyV2] Fetching existing invitations...');

        const response = await pubnubRef.current.objects.getMemberships({
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

        console.log(`[LobbyV2] Found ${invites.length} pending invitations`);
        setInvitations(invites);
        setInvitationCount(invites.length);

      } catch (error) {
        console.error('[LobbyV2] Error fetching invitations:', error);
      }
    }

    fetchInvitations();
  }, [playerInfo?.playerId]);

  // Handle leave lobby
  const handleLeave = async () => {
    setLeavingLobby(true);
    setTimeout(() => {
      musicPlayer.stop();
      onLeave();
    }, 500);
  };

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

  // Filter tournaments based on public/private tab
  const visibleTournaments = useMemo(() => {
    return availableTournaments.filter(tournament => {
      if (gameFilter === 'public') {
        // Public tab: show tournaments where inviteOnly is false or undefined
        return !tournament.inviteOnly;
      } else {
        // Private tab: show tournaments where inviteOnly is true AND user has membership
        return tournament.inviteOnly && tournament.hasInvitation;
      }
    });
  }, [availableTournaments, gameFilter]);

  // Format lobby players with names from state
  // CRITICAL FIX: lobbyPlayers already has playerName at top level (not nested under state)
  // The fetchLobbyPresence function flattens the structure: { uuid, playerName, location }
  const formattedLobbyPlayers = useMemo(() => {
    if (!Array.isArray(lobbyPlayers)) return [];
    return lobbyPlayers.map(occupant => ({
      ...occupant,
      playerName: occupant.playerName || 'Anonymous',  // Changed: occupant.state?.playerName → occupant.playerName
      location: occupant.location
    }));
  }, [lobbyPlayers]);

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
          <p className="welcome-text">Welcome, {playerInfo?.playerName || 'Player'}!</p>
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

          {/* Invitation List */}
          <InvitationList
            invitations={invitations}
            onAccept={handleAcceptInvitation}
            onReject={handleRejectInvitation}
            loading={loading}
          />

          {/* Games/Tournaments View Switcher */}
          <div className="view-mode-tabs">
            <button
              className={`view-mode-btn ${viewMode === 'games' ? 'active' : ''}`}
              onClick={() => setViewMode('games')}
            >
              🎮 Games ({visibleGames.length})
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'tournaments' ? 'active' : ''}`}
              onClick={() => setViewMode('tournaments')}
            >
              🏆 Tournaments ({visibleTournaments.length})
            </button>
          </div>

          {/* Public/Private Tabs */}
          <div className="game-tabs">
            <button
              className={`tab-btn ${gameFilter === 'public' ? 'active' : ''}`}
              onClick={() => setGameFilter('public')}
            >
              Public {viewMode === 'games' ? 'Games' : 'Tournaments'}
            </button>
            <button
              className={`tab-btn ${gameFilter === 'private' ? 'active' : ''}`}
              onClick={() => setGameFilter('private')}
            >
              Private {viewMode === 'games' ? 'Games' : 'Tournaments'}
              {invitationCount > 0 && viewMode === 'games' && (
                <span className="notification-badge">{invitationCount}</span>
              )}
            </button>
          </div>

          {/* Game Grid or Tournament Grid */}
          {viewMode === 'games' ? (
            <GameGrid
              games={visibleGames}
              onJoinGame={handleJoinGame}
              loading={loading}
            />
          ) : (
            <div className="tournament-grid">
              {visibleTournaments.length === 0 ? (
                <div className="empty-state">
                  <p>No tournaments available</p>
                  <p className="hint">Create a tournament to get started!</p>
                </div>
              ) : (
                visibleTournaments.map(tournament => (
                  <div key={tournament.tournamentId} className="tournament-card">
                    <div className="tournament-header">
                      <h3>{tournament.tournamentName || `Tournament ${tournament.tournamentId}`}</h3>
                      <span className="tournament-badge">🏆</span>
                    </div>
                    <div className="tournament-details">
                      <div className="detail-row">
                        <span className="label">Host:</span>
                        <span className="value">{tournament.hostName}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Players:</span>
                        <span className="value">{tournament.playerCount} / {tournament.maxPlayers}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Advancement:</span>
                        <span className="value">Top {tournament.advancementRule}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Theme:</span>
                        <span className="value">{tournament.emojiTheme} • {tournament.tileCount} tiles</span>
                      </div>
                    </div>
                    <button
                      className="join-tournament-btn"
                      onClick={() => handleJoinTournament(tournament.tournamentId)}
                      disabled={loading}
                    >
                      {tournament.hasInvitation ? 'View Tournament' : 'Join Tournament'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateGameModal
          onCreateGame={handleCreateGame}
          onCreateTournament={handleCreateTournament}
          onCancel={() => setShowCreateModal(false)}
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
