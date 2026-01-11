import React, { useState, useEffect, useRef } from 'react';
import Tile from './Tile';
import PlayerName from './PlayerName';
import { orderToArray, indexToPosition, swapPositions, calculatePositionsCorrect } from '../utils/gameUtils';
import { playTileSwapSound } from '../utils/soundEffects';

/**
 * PlayerBoard component - displays a player's tile board with game state
 */
export default function PlayerBoard({
  playerId,
  playerName,
  playerLocation,
  currentOrder,
  moveCount,
  positionsCorrect,
  correctnessHistory,
  tiles,
  goalOrder,
  isCurrentPlayer,
  isGameOver,
  isWinner,
  isFinished,
  isPinningEnabled,
  isVerifiedPositionsEnabled,
  onMove
}) {
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [swappingPositions, setSwappingPositions] = useState(null);
  const [pinnedPositions, setPinnedPositions] = useState(new Set());
  const previousOrderRef = useRef(currentOrder);

  // Detect when order changes and trigger animation
  useEffect(() => {
    if (!previousOrderRef.current || !currentOrder) {
      previousOrderRef.current = currentOrder;
      return;
    }

    // Find which two positions changed
    const tileCount = Object.keys(currentOrder).length;
    const positions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].slice(0, tileCount);
    const changedPositions = positions.filter(
      pos => previousOrderRef.current[pos] !== currentOrder[pos]
    );

    if (changedPositions.length === 2) {
      // Start swap animation
      setSwappingPositions(changedPositions);

      // Play swap sound effect
      playTileSwapSound(0.4);

      // Clear animation after it completes
      const timer = setTimeout(() => {
        setSwappingPositions(null);
      }, 400); // Match CSS animation duration

      // Always update the ref to current order
      previousOrderRef.current = currentOrder;

      return () => clearTimeout(timer);
    }

    // Update ref even if no swap detected
    previousOrderRef.current = currentOrder;
  }, [currentOrder]);

  const handleTileClick = (position) => {
    // Only allow clicks for current player and during active game
    // Disable clicks during animation or if player has finished
    if (!isCurrentPlayer || isGameOver || isFinished || swappingPositions) {
      return;
    }

    if (selectedPosition === null) {
      // First click - select tile
      setSelectedPosition(position);
    } else if (selectedPosition === position) {
      // Click same tile - unselect
      setSelectedPosition(null);
    } else {
      // Second click - perform swap
      const newOrder = swapPositions(currentOrder, selectedPosition, position);
      setSelectedPosition(null);

      // Unpin both tiles that were swapped
      if (isPinningEnabled) {
        setPinnedPositions(prev => {
          const updated = new Set(prev);
          updated.delete(selectedPosition);
          updated.delete(position);
          return updated;
        });
      }

      onMove(newOrder);
    }
  };

  const handlePinToggle = (position) => {
    // Don't allow pinning if player has finished
    if (isFinished) {
      return;
    }

    setPinnedPositions(prev => {
      const updated = new Set(prev);
      if (updated.has(position)) {
        updated.delete(position);
      } else {
        updated.add(position);
      }
      return updated;
    });
  };

  const orderArray = orderToArray(currentOrder);
  const tileCount = currentOrder ? Object.keys(currentOrder).length : 4;
  const positions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].slice(0, tileCount);

  // Calculate which positions are correct (for game over display)
  const correctPositions = isGameOver && goalOrder
    ? positions.map((pos) => currentOrder[pos] === goalOrder[pos])
    : [];

  // Calculate which positions are verified (correct during gameplay)
  const verifiedPositions = isVerifiedPositionsEnabled && goalOrder && !isGameOver
    ? positions.map((pos) => currentOrder[pos] === goalOrder[pos])
    : [];

  const boardClassName = [
    'player-board',
    isCurrentPlayer && 'is-current-player',
    isWinner && 'is-winner'
  ].filter(Boolean).join(' ');

  return (
    <div className={boardClassName}>
      <div className="player-info">
        <div className="player-name">
          <PlayerName name={playerName} location={playerLocation} />
          {isCurrentPlayer && ' (You)'}
          {isWinner && ' 🏆'}
        </div>
        <div className="player-stats">
          <span>Moves: {moveCount}</span>
          <span>Correct: {positionsCorrect !== undefined ? positionsCorrect : calculatePositionsCorrect(currentOrder, goalOrder || currentOrder)} / {tileCount}</span>
        </div>
      </div>

      <div className={`tiles-container tiles-${tileCount}`}>
        {orderArray.map((tileId, index) => {
          const position = indexToPosition(index, tileCount);
          const emoji = tiles[tileId];
          const isSelected = selectedPosition === position;
          const isCorrect = isGameOver && correctPositions[index];
          const isVerified = verifiedPositions[index] || false;
          const isSwapping = swappingPositions && swappingPositions.includes(position);

          // Calculate swap offset for animation
          let swapOffset = 0;
          if (isSwapping && swappingPositions.length === 2) {
            const pos1Index = positions.indexOf(swappingPositions[0]);
            const pos2Index = positions.indexOf(swappingPositions[1]);
            const currentIndex = positions.indexOf(position);

            if (currentIndex === pos1Index) {
              // This tile needs to move to pos2
              swapOffset = pos2Index - pos1Index;
            } else if (currentIndex === pos2Index) {
              // This tile needs to move to pos1
              swapOffset = pos1Index - pos2Index;
            }
          }

          return (
            <Tile
              key={position}
              emoji={emoji}
              position={position}
              isSelected={isSelected}
              isCorrect={isCorrect}
              isDisabled={!isCurrentPlayer || isGameOver || isFinished}
              isSwapping={isSwapping}
              swapOffset={swapOffset}
              isPinned={pinnedPositions.has(position)}
              isPinningEnabled={isPinningEnabled && isCurrentPlayer && !isGameOver && !isFinished}
              isVerified={isVerified}
              isVerifiedPositionsEnabled={isVerifiedPositionsEnabled}
              onClick={handleTileClick}
              onPinToggle={handlePinToggle}
            />
          );
        })}
      </div>

      <div className="correctness-history">
        {correctnessHistory.map((value, index) => (
          <div
            key={index}
            className="correctness-dot"
            data-value={value}
            title={`Move ${index + 1}: ${value}/${tileCount} correct`}
          >
            {value}
          </div>
        ))}
      </div>
    </div>
  );
}
