/**
 * Game utility functions
 */

/**
 * Generate a random 8-character alphanumeric game ID
 */
export function generateGameId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a random player ID
 */
export function generatePlayerId() {
  return `player_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate position letters for variable tile counts
 */
export function generatePositions(tileCount) {
  const positions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  return positions.slice(0, tileCount);
}

/**
 * Validate order is a valid permutation
 */
export function isValidOrder(order, tileCount = 4) {
  if (!order || typeof order !== 'object') return false;

  const positions = generatePositions(tileCount);
  const values = [];

  for (let pos of positions) {
    if (!(pos in order)) return false;
    const val = order[pos];
    if (typeof val !== 'number' || val < 0 || val >= tileCount) return false;
    if (values.includes(val)) return false;
    values.push(val);
  }

  return values.length === tileCount;
}

/**
 * Calculate positions correct
 */
export function calculatePositionsCorrect(order, goalOrder) {
  if (!order || !goalOrder) return 0;

  let correct = 0;
  const tileCount = Object.keys(goalOrder).length;
  const positions = generatePositions(tileCount);

  for (let pos of positions) {
    if (order[pos] === goalOrder[pos]) {
      correct++;
    }
  }

  return correct;
}

/**
 * Swap two positions in an order
 */
export function swapPositions(order, pos1, pos2) {
  const newOrder = { ...order };
  const temp = newOrder[pos1];
  newOrder[pos1] = newOrder[pos2];
  newOrder[pos2] = temp;
  return newOrder;
}

/**
 * Convert order object to array for display
 */
export function orderToArray(order) {
  if (!order) return [];

  const tileCount = Object.keys(order).length;
  const positions = generatePositions(tileCount);
  return positions.map(pos => order[pos]);
}

/**
 * Convert array to order object
 */
export function arrayToOrder(arr) {
  const order = {};
  const positions = generatePositions(arr.length);

  arr.forEach((val, index) => {
    order[positions[index]] = val;
  });

  return order;
}

/**
 * Get position letter from index
 */
export function indexToPosition(index, tileCount = 4) {
  const positions = generatePositions(tileCount);
  return positions[index];
}

/**
 * Get index from position letter
 */
export function positionToIndex(position, tileCount = 4) {
  const positions = generatePositions(tileCount);
  return positions.indexOf(position);
}
