import React, { useMemo } from 'react';
import { orderToArray } from '../utils/gameUtils';

// Winner messages (50)
const WINNER_MESSAGES = [
  "WINNER! WINNER!\nCHICKEN DINNER!",
  "Flawless victory\n(emotionally)",
  "You cracked\nthe code",
  "Science wins\nagain",
  "Absolute permutation\ndominance",
  "Logic level:\nunlocked",
  "Brain firing on\nall cylinders",
  "That was\nnot luck",
  "The emojis\nsalute you",
  "Order\nrestored",
  "You made\nchaos behave",
  "Certified\ncodebreaker",
  "Victory by\ndeduction",
  "Peak brain\nperformance",
  "That strategy\nactually worked",
  "The algorithm\napproves",
  "You solved it before\nit solved you",
  "Mind over\nemojis",
  "Precision beats\npanic",
  "You out-thought\neveryone else",
  "Clean\nexecution",
  "The puzzle\nblinked first",
  "Correct in\nall positions",
  "You brought order\nto chaos",
  "Big brain\nenergy detected",
  "The logic gods\nsmile upon you",
  "Perfectly\nplaced",
  "Zero guesses wasted\n(almost)",
  "The solution\nbows to you",
  "You earned\nthat win",
  "This is what\ncompetence looks like",
  "You swapped your way\nto glory",
  "The code didn't\nstand a chance",
  "Tactical brilliance\nconfirmed",
  "That was\ninevitable",
  "Calm, cool,\ncorrect",
  "Victory smells\nlike chicken",
  "Master of\npermutations",
  "You made it\nlook easy",
  "The puzzle\nfeared you",
  "Brains >\nbuttons",
  "Order\nachieved",
  "Supreme solver\nstatus",
  "That's how\nit's done",
  "You earned\nbragging rights",
  "The emojis\nare in awe",
  "Puzzle:\ndefeated",
  "Winner by\npure logic",
  "Checkmate\n(but with emojis)"
];

// Loser messages (50)
const LOSER_MESSAGES = [
  "NOPE!",
  "The emojis\ndisagree",
  "Close…\nbut no",
  "That strategy had potential\n(it didn't)",
  "The puzzle remains\nunconvinced",
  "Order\nnot found",
  "Try again,\ndetective",
  "The code\nlaughs quietly",
  "Logic malfunction\ndetected",
  "That\nwasn't it",
  "Not even a\nlittle bit right",
  "The permutation\nresists you",
  "Brain.exe has\nstopped responding",
  "So many swaps,\nso few answers",
  "The solution was…\nelsewhere",
  "Wrong in all\nthe right ways",
  "The puzzle remains\nundefeated",
  "Almost impressive,\nbut incorrect",
  "That guess\nwas optimistic",
  "Chaos wins\nthis round",
  "You zigged when\nyou should've zagged",
  "The emojis are\njudging you",
  "Pattern not\nrecognized",
  "The code\nstays hidden",
  "Back to\nthe drawing board",
  "That didn't\nage well",
  "The puzzle is\nstill standing",
  "Next time,\nbring a plan",
  "Logic says\n\"no\"",
  "You were\nconfidently incorrect",
  "Order not\nachieved",
  "The solution\nescaped you",
  "That wasn't\nthe move",
  "You chased the\nwrong permutation",
  "The puzzle\nshrugs",
  "Close enough\nto hurt",
  "Not your\nfinest arrangement",
  "The code remains\na mystery",
  "Incorrect, but\nenthusiastic",
  "You almost\nconvinced yourself",
  "The emojis remain\nunimpressed",
  "That strategy\nneeds a patch",
  "The puzzle\nwaits patiently",
  "Wrong answer,\nnew lesson",
  "Better luck\nnext round",
  "You learned something\n(hopefully)",
  "That wasn't\nthe order",
  "The puzzle says\n\"try harder\"",
  "The code\nstays secret",
  "Defeat by\ndeduction"
];

/**
 * GameOverModal component - displays game over message and goal order
 */
export default function GameOverModal({
  isWinner,
  winnerName,
  goalOrder,
  tiles,
  moveCount,
  onClose,
  onReturnToLobby
}) {
  const goalArray = orderToArray(goalOrder);

  // Randomly select a message when component mounts
  const message = useMemo(() => {
    const messages = isWinner ? WINNER_MESSAGES : LOSER_MESSAGES;
    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
  }, [isWinner]);

  // Split message by newline for rendering
  const messageLines = message.split('\n');

  return (
    <div className="game-over-modal" onClick={onClose}>
      <div className="game-over-content" onClick={(e) => e.stopPropagation()}>
        <div className={`game-result-badge ${isWinner ? 'won-badge' : 'lost-badge'}`}>
          {isWinner ? 'WIN' : 'LOSE'}
        </div>

        <h2 className={isWinner ? 'winner-message' : 'loser-message'}>
          {messageLines.map((line, index) => (
            <React.Fragment key={index}>
              {line}
              {index < messageLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </h2>

        <div className="goal-order-display">
          <h3>Goal Order:</h3>
          <div className="goal-tiles">
            {goalArray.map((tileId, index) => (
              <div key={index} className="goal-tile">
                {tiles[tileId]}
              </div>
            ))}
          </div>
        </div>

        {isWinner && moveCount !== undefined && (
          <div className="move-count-display">
            <p>Completed in <strong>{moveCount}</strong> {moveCount === 1 ? 'move' : 'moves'}</p>
          </div>
        )}

        {!isWinner && winnerName && (
          <div className="winner-name-display">
            <p><strong>{winnerName}</strong> won the game!</p>
          </div>
        )}

        <div className="modal-buttons">
          <button className="close-button" onClick={onClose}>Close</button>
          <button className="lobby-button" onClick={onReturnToLobby}>Return to Lobby</button>
        </div>
      </div>
    </div>
  );
}
