/**
 * Safe Audio Controller for MindCare
 * Gracefully provides audio playback using expo-audio with a zero-crash fallback
 * for Expo Go environments lacking native ExponentAV/ExpoAudio bindings.
 */

let ExpoAudio = null;
let hasCheckedAudio = false;

function getAudioModule() {
  if (hasCheckedAudio) {
    return ExpoAudio;
  }
  hasCheckedAudio = true;
  try {
    const mod = require('expo-audio');
    if (mod && typeof mod.createAudioPlayer === 'function') {
      ExpoAudio = mod;
      return ExpoAudio;
    }
  } catch (err) {
    console.warn('[SafeAudio] Native audio module unavailable. Running in visual timer mode:', err?.message || err);
  }
  return null;
}

/**
 * Creates a safe audio player. Returns an object with play, pause, setMuted, and unload methods.
 * Never throws an uncaught error.
 */
export async function createSafeAudioPlayer(source, options = { loop: true, volume: 0.8 }) {
  const mod = getAudioModule();
  if (mod) {
    try {
      const player = mod.createAudioPlayer(source);
      if (options.loop !== undefined) {
        player.loop = options.loop;
      }
      if (options.volume !== undefined) {
        player.volume = options.volume;
      }

      const playFn = async () => {
        try {
          if (typeof player.play === 'function') player.play();
        } catch (e) {
          console.warn('[SafeAudio] Play error:', e?.message || e);
        }
      };

      const pauseFn = async () => {
        try {
          if (typeof player.pause === 'function') player.pause();
        } catch (e) {
          console.warn('[SafeAudio] Pause error:', e?.message || e);
        }
      };

      const stopFn = async () => {
        try {
          if (typeof player.pause === 'function') player.pause();
          if (typeof player.seekTo === 'function') player.seekTo(0);
        } catch (e) {
          console.warn('[SafeAudio] Stop error:', e?.message || e);
        }
      };

      const unloadFn = async () => {
        try {
          if (typeof player.pause === 'function') player.pause();
          if (typeof player.remove === 'function') {
            player.remove();
          }
        } catch (e) {}
      };

      return {
        play: playFn,
        playAsync: playFn,
        pause: pauseFn,
        pauseAsync: pauseFn,
        stop: stopFn,
        stopAsync: stopFn,
        unload: unloadFn,
        unloadAsync: unloadFn,
        setMuted: async (muted) => {
          try {
            player.muted = Boolean(muted);
            if (muted) {
              player.volume = 0;
            } else {
              player.volume = options.volume ?? 0.8;
            }
          } catch (e) {
            console.warn('[SafeAudio] Mute error:', e?.message || e);
          }
        },
        isNative: true,
      };
    } catch (err) {
      console.warn('[SafeAudio] Runtime player initialization failed, using timer fallback:', err?.message || err);
    }
  }

  // Resilient fallback player for visual pulse & countdown without crashes
  const noop = async () => {};
  return {
    play: noop,
    playAsync: noop,
    pause: noop,
    pauseAsync: noop,
    stop: noop,
    stopAsync: noop,
    unload: noop,
    unloadAsync: noop,
    setMuted: noop,
    isNative: false,
  };
}

export default {
  createSafeAudioPlayer,
};
