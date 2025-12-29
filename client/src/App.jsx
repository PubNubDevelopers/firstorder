import React, { useState, useMemo } from 'react';
import Registration from './components/Registration';
import Lobby from './components/Lobby';
import Game from './components/Game';

/**
 * Main App component
 */
export default function App() {
  const [appState, setAppState] = useState('REGISTRATION'); // REGISTRATION, LOBBY, GAME
  const [playerInfo, setPlayerInfo] = useState(null);
  const [gameConfig, setGameConfig] = useState(null);

  // PubNub configuration - memoized to prevent infinite loops
  const pubnubConfig = useMemo(() => ({
    publishKey: import.meta.env.VITE_PUBNUB_PUBLISH_KEY || 'YOUR_PUBLISH_KEY',
    subscribeKey: import.meta.env.VITE_PUBNUB_SUBSCRIBE_KEY || 'YOUR_SUBSCRIBE_KEY',
    userId: playerInfo?.playerId || 'default'
  }), [playerInfo?.playerId]);

  const handleRegister = (info) => {
    setPlayerInfo(info);
    setAppState('LOBBY');
  };

  const handleJoinGame = (config) => {
    setGameConfig(config);
    setAppState('GAME');
  };

  const handleLeaveGame = () => {
    setGameConfig(null);
    setAppState('LOBBY');
  };

  const handleLeaveLobby = () => {
    setPlayerInfo(null);
    setAppState('REGISTRATION');
  };

  return (
    <div className="app">

      {appState === 'REGISTRATION' && (
        <Registration onRegister={handleRegister} />
      )}

      {appState === 'LOBBY' && playerInfo && (
        <Lobby
          playerInfo={playerInfo}
          pubnubConfig={pubnubConfig}
          onJoinGame={handleJoinGame}
          onLeave={handleLeaveLobby}
        />
      )}

      {appState === 'GAME' && gameConfig && (
        <Game
          gameConfig={gameConfig}
          pubnubConfig={pubnubConfig}
          onLeave={handleLeaveGame}
        />
      )}

      {/* PubNub Credits */}
      <div className="pubnub-credits">
        Built with <a href="https://pubnub.com" target="_blank" rel="noopener noreferrer">pubnub.com</a>
      </div>
    </div>
  );
}
