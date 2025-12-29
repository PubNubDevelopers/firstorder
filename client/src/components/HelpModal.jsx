import React from 'react';

/**
 * HelpModal component - displays game rules and instructions
 */
export default function HelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content help-modal" onClick={(e) => e.stopPropagation()}>
        <h2>How to Play First Order</h2>

        <div className="help-section">
          <h3>🎯 Objective</h3>
          <p>Arrange the scrambled emoji tiles into their correct order as quickly as possible. The player who solves the puzzle in the fewest moves wins!</p>
        </div>

        <div className="help-section">
          <h3>🎮 Basic Gameplay</h3>
          <ol>
            <li><strong>Create or Join a Game:</strong> Start a new game or join an existing one using a Game ID</li>
            <li><strong>Swap Tiles:</strong> Click on two tiles to swap their positions</li>
            <li><strong>Track Progress:</strong> Watch your move count and see how many tiles are in the correct position</li>
            <li><strong>Win:</strong> Be the first to arrange all tiles in the correct order!</li>
          </ol>
        </div>

        <div className="help-section">
          <h3>⚙️ Game Modes</h3>
          <ul>
            <li><strong>Standard:</strong> Classic gameplay - swap tiles to solve the puzzle</li>
            <li><strong>Tile Pinning:</strong> Pin tiles you believe are correct to avoid accidentally moving them</li>
            <li><strong>Verified Positions:</strong> Tiles that are in the correct position show a checkmark</li>
          </ul>
        </div>

        <div className="help-section">
          <h3>📊 Scoring</h3>
          <p>Your score is based on:</p>
          <ul>
            <li><strong>Move Count:</strong> Fewer moves = better score</li>
            <li><strong>Correctness History:</strong> Track shows how many tiles were correct after each move</li>
          </ul>
        </div>

        <div className="help-section">
          <h3>🎨 Customization</h3>
          <p>When creating a game, you can customize:</p>
          <ul>
            <li><strong>Number of Tiles:</strong> Choose between 4-8 tiles</li>
            <li><strong>Emoji Theme:</strong> Select from various emoji themes (food, animals, nature, etc.)</li>
            <li><strong>Max Players:</strong> Set how many players can join (1-99)</li>
            <li><strong>Game Name:</strong> Give your game a custom name</li>
          </ul>
        </div>

        <div className="help-section">
          <h3>💡 Tips & Strategies</h3>
          <ul>
            <li>Start by identifying tiles you're confident are in the correct position</li>
            <li>Work from left to right or focus on getting a few tiles correct first</li>
            <li>In Tile Pinning mode, pin tiles you're sure about to avoid mistakes</li>
            <li>Watch the correctness history to see if your moves are improving your position</li>
            <li>Remember: fewer moves wins, not speed!</li>
          </ul>
        </div>

        <div className="help-section">
          <h3>🏆 Multiplayer</h3>
          <p>In multiplayer games:</p>
          <ul>
            <li>All players see the same scrambled order at the start</li>
            <li>Each player works on their own board independently</li>
            <li>The first player to get all tiles correct wins</li>
            <li>View other players' progress in the Players table</li>
          </ul>
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={onClose}>Got it!</button>
        </div>
      </div>
    </div>
  );
}
