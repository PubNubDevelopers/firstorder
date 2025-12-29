import { useState, useEffect, useRef, useCallback } from 'react';
import PubNub from 'pubnub';

/**
 * Custom hook for managing PubNub connection and subscriptions
 */
export function usePubNub(config) {
  const [pubnub, setPubnub] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const listenersRef = useRef({});

  useEffect(() => {
    console.log('usePubNub useEffect - config:', config);

    if (!config?.publishKey || !config?.subscribeKey) {
      console.error('PubNub keys are missing:', { publishKey: config?.publishKey, subscribeKey: config?.subscribeKey });
      setError('PubNub keys are required');
      return;
    }

    try {
      console.log('Initializing PubNub with userId:', config.userId);
      const pn = new PubNub({
        publishKey: config.publishKey,
        subscribeKey: config.subscribeKey,
        uuid: config.userId,
        autoNetworkDetection: true,
        restore: true,
        heartbeatInterval: 280,  // Send presence heartbeat every 280 seconds
        presenceTimeout: 300     // Mark as offline after 300 seconds (5 minutes)
      });

      console.log('PubNub initialized successfully');
      setPubnub(pn);
      setIsConnected(true);
      setError(null);

      return () => {
        console.log('Cleaning up PubNub connection');
        if (pn) {
          pn.unsubscribeAll();
          pn.stop();
        }
      };
    } catch (err) {
      console.error('Error initializing PubNub:', err);
      setError(err.message);
    }
  }, [config?.publishKey, config?.subscribeKey, config?.userId]);

  const subscribe = useCallback((channels, callback, options = {}) => {
    console.log('subscribe() called with:', { channels, options, pubnubExists: !!pubnub });

    if (!pubnub) {
      console.error('PubNub not initialized');
      return;
    }

    const { withPresence = false, presenceState = null } = options;
    console.log('Setting up subscription with withPresence:', withPresence, 'presenceState:', presenceState);

    const listener = {
      message: (messageEvent) => {
        console.log('MESSAGE event received in listener:', messageEvent);
        callback(messageEvent);
      },
      presence: (presenceEvent) => {
        console.log('PRESENCE event received in listener:', presenceEvent);
        if (withPresence) {
          console.log('Calling callback with presence event');
          callback(presenceEvent);
        } else {
          console.log('Ignoring presence event (withPresence=false)');
        }
      },
      status: (statusEvent) => {
        console.log('STATUS event received:', statusEvent.category);
        if (statusEvent.category === 'PNConnectedCategory') {
          console.log('Connected to PubNub');
          setIsConnected(true);

          // Set presence state after a brief delay to ensure subscription is ready
          if (presenceState) {
            setTimeout(() => {
              const channelArray = Array.isArray(channels) ? channels : [channels];
              console.log('Setting presence state:', presenceState, 'for channels:', channelArray);
              pubnub.setState({
                channels: channelArray,
                state: presenceState
              }, (status, response) => {
                if (status.error) {
                  console.error('Error setting presence state:', status);
                } else {
                  console.log('Presence state set successfully:', response);
                }
              });
            }, 100);
          }
        } else if (statusEvent.category === 'PNNetworkDownCategory') {
          console.log('Network disconnected');
          setIsConnected(false);
        }
      }
    };

    console.log('Adding listener to PubNub');
    pubnub.addListener(listener);

    const channelArray = Array.isArray(channels) ? channels : [channels];
    console.log('Subscribing to channels:', channelArray, 'withPresence:', withPresence);
    pubnub.subscribe({
      channels: channelArray,
      withPresence: withPresence
    });

    listenersRef.current[channels] = listener;
    console.log('Subscription setup complete');

    return () => {
      console.log('Unsubscribing from channels:', channelArray);
      pubnub.removeListener(listener);
      pubnub.unsubscribe({
        channels: channelArray
      });
      delete listenersRef.current[channels];
    };
  }, [pubnub]);

  const publish = useCallback(async (channel, message) => {
    if (!pubnub) {
      throw new Error('PubNub not initialized');
    }

    try {
      const result = await pubnub.publish({
        channel,
        message
      });
      return result;
    } catch (err) {
      console.error('Error publishing message:', err);
      throw err;
    }
  }, [pubnub]);

  const unsubscribe = useCallback((channels) => {
    if (!pubnub) return;

    pubnub.unsubscribe({
      channels: Array.isArray(channels) ? channels : [channels]
    });

    const channelKey = Array.isArray(channels) ? channels.join(',') : channels;
    if (listenersRef.current[channelKey]) {
      pubnub.removeListener(listenersRef.current[channelKey]);
      delete listenersRef.current[channelKey];
    }
  }, [pubnub]);

  const hereNow = useCallback(async (channels) => {
    if (!pubnub) {
      throw new Error('PubNub not initialized');
    }

    try {
      const result = await pubnub.hereNow({
        channels: Array.isArray(channels) ? channels : [channels],
        includeUUIDs: true,
        includeState: true  // Include state to get player names
      });
      return result;
    } catch (err) {
      console.error('Error fetching presence:', err);
      throw err;
    }
  }, [pubnub]);

  return {
    pubnub,
    isConnected,
    error,
    subscribe,
    publish,
    unsubscribe,
    hereNow
  };
}
