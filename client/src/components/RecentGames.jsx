import React from 'react';

/**
 * RecentGames - Sidebar widget showing recent completed games
 * Displays last few games with winners for engagement
 */
export default function RecentGames({ games, onViewHistory }) {
  if (!games || games.length === 0) {
    return null; // Hide widget if no recent games
  }

  // Show max 3 recent games
  const displayGames = games.slice(0, 3);

  return (
    <div className="sidebar-widget recent-games">
      <h3 className="widget-title">Recent Games</h3>

      <div className="recent-items">
        {displayGames.map(game => {
          const winner = game.placements?.[0] || {
            playerName: game.winnerName,
            playerId: game.winnerPlayerId
          };

          return (
            <div key={game.gameId} className="recent-item">
              <span className="recent-medal">🥇</span>
              <div className="recent-info">
                <div className="recent-winner">{winner.playerName}</div>
                <div className="recent-game">{game.gameName || `Game ${game.gameId.slice(0, 4)}`}</div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="recent-view-all" onClick={onViewHistory}>
        View All Games →
      </button>
    </div>
  );
}
