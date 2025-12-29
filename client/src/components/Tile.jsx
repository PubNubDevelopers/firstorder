import React from 'react';

/**
 * Tile component - represents a single game tile with emoji
 */
export default function Tile({
  emoji,
  position,
  isSelected,
  isCorrect,
  isDisabled,
  isSwapping,
  swapOffset,
  isPinned,
  isPinningEnabled,
  isVerified,
  isVerifiedPositionsEnabled,
  onClick,
  onPinToggle
}) {
  const handleClick = () => {
    if (!isDisabled) {
      onClick(position);
    }
  };

  const handlePinClick = (e) => {
    e.stopPropagation();
    if (!isDisabled && onPinToggle) {
      onPinToggle(position);
    }
  };

  const classNames = [
    'tile',
    isSelected && 'selected',
    isCorrect && 'correct',
    isDisabled && 'disabled',
    isSwapping && 'swapping',
    isPinned && 'pinned',
    isVerified && 'verified'
  ].filter(Boolean).join(' ');

  // Calculate inline style for swap animation
  const style = isSwapping && swapOffset !== 0 ? {
    '--swap-offset': swapOffset
  } : undefined;

  return (
    <div className="tile-wrapper">
      {isPinningEnabled && (
        <div
          className={`pin-icon ${isPinned ? 'pinned' : ''}`}
          onClick={handlePinClick}
          title={isPinned ? 'Unpin tile' : 'Pin tile'}
        >
          📌
        </div>
      )}
      <div
        className={classNames}
        onClick={handleClick}
        data-position={position}
        style={style}
      >
        {emoji}
        {isVerified && isVerifiedPositionsEnabled && (
          <div className="verified-checkmark">✓</div>
        )}
      </div>
    </div>
  );
}
