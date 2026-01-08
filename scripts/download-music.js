#!/usr/bin/env node

/**
 * Music Download Script
 * Downloads royalty-free whimsical music tracks for the game
 *
 * Usage:
 *   node scripts/download-music.js
 *
 * This script downloads 10 tracks from Kevin MacLeod (Incompetech)
 * Licensed under Creative Commons: By Attribution 4.0 License
 * http://creativecommons.org/licenses/by/4.0/
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Kevin MacLeod (Incompetech) tracks - CC BY 4.0
// Direct download links from incompetech.com
const MUSIC_TRACKS = [
  {
    id: 'track1',
    name: 'Fluffing a Duck',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fluffing%20a%20Duck.mp3',
    filename: 'track1.mp3'
  },
  {
    id: 'track2',
    name: 'Investigations',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Investigations.mp3',
    filename: 'track2.mp3'
  },
  {
    id: 'track3',
    name: 'Quirky Dog',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Quirky%20Dog.mp3',
    filename: 'track3.mp3'
  },
  {
    id: 'track4',
    name: 'Sneaky Snitch',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Snitch.mp3',
    filename: 'track4.mp3'
  },
  {
    id: 'track5',
    name: 'Comic Plodding',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Comic%20Plodding.mp3',
    filename: 'track5.mp3'
  },
  {
    id: 'track6',
    name: 'Thatched Villagers',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Thatched%20Villagers.mp3',
    filename: 'track6.mp3'
  },
  {
    id: 'track7',
    name: 'Wallpaper',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Wallpaper.mp3',
    filename: 'track7.mp3'
  },
  {
    id: 'track8',
    name: 'Monkeys Spinning Monkeys',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Monkeys%20Spinning%20Monkeys.mp3',
    filename: 'track8.mp3'
  },
  {
    id: 'track9',
    name: 'Jaunty Gumption',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Jaunty%20Gumption.mp3',
    filename: 'track9.mp3'
  },
  {
    id: 'track10',
    name: 'Plucky Daisy',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Plucky%20Daisy.mp3',
    filename: 'track10.mp3'
  }
];

const OUTPUT_DIR = path.join(__dirname, '../client/public/music');

/**
 * Ensure the music directory exists
 */
function ensureMusicDirectory() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✓ Created directory: ${OUTPUT_DIR}`);
  }
}

/**
 * Download a single track
 */
function downloadTrack(track) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(OUTPUT_DIR, track.filename);

    // Skip if already exists
    if (fs.existsSync(outputPath)) {
      console.log(`⊘ Skipped ${track.filename} (already exists)`);
      resolve();
      return;
    }

    console.log(`⬇ Downloading ${track.name}...`);

    const file = fs.createWriteStream(outputPath);

    https.get(track.url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (redirectResponse) => {
          if (redirectResponse.statusCode !== 200) {
            reject(new Error(`Failed to download ${track.name}: HTTP ${redirectResponse.statusCode}`));
            return;
          }

          redirectResponse.pipe(file);

          file.on('finish', () => {
            file.close();
            console.log(`✓ Downloaded ${track.filename}`);
            resolve();
          });
        }).on('error', (err) => {
          fs.unlink(outputPath, () => {});
          reject(new Error(`Failed to download ${track.name}: ${err.message}`));
        });
        return;
      }

      if (response.statusCode !== 200) {
        fs.unlink(outputPath, () => {});
        reject(new Error(`Failed to download ${track.name}: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded ${track.filename}`);
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(new Error(`Failed to write ${track.name}: ${err.message}`));
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(new Error(`Failed to download ${track.name}: ${err.message}`));
    });
  });
}

/**
 * Download all tracks sequentially
 */
async function downloadAllTracks() {
  console.log('\n🎵 First Order Music Downloader\n');
  console.log('Downloading 10 tracks from Kevin MacLeod (Incompetech)');
  console.log('Licensed under Creative Commons: By Attribution 4.0 License');
  console.log('http://creativecommons.org/licenses/by/4.0/\n');

  ensureMusicDirectory();

  let successCount = 0;
  let failCount = 0;

  for (const track of MUSIC_TRACKS) {
    try {
      await downloadTrack(track);
      successCount++;
    } catch (error) {
      console.error(`✗ ${error.message}`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✓ Successfully downloaded: ${successCount}/${MUSIC_TRACKS.length} tracks`);
  if (failCount > 0) {
    console.log(`✗ Failed: ${failCount} tracks`);
  }
  console.log('\nNote: Attribution required for these tracks.');
  console.log('Add to your game: "Music by Kevin MacLeod (incompetech.com)"');
  console.log('Licensed under Creative Commons: By Attribution 4.0 License');
  console.log('='.repeat(50) + '\n');

  process.exit(failCount > 0 ? 1 : 0);
}

// Run the downloader
downloadAllTracks().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
