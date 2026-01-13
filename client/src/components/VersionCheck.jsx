import React, { useState, useEffect } from 'react';
import { APP_VERSION } from '../version';

/**
 * VersionCheck - Detects if user is running an outdated version
 * Fetches the current version from the server and compares with local version
 */
export default function VersionCheck() {
  const [showBanner, setShowBanner] = useState(false);
  const [serverVersion, setServerVersion] = useState(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        // Fetch version.json from public directory with cache-busting timestamp
        const timestamp = Date.now();
        const response = await fetch(`/version.json?t=${timestamp}`, {
          cache: 'no-store'
        });

        if (!response.ok) {
          console.warn('[VersionCheck] Failed to fetch server version');
          return;
        }

        const data = await response.json();

        if (data.appVersion) {
          const remoteVersion = data.appVersion;
          setServerVersion(remoteVersion);

          console.log(`[VersionCheck] Local: ${APP_VERSION}, Server: ${remoteVersion}`);

          // Compare versions
          if (APP_VERSION !== remoteVersion) {
            console.warn(`[VersionCheck] Version mismatch! Local: ${APP_VERSION}, Server: ${remoteVersion}`);
            setShowBanner(true);
          }
        }
      } catch (error) {
        console.error('[VersionCheck] Error checking version:', error);
      }
    };

    // Check on mount
    checkVersion();

    // Check every 30 seconds
    const interval = setInterval(checkVersion, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    // Force full page reload with cache bypass
    window.location.reload(true);
  };

  if (!showBanner) return null;

  return (
    <div className="version-check-banner">
      <div className="version-check-content">
        <strong>⚠️ New version available!</strong>
        <p>
          You're running v{APP_VERSION} but v{serverVersion} is available.
          Please refresh to avoid crashes.
        </p>
        <button onClick={handleRefresh} className="refresh-now-btn">
          Refresh Now
        </button>
      </div>
    </div>
  );
}
