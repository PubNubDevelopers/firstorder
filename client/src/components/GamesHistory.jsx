import React, { useState, useEffect, useCallback } from 'react';
import { usePubNub } from '../hooks/usePubNub';
import { EMOJI_THEMES } from '../utils/emojiThemes';

/**
 * Fetch completed games from PubNub App Context
 * @param {Object} pubnub - PubNub instance
 * @param {number} limit - Number of games per page
 * @param {Object} page - Pagination cursor
 * @returns {Promise<{games: Array, totalCount: number, next: Object|null, prev: Object|null}>}
 */
async function fetchCompletedGames(pubnub, limit = 10, page = null) {
  if (!pubnub) {
    throw new Error('PubNub instance is required');
  }

  console.log('[fetchCompletedGames] Fetching completed games...');

  try {
    const params = {
      limit: limit,
      include: {
        customFields: true,
        statusField: true,
        totalCount: true  // Include total count in paginated response
      },
      filter: "status == 'OVER'" // Server-side filter for finished games only
    };

    if (page) {
      params.page = page;
    }

    console.log('[fetchCompletedGames] Calling getAllChannelMetadata with params:', params);
    const response = await pubnub.objects.getAllChannelMetadata(params);
    console.log('[fetchCompletedGames] Got response with', response.data?.length || 0, 'channels');

    const games = [];

    // Process game channels
    if (response.data) {
      for (const channel of response.data) {
        if (channel.id.startsWith('game.') &&
            channel.custom &&
            channel.custom.gameState) {

          const gameState = JSON.parse(channel.custom.gameState);

          // Only include games that were actually completed (have endTT)
          if (gameState.phase === 'OVER' && gameState.endTT) {
            console.log('[fetchCompletedGames] Found completed game:', gameState.gameId);

            // Calculate game duration if we have start and end times
            let durationMinutes = null;
            if (gameState.startTT && gameState.endTT) {
              const durationMs = parseInt(gameState.endTT) - parseInt(gameState.startTT);
              durationMinutes = Math.round(durationMs / 60000); // Convert to minutes
            }

            games.push({
              gameId: gameState.gameId,
              gameName: gameState.gameName,
              tileCount: gameState.tileCount,
              emojiTheme: gameState.emojiTheme,
              maxPlayers: gameState.maxPlayers,
              playerIds: gameState.playerIds,
              playerNames: gameState.playerNames || {},
              playerLocations: gameState.playerLocations || {},
              placements: gameState.placements || [],
              // Legacy winner fields for backward compatibility
              winnerPlayerId: gameState.winnerPlayerId,
              winnerName: gameState.winnerName,
              endTT: parseInt(gameState.endTT),
              startTT: gameState.startTT ? parseInt(gameState.startTT) : null,
              durationMinutes: durationMinutes,
              // Get move counts from players object
              players: gameState.players || {}
            });
          }
        }
      }
    }

    // Sort by endTT descending (most recent first)
    games.sort((a, b) => b.endTT - a.endTT);

    console.log('[fetchCompletedGames] Total completed games found:', games.length);

    return {
      games,
      totalCount: response.totalCount || games.length,
      next: response.next || null,
      prev: response.prev || null
    };
  } catch (error) {
    console.error('[fetchCompletedGames] Error:', error);
    throw error;
  }
}

/**
 * GameHistoryCard component - displays a single completed game
 */
function GameHistoryCard({ game }) {
  // Format completion date/time
  const completionDate = new Date(game.endTT);
  const dateStr = completionDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timeStr = completionDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Get placements (use placements array if available, fall back to legacy winner)
  const placements = game.placements && game.placements.length > 0
    ? game.placements
    : (game.winnerPlayerId ? [{
        playerId: game.winnerPlayerId,
        playerName: game.winnerName,
        placement: 1,
        moveCount: game.players[game.winnerPlayerId]?.moveCount || null
      }] : []);

  // Get all players with their finish info
  const allPlayers = game.playerIds.map(playerId => {
    const placement = placements.find(p => p.playerId === playerId);
    const playerState = game.players[playerId] || {};

    return {
      playerId,
      playerName: game.playerNames[playerId] || `Player ${playerId.slice(-4)}`,
      location: game.playerLocations?.[playerId],
      placement: placement?.placement || null,
      moveCount: placement?.moveCount || playerState.moveCount || null,
      finished: playerState.finished || false
    };
  });

  // Sort: finished players first (by placement), then unfinished
  allPlayers.sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    if (a.finished && b.finished) {
      return (a.placement || 999) - (b.placement || 999);
    }
    return 0;
  });

  // Get only finished players for compact display
  const finishedPlayers = allPlayers.filter(p => p.finished);

  return (
    <div className="game-history-card">
      <div className="game-history-header">
        <div className="header-content">
          <h3>
            {game.gameName || `Game ${game.gameId}`}
            <span className="game-id-badge">{game.gameId}</span>
          </h3>
          <div className="game-history-meta">
            <span className="date-badge">📅 {dateStr} at {timeStr}</span>
            {game.durationMinutes !== null && (
              <span className="duration-badge">⏱️ {game.durationMinutes} min</span>
            )}
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
              👥 {game.playerIds.length}
            </span>
          </div>

          {/* Compact placements display - all finishers shown horizontally */}
          {finishedPlayers.length > 0 && (
            <div className="placements-row">
              {finishedPlayers.map((player, index) => (
                <div key={player.playerId} className="placement-item">
                  <span className="placement-medal">
                    {player.placement === 1 && '🥇'}
                    {player.placement === 2 && '🥈'}
                    {player.placement === 3 && '🥉'}
                    {player.placement > 3 && `${player.placement}.`}
                  </span>
                  <span className="placement-name">{player.playerName}</span>
                  {player.moveCount !== null && (
                    <span className="placement-moves">({player.moveCount})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * GamesHistory component - displays paginated list of completed games
 */
export default function GamesHistory({ pubnubConfig, onBack }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pages, setPages] = useState({}); // Store page cursors

  const { pubnub } = usePubNub(pubnubConfig);

  // Load games for current page
  const loadGames = useCallback(async (pageNum, size) => {
    if (!pubnub) {
      console.log('PubNub not initialized yet');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get the page cursor for this page (if we've visited it before)
      const pageCursor = pages[pageNum];

      const result = await fetchCompletedGames(pubnub, size, pageCursor);
      setGames(result.games);

      // Set total count (use result.totalCount if available, otherwise estimate)
      if (result.totalCount) {
        setTotalCount(result.totalCount);
      }

      // Store next/prev cursors for navigation
      if (result.next) {
        setPages(prev => ({ ...prev, [pageNum + 1]: result.next }));
      }
      if (result.prev) {
        setPages(prev => ({ ...prev, [pageNum - 1]: result.prev }));
      }

      console.log('[GamesHistory] Loaded page', pageNum, 'with', result.games.length, 'games, totalCount:', result.totalCount);
    } catch (err) {
      console.error('Error loading games history:', err);
      setError('Failed to load games history');
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [pubnub, pages]);

  // Load games when component mounts or page size changes
  useEffect(() => {
    if (pubnub) {
      // Reset to page 1 when page size changes
      setCurrentPage(1);
      setPages({}); // Clear page cursors
      loadGames(1, pageSize);
    }
  }, [pubnub, pageSize]);

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / pageSize);

  // Navigation handlers
  const goToFirst = () => {
    setCurrentPage(1);
    setPages({}); // Clear cursors and reload from start
    loadGames(1, pageSize);
  };

  const goToPrevious = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      loadGames(newPage, pageSize);
    }
  };

  const goToNext = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      loadGames(newPage, pageSize);
    }
  };

  const goToLast = () => {
    // For last page, we need to calculate offset
    // Note: PubNub pagination doesn't support direct "jump to last"
    // So we'll just go to the calculated last page number
    const lastPage = totalPages;
    if (lastPage !== currentPage) {
      setCurrentPage(lastPage);
      loadGames(lastPage, pageSize);
    }
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
  };

  return (
    <div className="games-history">
      <div className="history-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Lobby
        </button>
        <h1>Games History</h1>
        <div className="page-size-selector">
          <label>Show:</label>
          <select value={pageSize} onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>per page</span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading games history...</p>
        </div>
      )}

      {!loading && games.length === 0 && (
        <div className="empty-history">
          <p>No completed games found.</p>
          <p>Finish a game to see it appear here!</p>
        </div>
      )}

      {!loading && games.length > 0 && (
        <>
          <div className="history-stats">
            <p>
              Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} completed games
            </p>
          </div>

          <div className="games-history-list">
            {games.map(game => (
              <GameHistoryCard key={game.gameId} game={game} />
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="pagination-controls">
            <button
              className="pagination-button"
              onClick={goToFirst}
              disabled={currentPage === 1}
            >
              First
            </button>
            <button
              className="pagination-button"
              onClick={goToPrevious}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="page-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="pagination-button"
              onClick={goToNext}
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
            <button
              className="pagination-button"
              onClick={goToLast}
              disabled={currentPage === totalPages}
            >
              Last
            </button>
          </div>
        </>
      )}
    </div>
  );
}
