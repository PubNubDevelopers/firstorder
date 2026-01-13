import React, { useState, useMemo } from 'react';
import Registration from './components/Registration';
import LobbyV2 from './components/LobbyV2';
import Game from './components/Game';
import GamesHistory from './components/GamesHistory';
import VersionCheck from './components/VersionCheck';
import TournamentSetup from './components/TournamentSetup';
import { APP_VERSION } from './version';

/**
 * Main App component
 */
export default function App() {
  const [appState, setAppState] = useState('REGISTRATION'); // REGISTRATION, LOBBY, GAME, HISTORY, TOURNAMENT_SETUP
  const [playerInfo, setPlayerInfo] = useState(null);
  const [gameConfig, setGameConfig] = useState(null);
  const [tournamentConfig, setTournamentConfig] = useState(null); // { tournamentId, isHost }

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

  const handleViewHistory = () => {
    setAppState('HISTORY');
  };

  const handleBackToLobby = () => {
    setAppState('LOBBY');
  };

  const handleCreateTournament = async (tournamentId, isHost = true) => {
    setTournamentConfig({ tournamentId, isHost });
    setAppState('TOURNAMENT_SETUP');
  };

  const handleLeaveTournament = () => {
    setTournamentConfig(null);
    setAppState('LOBBY');
  };

  return (
    <div className="app">
      {/* Version Check Banner */}
      <VersionCheck />

      {appState === 'REGISTRATION' && (
        <Registration onRegister={handleRegister} />
      )}

      {appState === 'LOBBY' && playerInfo && (
        <LobbyV2
          playerInfo={playerInfo}
          pubnubConfig={pubnubConfig}
          onJoinGame={handleJoinGame}
          onCreateTournament={handleCreateTournament}
          onLeave={handleLeaveLobby}
          onViewHistory={handleViewHistory}
        />
      )}

      {appState === 'HISTORY' && playerInfo && (
        <GamesHistory
          pubnubConfig={pubnubConfig}
          onBack={handleBackToLobby}
        />
      )}

      {appState === 'GAME' && gameConfig && (
        <Game
          gameConfig={gameConfig}
          pubnubConfig={pubnubConfig}
          onLeave={handleLeaveGame}
        />
      )}

      {appState === 'TOURNAMENT_SETUP' && tournamentConfig && (
        <TournamentSetup
          tournamentConfig={tournamentConfig}
          playerInfo={playerInfo}
          pubnubConfig={pubnubConfig}
          onLeave={handleLeaveTournament}
        />
      )}

      {/* Version Badge */}
      <div className="version-badge">
        v{APP_VERSION}
      </div>

      {/* PubNub Credits */}
      <div className="pubnub-credits">
        Built with <a href="https://pubnub.com" target="_blank" rel="noopener noreferrer">pubnub.com</a>
      </div>
    </div>
  );
}
