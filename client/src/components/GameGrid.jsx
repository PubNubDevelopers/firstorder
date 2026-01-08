import React from 'react';
import GameCard from './GameCard';

/**
 * GameGrid - Grid container for game cards
 * Displays games in 3-column responsive grid with empty state
 */
export default function GameGrid({ games, onJoinGame, loading }) {
  // Empty state
  if (games.length === 0) {
    return (
      <div className="game-grid-empty">
        <div className="empty-state-hero">
          <div className="empty-icon">🎮</div>
          <h2>No games yet—be the first!</h2>
          <p>Create a new game or use Quickplay to get started</p>
        </div>
      </div>
    );
  }

  // Few games state (1-2 games)
  if (games.length <= 2) {
    return (
      <div className="game-grid-container">
        <div className="game-grid-header">
          <h2>Available Games</h2>
          <p className="games-count">{games.length} game{games.length !== 1 ? 's' : ''} waiting</p>
        </div>
        <div className="game-grid">
          {games.map(game => (
            <GameCard
              key={game.gameId}
              game={game}
              onJoin={onJoinGame}
              loading={loading}
            />
          ))}
        </div>
        <div className="game-grid-footer">
          <p>Looking for more action? Create another game!</p>
        </div>
      </div>
    );
  }

  // Many games state (3+ games)
  return (
    <div className="game-grid-container">
      <div className="game-grid-header">
        <h2>Available Games</h2>
        <div className="games-stats">
          <span className="games-count">{games.length} active game{games.length !== 1 ? 's' : ''}</span>
          {games.length >= 10 && <span className="games-badge">🔥 Lobby is buzzing!</span>}
        </div>
      </div>
      <div className="game-grid">
        {games.map(game => (
          <GameCard
            key={game.gameId}
            game={game}
            onJoin={onJoinGame}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
}
