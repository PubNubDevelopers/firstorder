import React, { useMemo } from 'react';
import { orderToArray } from '../utils/gameUtils';
import PlayerName from './PlayerName';

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

// 2nd/3rd Place messages (30)
const PLACEMENT_MESSAGES = [
  "Not bad!\nNot bad at all",
  "Solid\nperformance",
  "Made the\npodium",
  "Top tier\nplayer",
  "Earned your\nspot",
  "Respect the\nhustle",
  "Strong\nfinish",
  "Well\nplayed",
  "Came through\nin the clutch",
  "That's\nimpressive",
  "Almost\nhad it",
  "Close to\nthe top",
  "Respectable\nresult",
  "Strong\nshowing",
  "Held your\nown",
  "Proved your\nworth",
  "Made it\ncount",
  "In the\nmix",
  "Stayed\ncompetitive",
  "Put in\nwork",
  "Earned\nrecognition",
  "Fought\nhard",
  "Stayed in\ncontention",
  "Made your\nmark",
  "Hung\ntough",
  "Credible\neffort",
  "Not\ntoo shabby",
  "Honorable\nmention",
  "In the\nrunning",
  "On the\nboard"
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
  placements,
  playerId,
  onClose,
  onReturnToLobby
}) {
  const goalArray = orderToArray(goalOrder);

  // Calculate player's placement
  const myPlacement = placements?.find(p => p.playerId === playerId);
  const placement = myPlacement?.placement;

  // Randomly select a message when component mounts
  const message = useMemo(() => {
    let messageArray;
    if (placement === 1) {
      messageArray = WINNER_MESSAGES;
    } else if (placement === 2 || placement === 3) {
      messageArray = PLACEMENT_MESSAGES;
    } else {
      messageArray = LOSER_MESSAGES;
    }
    const randomIndex = Math.floor(Math.random() * messageArray.length);
    return messageArray[randomIndex];
  }, [placement]);

  // Split message by newline for rendering
  const messageLines = message.split('\n');

  return (
    <div className="game-over-modal" onClick={onClose}>
      <div className="game-over-content" onClick={(e) => e.stopPropagation()}>
        <div className={`game-result-badge ${
          placement === 1 ? 'gold-badge' :
          placement === 2 ? 'silver-badge' :
          placement === 3 ? 'bronze-badge' :
          'did-not-finish-badge'
        }`}>
          {placement === 1 && '🥇 1ST'}
          {placement === 2 && '🥈 2ND'}
          {placement === 3 && '🥉 3RD'}
          {!placement && 'DNF'}
        </div>

        <h2 className={placement === 1 ? 'winner-message' : 'loser-message'}>
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

        {placement && moveCount !== undefined && (
          <div className="move-count-display">
            <p>Completed in <strong>{moveCount}</strong> {moveCount === 1 ? 'move' : 'moves'}</p>
          </div>
        )}

        {placements && placements.length > 0 && (
          <div className="leaderboard-display">
            <h3>Final Results</h3>
            <div className="leaderboard-list">
              {placements.map((p) => (
                <div key={p.playerId} className={`leaderboard-item ${p.playerId === playerId ? 'you' : ''}`}>
                  <span className="leaderboard-medal">
                    {p.placement === 1 && '🥇'}
                    {p.placement === 2 && '🥈'}
                    {p.placement === 3 && '🥉'}
                  </span>
                  <span className="leaderboard-name">
                    <PlayerName name={p.playerName} location={p.playerLocation} />
                    {p.playerId === playerId && ' (You)'}
                  </span>
                  <span className="leaderboard-place">
                    {p.placement === 1 && '1st'}
                    {p.placement === 2 && '2nd'}
                    {p.placement === 3 && '3rd'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!placement && winnerName && (
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
