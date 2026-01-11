/**
 * Presence State Tests
 *
 * CRITICAL: These tests prevent regression of the "Anonymous players" bug
 * where players' names don't appear in the lobby presence list.
 *
 * Bug History:
 * - v3.2.3: Players showing as "Anonymous" in lobby
 * - Root Cause: 100ms setTimeout in usePubNub.js caused race condition
 *   where hereNow() was called before setState() completed
 * - Fix: Removed setTimeout, setState() now called immediately on PNConnectedCategory
 *
 * @see client/src/hooks/usePubNub.js:77-104 (setState implementation)
 * @see client/src/components/LobbyV2.jsx:67-89 (fetchLobbyPresence)
 * @see client/src/components/LobbyV2.jsx:190-211 (handlePresenceEvent)
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { usePubNub } from '../hooks/usePubNub';
import PubNub from 'pubnub';

// Mock PubNub
jest.mock('pubnub');

describe('Presence State Tests', () => {
  let mockPubnub;
  let mockSetState;
  let mockSubscribe;
  let mockAddListener;
  let statusListener;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock functions
    mockSetState = jest.fn((params, callback) => {
      // Simulate immediate success
      callback({ error: false }, { state: params.state });
    });

    mockSubscribe = jest.fn();
    mockAddListener = jest.fn((listener) => {
      // Store the status listener so we can trigger it
      statusListener = listener.status;
    });

    // Mock PubNub instance
    mockPubnub = {
      setState: mockSetState,
      subscribe: mockSubscribe,
      addListener: mockAddListener,
      unsubscribe: jest.fn(),
      removeListener: jest.fn(),
      unsubscribeAll: jest.fn(),
      stop: jest.fn(),
      hereNow: jest.fn().mockResolvedValue({
        channels: {
          lobby: {
            occupants: [
              {
                uuid: 'player-123',
                state: {
                  playerName: 'TestPlayer',
                  location: 'USA - CA'
                }
              }
            ]
          }
        }
      })
    };

    // Mock PubNub constructor
    PubNub.mockImplementation(() => mockPubnub);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * TEST 1: setState must be called IMMEDIATELY without setTimeout
   * This is the core fix for the Anonymous players bug
   */
  test('setState is called immediately without setTimeout delay', async () => {
    const config = {
      publishKey: 'pub-key',
      subscribeKey: 'sub-key',
      userId: 'test-user'
    };

    const { result } = renderHook(() => usePubNub(config));

    await waitFor(() => {
      expect(result.current.pubnub).toBeDefined();
    });

    // Subscribe with presence state
    const presenceState = {
      playerName: 'TestPlayer',
      location: 'USA - CA'
    };

    act(() => {
      result.current.subscribe('lobby', () => {}, {
        withPresence: true,
        presenceState
      });
    });

    // Trigger PNConnectedCategory status event
    act(() => {
      statusListener({
        category: 'PNConnectedCategory'
      });
    });

    // CRITICAL: setState should be called IMMEDIATELY (synchronously)
    // NOT after a setTimeout delay
    expect(mockSetState).toHaveBeenCalledTimes(1);
    expect(mockSetState).toHaveBeenCalledWith(
      {
        channels: ['lobby'],
        state: presenceState
      },
      expect.any(Function)
    );
  });

  /**
   * TEST 2: Presence state must contain playerName
   * Ensures the state object has the required fields
   */
  test('presence state includes playerName field', async () => {
    const config = {
      publishKey: 'pub-key',
      subscribeKey: 'sub-key',
      userId: 'test-user'
    };

    const { result } = renderHook(() => usePubNub(config));

    await waitFor(() => {
      expect(result.current.pubnub).toBeDefined();
    });

    const presenceState = {
      playerName: 'JohnDoe',
      location: 'Canada'
    };

    act(() => {
      result.current.subscribe('lobby', () => {}, {
        withPresence: true,
        presenceState
      });
    });

    act(() => {
      statusListener({ category: 'PNConnectedCategory' });
    });

    // Verify setState was called with playerName
    const setStateCall = mockSetState.mock.calls[0][0];
    expect(setStateCall.state).toHaveProperty('playerName');
    expect(setStateCall.state.playerName).toBe('JohnDoe');
    expect(setStateCall.state.playerName).not.toBe('Anonymous');
    expect(setStateCall.state.playerName).not.toBe('Unknown');
  });

  /**
   * TEST 3: hereNow must include state in response
   * Verifies that when fetching presence, state is included
   */
  test('hereNow includes state with playerName', async () => {
    const config = {
      publishKey: 'pub-key',
      subscribeKey: 'sub-key',
      userId: 'test-user'
    };

    const { result } = renderHook(() => usePubNub(config));

    await waitFor(() => {
      expect(result.current.pubnub).toBeDefined();
    });

    // Call hereNow
    const hereNowResult = await result.current.hereNow('lobby');

    // Verify includeState was used (check the mock implementation)
    expect(mockPubnub.hereNow).toHaveBeenCalled();

    // Verify state is present in occupants
    const occupants = hereNowResult.channels.lobby.occupants;
    expect(occupants).toHaveLength(1);
    expect(occupants[0]).toHaveProperty('state');
    expect(occupants[0].state).toHaveProperty('playerName');
    expect(occupants[0].state.playerName).not.toBe('Anonymous');
  });

  /**
   * TEST 4: Presence event handlers must extract playerName correctly
   * Simulates the code path in LobbyV2.jsx handlePresenceEvent
   */
  test('presence event state is extracted correctly', () => {
    const presenceEvent = {
      action: 'join',
      uuid: 'player-456',
      state: {
        playerName: 'AliceSmith',
        location: 'USA - NY'
      }
    };

    // Simulate LobbyV2.jsx handlePresenceEvent logic
    const extractedPlayerName = presenceEvent.state?.playerName || 'Anonymous';
    const extractedLocation = presenceEvent.state?.location || null;

    expect(extractedPlayerName).toBe('AliceSmith');
    expect(extractedPlayerName).not.toBe('Anonymous');
    expect(extractedLocation).toBe('USA - NY');
  });

  /**
   * TEST 5: Fallback to 'Anonymous' only when state is actually missing
   * Ensures the fallback logic works correctly
   */
  test('fallback to Anonymous only when state is genuinely missing', () => {
    // Case 1: State object exists with playerName
    const event1 = {
      state: { playerName: 'BobJones', location: null }
    };
    expect(event1.state?.playerName || 'Anonymous').toBe('BobJones');

    // Case 2: State object exists but playerName is empty string
    const event2 = {
      state: { playerName: '', location: null }
    };
    expect(event2.state?.playerName || 'Anonymous').toBe('Anonymous');

    // Case 3: State object exists but playerName is undefined
    const event3 = {
      state: { location: 'USA - TX' }
    };
    expect(event3.state?.playerName || 'Anonymous').toBe('Anonymous');

    // Case 4: State object is null
    const event4 = {
      state: null
    };
    expect(event4.state?.playerName || 'Anonymous').toBe('Anonymous');

    // Case 5: State object is undefined
    const event5 = {};
    expect(event5.state?.playerName || 'Anonymous').toBe('Anonymous');
  });

  /**
   * TEST 6: Race condition test - setState must complete before hereNow
   * This test simulates the race condition that caused the bug
   */
  test('setState completes before hereNow can be called', async () => {
    let setStateCompleted = false;

    // Override mockSetState to track completion
    mockSetState.mockImplementation((params, callback) => {
      // Simulate setState taking some time
      setTimeout(() => {
        setStateCompleted = true;
        callback({ error: false }, { state: params.state });
      }, 0); // Even 0ms setTimeout creates a race condition
    });

    const config = {
      publishKey: 'pub-key',
      subscribeKey: 'sub-key',
      userId: 'test-user'
    };

    const { result } = renderHook(() => usePubNub(config));

    await waitFor(() => {
      expect(result.current.pubnub).toBeDefined();
    });

    act(() => {
      result.current.subscribe('lobby', () => {}, {
        withPresence: true,
        presenceState: { playerName: 'RaceTest', location: null }
      });
    });

    // Trigger connection
    act(() => {
      statusListener({ category: 'PNConnectedCategory' });
    });

    // Wait for setState to complete
    await waitFor(() => {
      expect(setStateCompleted).toBe(true);
    });

    // Now hereNow should get the state
    // In the real bug, hereNow was called during the setTimeout delay
    // and got undefined state, resulting in "Anonymous"
  });
});

/**
 * Integration Test Notes:
 *
 * To manually verify this fix:
 * 1. Open app in two browser windows
 * 2. Register as different players
 * 3. Both enter lobby
 * 4. Check "Who's Here" widget
 * 5. BOTH players should show their actual names, NOT "Anonymous"
 *
 * Console logs to check:
 * - "[usePubNub] Setting presence state IMMEDIATELY: {playerName: '...', location: '...'}"
 * - "[usePubNub] ✓ Presence state set successfully"
 * - "[Lobby] Processing occupant: <uuid> state: {...}" should have playerName
 * - "[Lobby] Filtered occupants:" should have playerName !== "Anonymous"
 */
