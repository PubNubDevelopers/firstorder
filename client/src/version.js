/**
 * Application version and music manifest
 * Increment MUSIC_VERSION when music files change to force re-download
 * Version format: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes, major features (e.g., 2.0.0)
 * - MINOR: New features, significant changes (e.g., 1.1.0)
 * - PATCH: Bug fixes, small tweaks (e.g., 1.0.1)
 */

export const APP_VERSION = '2.0.20';
export const MUSIC_VERSION = '1.0.0';

/**
 * Music manifest - list of local music files in /music directory
 * These are served from the public directory
 * Music files must be manually placed in client/public/music/
 * See MUSIC_SOURCES.md for download instructions
 */
export const MUSIC_MANIFEST = [
  {
    id: 'track1',
    url: '/music/track1.mp3',
    filename: 'track1.mp3'
  },
  {
    id: 'track2',
    url: '/music/track2.mp3',
    filename: 'track2.mp3'
  },
  {
    id: 'track3',
    url: '/music/track3.mp3',
    filename: 'track3.mp3'
  },
  {
    id: 'track4',
    url: '/music/track4.mp3',
    filename: 'track4.mp3'
  },
  {
    id: 'track5',
    url: '/music/track5.mp3',
    filename: 'track5.mp3'
  },
  {
    id: 'track6',
    url: '/music/track6.mp3',
    filename: 'track6.mp3'
  },
  {
    id: 'track7',
    url: '/music/track7.mp3',
    filename: 'track7.mp3'
  },
  {
    id: 'track8',
    url: '/music/track8.mp3',
    filename: 'track8.mp3'
  },
  {
    id: 'track9',
    url: '/music/track9.mp3',
    filename: 'track9.mp3'
  },
  {
    id: 'track10',
    url: '/music/track10.mp3',
    filename: 'track10.mp3'
  }
];
