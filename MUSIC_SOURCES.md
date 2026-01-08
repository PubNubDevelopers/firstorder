# Background Music Setup

This document explains how to add whimsical background music to the game.

## Music File Requirements

The game needs **10 whimsical/playful music tracks** in MP3 format, placed in the `client/public/music/` directory.

### File Naming Convention

Files should be named: `track1.mp3`, `track2.mp3`, ... `track10.mp3`

## Quick Start: Automated Download (Recommended)

We provide a Node.js script that downloads 10 whimsical tracks from Kevin MacLeod (Incompetech):

```bash
# From project root directory
node scripts/download-music.js
```

**The script will:**
- ✓ Download 10 curated tracks (~56MB total)
- ✓ Create `client/public/music/` directory automatically
- ✓ Name files correctly (track1.mp3 through track10.mp3)
- ✓ Skip files that already exist

**Included tracks:**
1. Fluffing a Duck
2. Investigations
3. Quirky Dog
4. Sneaky Snitch
5. Comic Plodding
6. Thatched Villagers
7. Wallpaper
8. Monkeys Spinning Monkeys
9. Jaunty Gumption
10. Plucky Daisy

All tracks licensed under **Creative Commons: By Attribution 4.0 License**

## Recommended Free Music Sources

### 1. Incompetech (Kevin MacLeod)
- **Website**: https://incompetech.com/music/royalty-free/
- **License**: Creative Commons Attribution 4.0
- **Categories to explore**: Quirky, Comedy, Children's Music
- **Recommended tracks**:
  - "Fluffing a Duck"
  - "Investigations"
  - "Quirky Dog"
  - "Sneaky Snitch"
  - "Comic Plodding"

### 2. Pixabay Music
- **Website**: https://pixabay.com/music/
- **License**: Pixabay Content License (Free for commercial use)
- **Search terms**: "whimsical", "playful", "cartoon", "quirky"
- **No attribution required**

### 3. YouTube Audio Library
- **Website**: https://studio.youtube.com (requires Google account)
- **License**: Varies (check individual tracks)
- **Filter by**: Genre: "Children & Family" or Mood: "Happy", "Playful"

### 4. Free Music Archive (FMA)
- **Website**: https://freemusicarchive.org/
- **License**: Various Creative Commons licenses
- **Search**: "whimsical game music"

### 5. Purple Planet
- **Website**: https://www.purple-planet.com/
- **License**: Free with attribution
- **Categories**: Comedy, Quirky

## Manual Download Instructions

If you prefer to download manually (or the script doesn't work):

1. Visit one or more of the sources above
2. Download 10 whimsical/playful tracks in MP3 format
3. Rename them to `track1.mp3` through `track10.mp3`
4. Place them in `client/public/music/` directory
5. The game will automatically detect and use them

**Tip**: Create the `client/public/music/` directory first:
```bash
mkdir -p client/public/music
```

## Attribution

If using tracks that require attribution (like Incompetech), add credits to the game's about section or footer:

```
Music by Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/
```

## Technical Details

- **Format**: MP3 (recommended for browser compatibility)
- **File size**: Keep under 5MB per track for faster loading
- **Duration**: 1-3 minutes ideal (tracks will loop)
- **Volume**: Normalized to consistent levels

## Testing Without Music Files

The game will work without music files. If no files are found, the music player will silently fail and the mute button will be hidden.
