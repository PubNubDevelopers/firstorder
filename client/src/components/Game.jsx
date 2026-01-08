import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePubNub } from '../hooks/usePubNub';
import { startGame as startGameApi, getGame, leaveGame as leaveGameApi, updateGameName } from '../utils/gameApi';
import PlayerBoard from './PlayerBoard';
import GameOverModal from './GameOverModal';
import ConfirmDialog from './ConfirmDialog';
import {
  playCountdownBeep,
  playGameStartSound,
  playPlayerJoinedSound,
  playYouJoinedSound,
  playWinnerSound,
  playLoserSound,
  playPlacementSound
} from '../utils/soundEffects';
import musicPlayer from '../utils/musicPlayer';

/**
 * Game component - main game interface
 */
export default function Game({ gameConfig, pubnubConfig, onLeave }) {
  const { gameId, gameName: initialGameName, playerId, playerName, isCreator } = gameConfig;

  // Game state
  const [gamePhase, setGamePhase] = useState('WAITING'); // WAITING, COUNTDOWN, LOCKED, OVER
  const [tiles, setTiles] = useState({});
  const [initialOrder, setInitialOrder] = useState(null);
  const [goalOrder, setGoalOrder] = useState(null);
  const [winnerPlayerId, setWinnerPlayerId] = useState(null);
  const [winnerName, setWinnerName] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [countdownValue, setCountdownValue] = useState(null);
  const [gameState, setGameState] = useState(initialGameName ? { gameName: initialGameName } : null);

  // Game name editing state
  const [editingName, setEditingName] = useState(false);
  const [newGameName, setNewGameName] = useState('');

  // Player states (keyed by playerId)
  const [playerStates, setPlayerStates] = useState({});

  // Modal state
  const [showGameOver, setShowGameOver] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [exitConfirmMessage, setExitConfirmMessage] = useState('');

  // Loading states
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isLeavingGame, setIsLeavingGame] = useState(false);

  // Music state
  const [musicMuted, setMusicMuted] = useState(musicPlayer.isMuted);

  // PubNub connection
  const { pubnub, publish, subscribe, isConnected, error: pubnubError } = usePubNub(pubnubConfig);

  // Start background music when game loads
  useEffect(() => {
    musicPlayer.play();
    return () => {
      // Music continues between lobby and game, so don't stop it
    };
  }, []);

  // Handle music mute toggle
  const handleMusicToggle = () => {
    const newMutedState = musicPlayer.toggleMute();
    setMusicMuted(newMutedState);
  };

  // Load initial game state and roster on mount
  useEffect(() => {
    getGame(gameId)
      .then(fetchedGameState => {
        // Store full game state
        setGameState(fetchedGameState);

        // Initialize all players from the roster
        setPlayerStates(prev => {
          const updated = { ...prev };

          fetchedGameState.playerIds.forEach(pid => {
            if (!updated[pid]) {
              const displayName = fetchedGameState.playerNames?.[pid] ||
                                 (pid === playerId ? playerName : `Player ${pid.slice(-4)}`);
              console.log(`Initializing player ${pid} with name: ${displayName}`);
              updated[pid] = {
                playerId: pid,
                playerName: displayName,
                currentOrder: null,
                moveCount: 0,
                positionsCorrect: 0,
                correctnessHistory: []
              };
            }
          });

          return updated;
        });
      })
      .catch(err => {
        console.error('Failed to load game state:', err);
      });
  }, [gameId, playerId, playerName]);

  // Initialize current player state
  useEffect(() => {
    if (!playerStates[playerId]) {
      setPlayerStates(prev => ({
        ...prev,
        [playerId]: {
          playerId,
          playerName,
          currentOrder: initialOrder || { a: 0, b: 1, c: 2, d: 3 },
          moveCount: 0,
          correctnessHistory: []
        }
      }));
    }
  }, [playerId, playerName, initialOrder, playerStates]);

  // Subscribe to game channels
  useEffect(() => {
    if (!isConnected || !pubnub) return;

    const gameChannel = `game.${gameId}`;
    const adminChannel = `admin.${gameId}`;

    // Fetch recent history from admin channel to catch any missed messages
    pubnub.history({
      channel: adminChannel,
      count: 10,
      stringifiedTimeToken: true
    }).then(response => {
      // Process any messages we might have missed
      response.messages.forEach(entry => {
        const message = entry.entry;
        console.log('History message:', message);

        if (message.type === 'COUNTDOWN' && message.countdown === 3 && message.tiles) {
          setTiles(message.tiles);
          setInitialOrder(message.initialOrder);
          setGamePhase('COUNTDOWN');
          setCountdownValue(message.countdown);
        }
      });
    }).catch(error => {
      console.log('Error fetching history:', error);
    });

    // Subscribe to admin channel for game lifecycle events
    const unsubscribeAdmin = subscribe(adminChannel, (event) => {
      const message = event.message;
      console.log('Admin message:', message);

      if (message.type === 'PLAYER_JOINED') {
        // Play sound - different sound if it's you vs. another player
        if (message.playerId === playerId) {
          playYouJoinedSound();
        } else {
          playPlayerJoinedSound();
        }

        // Update gameState with new playerIds
        setGameState(prev => ({
          ...prev,
          playerIds: message.playerIds,
          playerNames: message.playerNames
        }));

        // Update player roster when a player joins
        setPlayerStates(prev => {
          const updated = { ...prev };

          // Add any new players from the roster
          message.playerIds.forEach(pid => {
            if (!updated[pid]) {
              const displayName = message.playerNames?.[pid] || `Player ${pid.slice(-4)}`;
              updated[pid] = {
                playerId: pid,
                playerName: displayName,
                currentOrder: null, // Don't show other players' positions
                moveCount: 0,
                positionsCorrect: 0,
                correctnessHistory: []
              };
            }
          });

          return updated;
        });
      } else if (message.type === 'PLAYER_LEFT') {
        // Update gameState with updated playerIds
        setGameState(prev => ({
          ...prev,
          playerIds: message.playerIds,
          playerNames: message.playerNames
        }));

        // Remove player from roster when they leave
        setPlayerStates(prev => {
          const updated = { ...prev };
          delete updated[message.playerId];
          return updated;
        });
      } else if (message.type === 'HOST_LEFT') {
        // Host left during LIVE game - show alert and return to lobby
        alert(message.message || 'The host has left and ended the game.');
        onLeave(); // Return to lobby
      } else if (message.type === 'GAME_CANCELED') {
        // Host canceled the game during WAITING phase
        alert(message.reason || 'The host has canceled the game.');
        onLeave(); // Return to lobby
      } else if (message.type === 'COUNTDOWN') {
        console.log('COUNTDOWN received:', message.countdown);

        // Play countdown beep
        playCountdownBeep();

        setGamePhase('COUNTDOWN');
        setCountdownValue(message.countdown);

        // On first countdown message (3), initialize tiles and initial order
        if (message.countdown === 3 && message.tiles) {
          setTiles(message.tiles);
          setInitialOrder(message.initialOrder);
        }
      } else if (message.type === 'GAME_START') {
        // Play game start sound
        playGameStartSound();

        // If we're in countdown, show "Go!" first
        if (countdownValue !== null) {
          setCountdownValue('Go!');
          // Delay transition to LIVE by 800ms to show "Go!"
          setTimeout(() => {
            setGamePhase('LIVE');
            setCountdownValue(null);
          }, 800);
        } else {
          setGamePhase('LIVE');
          setCountdownValue(null);
        }

        setTiles(message.tiles);
        setInitialOrder(message.initialOrder);
        setGoalOrder(message.goalOrder); // Set goal order for verified positions feature

        // Update gameState with feature flags
        setGameState(prev => ({
          ...prev,
          tilePinningEnabled: message.tilePinningEnabled || false,
          verifiedPositionsEnabled: message.verifiedPositionsEnabled || false
        }));

        // Initialize current player with initial order
        // We only store currentOrder for the current player since we don't render other players' boards
        setPlayerStates(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(pid => {
            const isCurrentPlayer = pid === playerId;

            if (isCurrentPlayer) {
              // Current player gets the initial order to play with
              updated[pid] = {
                ...updated[pid],
                currentOrder: message.initialOrder,
                moveCount: 0,
                positionsCorrect: 0,
                correctnessHistory: []
              };
            } else {
              // Other players: just reset stats, don't need currentOrder (we don't render their board)
              updated[pid] = {
                ...updated[pid],
                moveCount: 0,
                positionsCorrect: 0,
                correctnessHistory: []
              };
            }
          });
          console.log('Updated player states after GAME_START:', updated);
          return updated;
        });
      } else if (message.type === 'PLAYER_FINISHED') {
        // Update placements array
        setPlacements(message.placements || []);

        // Update player state to mark as finished
        setPlayerStates(prev => {
          const updated = { ...prev };
          if (updated[message.playerId]) {
            updated[message.playerId].finished = true;
            updated[message.playerId].placement = message.placement;
            updated[message.playerId].finishTT = message.finishTT;
          }
          return updated;
        });

        // Play sound and show modal for this player
        if (message.playerId === playerId) {
          // This player finished - play appropriate sound
          if (message.placement === 1) {
            playWinnerSound();
          } else if (message.placement === 2 || message.placement === 3) {
            playPlacementSound(); // 2nd or 3rd place
          } else {
            playLoserSound(); // Beyond 3rd place
          }

          // Show modal immediately when this player finishes
          setShowGameOver(true);
        }
      } else if (message.type === 'GAME_OVER') {
        setGamePhase('OVER');
        setGoalOrder(message.goalOrder);
        setPlacements(message.placements || []);

        // Backward compatibility
        setWinnerPlayerId(message.winnerPlayerId);
        setWinnerName(message.winnerName);

        setShowGameOver(true);

        // Play appropriate sound if haven't finished yet
        const myPlacement = message.placements?.find(p => p.playerId === playerId);
        if (myPlacement) {
          // Already played sound when PLAYER_FINISHED was received
        } else {
          // Didn't finish - play loser sound
          playLoserSound();
        }
      }
    });

    // Subscribe to game channel for progress updates
    const unsubscribeGame = subscribe(gameChannel, (event) => {
      const message = event.message;
      console.log('Game message:', message);

      if (message.type === 'PROGRESS_UPDATE') {
        setPlayerStates(prev => {
          const existingPlayer = prev[message.playerId];

          // If we don't have this player yet, initialize them with current state
          if (!existingPlayer) {
            return {
              ...prev,
              [message.playerId]: {
                playerId: message.playerId,
                playerName: `Player ${message.playerId.slice(-4)}`, // Use last 4 chars as name
                currentOrder: null, // Don't show other players' positions
                moveCount: message.moveCount,
                positionsCorrect: message.positionsCorrect,
                correctnessHistory: [message.positionsCorrect]
              }
            };
          }

          // Update existing player
          return {
            ...prev,
            [message.playerId]: {
              ...existingPlayer,
              moveCount: message.moveCount,
              positionsCorrect: message.positionsCorrect,
              correctnessHistory: [
                ...(existingPlayer.correctnessHistory || []),
                message.positionsCorrect
              ]
            }
          };
        });
      }
    });

    return () => {
      unsubscribeAdmin();
      unsubscribeGame();
    };
  }, [isConnected, gameId, playerId, subscribe, pubnub]);

  // Handle leave game
  const handleLeaveGame = useCallback(() => {
    // Show confirmation dialog
    if (gamePhase === 'WAITING') {
      setExitConfirmMessage('Are you sure you want to leave this game?');
    } else {
      setExitConfirmMessage('Are you sure you want to return to the lobby?');
    }
    setShowExitConfirm(true);
  }, [gamePhase]);

  // Confirm leave
  const confirmLeaveGame = useCallback(async () => {
    setShowExitConfirm(false);
    setIsLeavingGame(true);

    try {
      // Call API for WAITING or LIVE/OVER phases
      if (gamePhase === 'WAITING' || gamePhase === 'LIVE' || gamePhase === 'OVER') {
        await leaveGameApi(gameId, playerId);

        // If host is leaving WAITING phase, give a brief moment for GAME_CANCELED message to be sent
        // If host is leaving LIVE phase, give a brief moment for HOST_LEFT message to be sent
        // The message handlers will call onLeave() for us
        if (isCreator && (gamePhase === 'WAITING' || gamePhase === 'LIVE')) {
          // Brief delay to allow message to propagate
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Return to lobby for all phases
      if (onLeave) {
        onLeave();
      }
    } catch (err) {
      console.error('Error leaving game:', err);
      alert(`Failed to leave game: ${err.message}`);
      setIsLeavingGame(false);
    }
  }, [gameId, playerId, gamePhase, onLeave, isCreator]);

  // Handle start game
  const handleStartGame = useCallback(async () => {
    setIsStartingGame(true);
    try {
      const response = await startGameApi(gameId, playerId);

      // Capture goal order from response for verified positions feature
      const goalOrder = response.goalOrder;
      if (goalOrder) {
        setGoalOrder(goalOrder);
      }

      const adminChannel = `admin.${gameId}`;
      const tiles = response.tiles;
      const initialOrder = response.initialOrder;

      // Wait 500ms to ensure all players are subscribed to admin channel
      await new Promise(resolve => setTimeout(resolve, 500));

      // Publish countdown: 3
      await publish(adminChannel, {
        v: 1,
        type: 'COUNTDOWN',
        gameId: gameId,
        countdown: 3,
        tiles: tiles,
        initialOrder: initialOrder
      });

      // Wait 1 second, then publish: 2
      await new Promise(resolve => setTimeout(resolve, 1000));
      await publish(adminChannel, {
        v: 1,
        type: 'COUNTDOWN',
        gameId: gameId,
        countdown: 2
      });

      // Wait 1 second, then publish: 1
      await new Promise(resolve => setTimeout(resolve, 1000));
      await publish(adminChannel, {
        v: 1,
        type: 'COUNTDOWN',
        gameId: gameId,
        countdown: 1
      });

      // Wait 1 second, then publish GAME_START
      await new Promise(resolve => setTimeout(resolve, 1000));
      await publish(adminChannel, {
        v: 1,
        type: 'GAME_START',
        gameId: gameId,
        phase: 'LIVE',
        tiles: tiles,
        initialOrder: initialOrder,
        goalOrder: goalOrder, // Include goalOrder for verified positions feature
        tilePinningEnabled: gameState?.tilePinningEnabled || false,
        verifiedPositionsEnabled: gameState?.verifiedPositionsEnabled || false
      });

    } catch (err) {
      console.error('Error starting game:', err);
      alert(`Failed to start game: ${err.message}`);
      setIsStartingGame(false);
    }
  }, [gameId, playerId, publish, gameState]);

  // Handle game name update
  const handleUpdateGameName = async () => {
    if (!newGameName.trim()) {
      alert('Game name cannot be empty');
      return;
    }

    try {
      await updateGameName(gameId, playerId, newGameName.trim());
      setGameState(prev => ({ ...prev, gameName: newGameName.trim() }));
      setEditingName(false);
    } catch (err) {
      alert(`Failed to update name: ${err.message}`);
    }
  };

  // Handle player move
  const handleMove = useCallback(async (newOrder) => {
    if (gamePhase !== 'LIVE') return;

    try {
      console.log('Submitting move:', newOrder);

      // Optimistically update local state
      setPlayerStates(prev => ({
        ...prev,
        [playerId]: {
          ...prev[playerId],
          currentOrder: newOrder
        }
      }));

      // Publish move to server
      await publish(`game.${gameId}`, {
        v: 1,
        type: 'MOVE_SUBMIT',
        gameId,
        playerId,
        order: newOrder,
        ts: Date.now()
      });
      console.log('Move published successfully');
    } catch (err) {
      console.error('Error submitting move:', err);
    }
  }, [publish, gameId, playerId, gamePhase]);

  if (pubnubError) {
    return (
      <div className="error-message">
        PubNub Error: {pubnubError}
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="waiting-message">
        Connecting to game server...
      </div>
    );
  }

  if (gamePhase === 'WAITING') {
    // Check if host name is available
    const hostPlayer = gameState?.playerIds?.[0] ? playerStates[gameState.playerIds[0]] : null;
    const canStartGame = hostPlayer && hostPlayer.playerName && !isStartingGame;

    return (
      <div className="game-container">
        {(isStartingGame || isLeavingGame) && (
          <div className="loading-overlay">
            <div className="spinner"></div>
          </div>
        )}
        <div className="game-header">
          <div>
            {editingName && isCreator ? (
              <div className="edit-name-container">
                <input
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  maxLength={30}
                  placeholder="Enter game name"
                  disabled={isStartingGame || isLeavingGame}
                />
                <button onClick={handleUpdateGameName} disabled={isStartingGame || isLeavingGame}>Save</button>
                <button onClick={() => setEditingName(false)} disabled={isStartingGame || isLeavingGame}>Cancel</button>
              </div>
            ) : (
              <>
                <h2>
                  {gameState?.gameName || `Game ${gameId}`}
                  <span className="game-id-badge">{gameId}</span>
                  {isCreator && (
                    <button
                      className="edit-name-button"
                      onClick={() => {
                        setNewGameName(gameState?.gameName || '');
                        setEditingName(true);
                      }}
                      title="Edit game name"
                      disabled={isStartingGame || isLeavingGame}
                    >
                      ✏️
                    </button>
                  )}
                </h2>
                <p className="game-info">Share this ID with other players</p>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="music-button"
              onClick={handleMusicToggle}
              title={musicMuted ? "Unmute Music" : "Mute Music"}
            >
              {musicMuted ? '🔇' : '🎵'}
            </button>
            <button
              className="leave-game-button"
              onClick={handleLeaveGame}
              disabled={isStartingGame || isLeavingGame}
            >
              {isLeavingGame ? 'Leaving...' : 'Leave Game'}
            </button>
          </div>
        </div>

        <div className="waiting-content">
          <div className="waiting-message">
            <p>Waiting for players to join...</p>
            {isCreator && (
              <button
                className="start-game-button"
                onClick={handleStartGame}
                disabled={!canStartGame}
              >
                {isStartingGame ? 'Starting...' : 'Start Game'}
              </button>
            )}
            {!isCreator && (
              <p>Waiting for host to start the game...</p>
            )}
          </div>

          {/* Player List in Waiting Room */}
          {hostPlayer && hostPlayer.playerName && (
            <div className="waiting-players">
              <h3>Players ({Object.keys(playerStates).length} of {gameState?.maxPlayers || 10})</h3>
              <div className="waiting-player-list">
                {gameState?.playerIds && gameState.playerIds
                  .map(pid => playerStates[pid])
                  .filter(player => player && player.playerId)
                  .map((player, index) => {
                    const isHost = index === 0; // First player in playerIds array is host
                    const isYou = player.playerId === playerId;
                    return (
                      <div key={player.playerId} className="waiting-player-item">
                        {isHost && <span className="host-icon">👑</span>}
                        <span className="player-name">
                          {player.playerName}
                          {isYou && ' (You)'}
                        </span>
                        {isHost && <span className="host-badge">Host</span>}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Exit confirmation dialog */}
        <ConfirmDialog
          isOpen={showExitConfirm}
          title="Leave Game"
          message={exitConfirmMessage}
          confirmText="Leave"
          cancelText="Stay"
          onConfirm={confirmLeaveGame}
          onCancel={() => setShowExitConfirm(false)}
        />
      </div>
    );
  }

  const currentPlayerState = playerStates[playerId];

  // Create stable color mapping for each player (based on when they joined, not their current rank)
  // This is recalculated when players join/leave but that's infrequent
  const playerColorMap = {};
  const sortedPlayerIds = Object.keys(playerStates).sort();
  sortedPlayerIds.forEach((pid, index) => {
    const hue = (index * 137.5) % 360; // Golden angle for good color distribution
    playerColorMap[pid] = `hsl(${hue}, 70%, 60%)`;
  });

  const allPlayers = Object.values(playerStates)
    .filter(p => p && p.playerId)
    .sort((a, b) => {
      // Finished players first, sorted by placement
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      if (a.finished && b.finished) {
        return (a.placement || 999) - (b.placement || 999);
      }
      // Active players sorted by progress
      return (b.positionsCorrect || 0) - (a.positionsCorrect || 0);
    });

  return (
    <div className="game-container">
      <div className="game-header">
        <div>
          <h2>Game ID: {gameId}</h2>
          <p className="game-info">
            {gamePhase === 'LIVE' ? 'Game in progress' : 'Game over'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="music-button"
            onClick={handleMusicToggle}
            title={musicMuted ? "Unmute Music" : "Mute Music"}
          >
            {musicMuted ? '🔇' : '🎵'}
          </button>
          <button
            className="leave-game-button"
            onClick={handleLeaveGame}
          >
            Return to Lobby
          </button>
        </div>
      </div>


      {/* Countdown overlay */}
      {gamePhase === 'COUNTDOWN' && countdownValue !== null && (
        <div className="countdown-overlay">
          <div className="countdown-display">
            {countdownValue === 'Go!' ? (
              <div className="countdown-go">Go!</div>
            ) : (
              <div className="countdown-number">{countdownValue}</div>
            )}
          </div>
        </div>
      )}

      <div className="game-content">
        {/* Current player board - only show when game is LIVE or OVER */}
        {(gamePhase === 'LIVE' || gamePhase === 'OVER') && currentPlayerState && currentPlayerState.currentOrder && tiles && (
          <PlayerBoard
            playerId={playerId}
            playerName={playerName}
            currentOrder={currentPlayerState.currentOrder}
            moveCount={currentPlayerState.moveCount}
            positionsCorrect={currentPlayerState.positionsCorrect}
            correctnessHistory={currentPlayerState.correctnessHistory || []}
            tiles={tiles}
            goalOrder={goalOrder}
            isCurrentPlayer={true}
            isGameOver={gamePhase === 'OVER'}
            isWinner={winnerPlayerId === playerId}
            isFinished={currentPlayerState.finished || false}
            isPinningEnabled={gameState?.tilePinningEnabled || false}
            isVerifiedPositionsEnabled={gameState?.verifiedPositionsEnabled || false}
            onMove={handleMove}
          />
        )}

        {/* All players' progress table - only show when game is LIVE or OVER */}
        {(gamePhase === 'LIVE' || gamePhase === 'OVER') && allPlayers.length > 0 && (
          <div className="other-players-section">
            <h3>Players</h3>
            <table className="other-players-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Progress</th>
                  <th>Moves</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allPlayers.map((player) => {
                  const tileCount = Object.keys(tiles || {}).length || 4;
                  const correct = player.positionsCorrect || 0;
                  const progressPercent = (correct / tileCount) * 100;

                  // Get stable color for this player
                  const playerColor = playerColorMap[player.playerId];

                  return (
                    <tr
                      key={player.playerId}
                      className={player.playerId === playerId ? 'current-player-row' : ''}
                    >
                      <td>
                        {player.playerName || `Player ${player.playerId.slice(-4)}`}
                        {player.playerId === playerId && <span className="you-badge"> (You)</span>}
                      </td>
                      <td className="progress-cell">
                        <div className="player-progress-bar">
                          {Array.from({ length: tileCount }).map((_, i) => (
                            <div
                              key={i}
                              className={`progress-segment ${i < correct ? 'filled' : 'empty'}`}
                              style={{
                                backgroundColor: i < correct ? playerColor : '#e0e0e0'
                              }}
                              title={`${correct} / ${tileCount} correct`}
                            />
                          ))}
                        </div>
                        <span className="progress-text">{correct}/{tileCount}</span>
                      </td>
                      <td>{player.moveCount || 0}</td>
                      <td>
                        {player.finished && player.placement ? (
                          <span className={`placement-badge placement-${player.placement}`}>
                            {player.placement === 1 && '🥇 1st'}
                            {player.placement === 2 && '🥈 2nd'}
                            {player.placement === 3 && '🥉 3rd'}
                          </span>
                        ) : (
                          <span className="playing-badge">Playing</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Game over modal */}
      {showGameOver && goalOrder && (
        <GameOverModal
          isWinner={placements?.[0]?.playerId === playerId}
          winnerName={placements?.[0]?.playerName || winnerName}
          goalOrder={goalOrder}
          tiles={tiles}
          moveCount={currentPlayerState?.moveCount}
          placements={placements}
          playerId={playerId}
          onClose={() => setShowGameOver(false)}
          onReturnToLobby={onLeave}
        />
      )}

      {/* Exit confirmation dialog */}
      <ConfirmDialog
        isOpen={showExitConfirm}
        title="Leave Game"
        message={exitConfirmMessage}
        confirmText="Leave"
        cancelText="Stay"
        onConfirm={confirmLeaveGame}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
}
