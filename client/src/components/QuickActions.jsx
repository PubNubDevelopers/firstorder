import React from 'react';

/**
 * QuickActions - Sidebar widget for primary actions
 * Contains New Game and Quickplay buttons
 */
export default function QuickActions({ onCreateGame, onQuickplay, quickplaySearching }) {
  return (
    <div className="sidebar-widget quick-actions">
      <button
        className="quick-action-btn create-game-btn"
        onClick={onCreateGame}
      >
        <span className="btn-icon">+</span>
        <span className="btn-text">New Game</span>
      </button>

      <button
        className="quick-action-btn quickplay-btn"
        onClick={onQuickplay}
        disabled={quickplaySearching}
      >
        <span className="btn-icon">⚡</span>
        <span className="btn-text">
          {quickplaySearching ? 'Searching...' : 'Quickplay'}
        </span>
      </button>
    </div>
  );
}
