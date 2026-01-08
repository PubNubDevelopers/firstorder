/**
 * Sound effects utility using Web Audio API
 */

let audioContext = null;

// Initialize audio context on first use
function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Play a tile swap sound effect - swoosh with a pop at the end
 * @param {number} duration - Duration in seconds (default 0.4s to match animation)
 */
export function playTileSwapSound(duration = 0.4) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Create oscillator for the swoosh (frequency sweep)
    const swooshOsc = ctx.createOscillator();
    const swooshGain = ctx.createGain();

    // Start with a higher frequency and sweep down
    swooshOsc.frequency.setValueAtTime(800, now);
    swooshOsc.frequency.exponentialRampToValueAtTime(200, now + duration * 0.7);

    // Envelope for swoosh (fade in and out)
    swooshGain.gain.setValueAtTime(0, now);
    swooshGain.gain.linearRampToValueAtTime(0.15, now + duration * 0.2);
    swooshGain.gain.linearRampToValueAtTime(0.08, now + duration * 0.6);
    swooshGain.gain.linearRampToValueAtTime(0, now + duration * 0.8);

    swooshOsc.type = 'sine';
    swooshOsc.connect(swooshGain);
    swooshGain.connect(ctx.destination);

    swooshOsc.start(now);
    swooshOsc.stop(now + duration * 0.8);

    // Create pop sound at the end
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();

    // Pop is a quick frequency spike
    popOsc.frequency.setValueAtTime(400, now + duration * 0.85);
    popOsc.frequency.exponentialRampToValueAtTime(100, now + duration);

    // Short, punchy envelope
    popGain.gain.setValueAtTime(0, now + duration * 0.85);
    popGain.gain.linearRampToValueAtTime(0.2, now + duration * 0.88);
    popGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    popOsc.type = 'sine';
    popOsc.connect(popGain);
    popGain.connect(ctx.destination);

    popOsc.start(now + duration * 0.85);
    popOsc.stop(now + duration);
  } catch (error) {
    console.warn('Error playing tile swap sound:', error);
  }
}

/**
 * Play winner celebration sound - triumphant ascending arpeggio
 */
export function playWinnerSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Major chord arpeggio: C4, E4, G4, C5
    const frequencies = [261.63, 329.63, 392.00, 523.25];
    const duration = 0.15;

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.setValueAtTime(freq, now + i * duration);
      osc.type = 'triangle';

      gain.gain.setValueAtTime(0, now + i * duration);
      gain.gain.linearRampToValueAtTime(0.2, now + i * duration + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * duration + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * duration);
      osc.stop(now + i * duration + duration);
    });

    // Add sparkle effect
    setTimeout(() => {
      const sparkleOsc = ctx.createOscillator();
      const sparkleGain = ctx.createGain();

      sparkleOsc.frequency.setValueAtTime(1047, ctx.currentTime);
      sparkleOsc.type = 'sine';

      sparkleGain.gain.setValueAtTime(0.15, ctx.currentTime);
      sparkleGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      sparkleOsc.connect(sparkleGain);
      sparkleGain.connect(ctx.destination);

      sparkleOsc.start(ctx.currentTime);
      sparkleOsc.stop(ctx.currentTime + 0.5);
    }, 600);
  } catch (error) {
    console.warn('Error playing winner sound:', error);
  }
}

/**
 * Play loser sound - descending sad trombone effect
 */
export function playLoserSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Descending frequency sweep
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.8);
    osc.type = 'sawtooth';

    // Envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.8);
  } catch (error) {
    console.warn('Error playing loser sound:', error);
  }
}

/**
 * Play placement sound - for 2nd/3rd place finishes
 * A positive but not as triumphant sound as the winner
 */
export function playPlacementSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Two-tone ascending pattern
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    // First tone
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.setValueAtTime(550, now + 0.15);
    osc1.type = 'sine';

    // Second harmony tone
    osc2.frequency.setValueAtTime(550, now);
    osc2.frequency.setValueAtTime(660, now + 0.15);
    osc2.type = 'sine';

    // Envelope - slightly softer than winner
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.4);
    osc2.start(now);
    osc2.stop(now + 0.4);
  } catch (error) {
    console.warn('Error playing placement sound:', error);
  }
}

/**
 * Play countdown beep - single high beep
 */
export function playCountdownBeep() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(800, now);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  } catch (error) {
    console.warn('Error playing countdown beep:', error);
  }
}

/**
 * Play game start sound - energetic "GO!" sound
 */
export function playGameStartSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Power chord effect
    const frequencies = [196, 392, 588]; // G3, G4, D5

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.setValueAtTime(freq, now);
      osc.type = 'square';

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    });
  } catch (error) {
    console.warn('Error playing game start sound:', error);
  }
}

/**
 * Play player joined sound - friendly notification chime
 */
export function playPlayerJoinedSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Two-tone chime: E5 -> A5
    const frequencies = [659.25, 880.00];

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      osc.type = 'sine';

      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.2);
    });
  } catch (error) {
    console.warn('Error playing player joined sound:', error);
  }
}

/**
 * Play you joined game sound - welcoming entrance sound
 */
export function playYouJoinedSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Ascending melody: C5 -> E5 -> G5
    const frequencies = [523.25, 659.25, 783.99];

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      osc.type = 'triangle';

      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.25);
    });
  } catch (error) {
    console.warn('Error playing you joined sound:', error);
  }
}

/**
 * Resume audio context (needed for user interaction requirement)
 */
export function resumeAudioContext() {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
}
