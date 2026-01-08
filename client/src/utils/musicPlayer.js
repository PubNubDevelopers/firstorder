/**
 * Background Music Player Utility
 * Manages playback of random whimsical background music
 * Music files are served from /music directory
 */

import { MUSIC_MANIFEST } from '../version';

class MusicPlayer {
  constructor() {
    this.audio = null;
    this.currentTrackId = null;
    this.isMuted = this.loadMutedState();
    this.isPlaying = false;
    this.isAvailable = false;
    this.volume = 0.3; // 30% volume for background music

    // Check if music files are available
    this.checkMusicAvailability();
  }

  /**
   * Check if music files are available by trying to load one
   */
  async checkMusicAvailability() {
    try {
      // Try to fetch the first track to see if music is available
      const firstTrack = MUSIC_MANIFEST[0];
      const response = await fetch(firstTrack.url, { method: 'HEAD' });

      if (response.ok) {
        this.isAvailable = true;
        console.log('Music files available');
      } else {
        this.isAvailable = false;
        console.log('Music files not found. See MUSIC_SOURCES.md for setup instructions.');
      }
    } catch (error) {
      this.isAvailable = false;
      console.log('Music files not available. See MUSIC_SOURCES.md for setup instructions.');
    }
  }

  /**
   * Get a random track from manifest
   */
  getRandomTrack() {
    const randomIndex = Math.floor(Math.random() * MUSIC_MANIFEST.length);
    return MUSIC_MANIFEST[randomIndex];
  }

  /**
   * Load muted state from localStorage
   */
  loadMutedState() {
    const stored = localStorage.getItem('musicMuted');
    // Default to muted if not set
    return stored === null ? true : stored === 'true';
  }

  /**
   * Save muted state to localStorage
   */
  saveMutedState() {
    localStorage.setItem('musicMuted', this.isMuted.toString());
  }

  /**
   * Start playing background music
   */
  async play() {
    if (this.isMuted || !this.isAvailable) {
      return;
    }

    try {
      // If already playing, do nothing
      if (this.audio && this.isPlaying) {
        return;
      }

      // Create new audio element if needed
      if (!this.audio) {
        const track = this.getRandomTrack();
        this.currentTrackId = track.id;
        this.audio = new Audio(track.url);
        this.audio.volume = this.volume;
        this.audio.loop = true;

        // Handle errors
        this.audio.addEventListener('error', (e) => {
          console.warn('Music file not found. See MUSIC_SOURCES.md for setup instructions.');
          this.audio = null;
          this.isPlaying = false;
          this.isAvailable = false;
        });
      }

      await this.audio.play();
      this.isPlaying = true;
    } catch (error) {
      console.warn('Could not play background music:', error);
      this.isPlaying = false;
    }
  }

  /**
   * Stop playing background music
   */
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.isPlaying = false;
    }
  }

  /**
   * Pause background music
   */
  pause() {
    if (this.audio) {
      this.audio.pause();
      this.isPlaying = false;
    }
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    this.saveMutedState();

    if (this.isMuted) {
      this.pause();
    } else {
      this.play();
    }

    return this.isMuted;
  }

  /**
   * Set mute state directly
   */
  setMuted(muted) {
    this.isMuted = muted;
    this.saveMutedState();

    if (muted) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Change to a different random track
   */
  async changeTrack() {
    const wasPlaying = this.isPlaying;
    this.stop();

    // Dispose old audio element
    if (this.audio) {
      this.audio.src = '';
      this.audio = null;
    }

    if (wasPlaying && !this.isMuted) {
      await this.play();
    }
  }

  /**
   * Clean up audio resources
   */
  dispose() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.isPlaying = false;
  }
}

// Create singleton instance
const musicPlayer = new MusicPlayer();

export default musicPlayer;
