# Scripts

Utility scripts for the First Order game.

## Available Scripts

### download-music.js

Automates downloading of background music files for the game.

**Usage:**
```bash
node scripts/download-music.js
```

**What it does:**
- Creates `client/public/music/` directory if it doesn't exist
- Downloads 10 whimsical music tracks from configured URLs
- Names them track1.mp3 through track10.mp3
- Skips files that already exist

**Configuration:**
Edit the `MUSIC_TRACKS` array in the script (lines 18-73) to specify URLs for tracks from royalty-free sources like:
- [Pixabay Music](https://pixabay.com/music/) - No attribution required
- [Free Music Archive](https://freemusicarchive.org/) - Various CC licenses
- [Incompetech](https://incompetech.com/music/royalty-free/) - CC BY 4.0

**Example track entry:**
```javascript
{
  id: 'track1',
  name: 'Whimsical Adventures',
  url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_abc123.mp3',
  filename: 'track1.mp3'
}
```

**Note**: The script includes placeholder URLs. You must replace these with actual URLs from the sources above before running.

See [MUSIC_SOURCES.md](../MUSIC_SOURCES.md) for more details on music licensing and sources.
