type AudioContextCtor = typeof AudioContext;

const SOUND_STORAGE_KEY = "soundEnabled";
export const SOUND_CHANGED_EVENT = "lume:sound-enabled-changed";

let audioCtx: AudioContext | null = null;
let soundUnlockInstalled = false;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const Ctor = (window.AudioContext || (window as Window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext);
  if (!Ctor) return null;
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

export const isAppSoundEnabled = (): boolean =>
  typeof window === "undefined" || localStorage.getItem(SOUND_STORAGE_KEY) !== "false";

export const setAppSoundEnabled = (enabled: boolean): void => {
  localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
  if (enabled) {
    getAudioContext();
  }
  window.dispatchEvent(new CustomEvent(SOUND_CHANGED_EVENT, { detail: enabled }));
};

const installSoundUnlockListeners = (): void => {
  if (typeof window === "undefined" || soundUnlockInstalled) return;
  soundUnlockInstalled = true;

  const unlock = () => {
    if (isAppSoundEnabled()) {
      getAudioContext();
    }
  };

  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
};

installSoundUnlockListeners();

const playTone = (frequency: number, duration: number, volume: number, startAt = 0): void => {
  if (!isAppSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const start = ctx.currentTime + startAt;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
};

export const playMessageTone = (): void => {
  try {
    playTone(880, 0.12, 0.12);
    playTone(520, 0.16, 0.08, 0.08);
  } catch {
    // Sound is non-critical.
  }
};

export interface RingtoneHandle {
  stop: () => void;
}

export const startRingtone = (): RingtoneHandle => {
  let stopped = false;
  let timer: number | null = null;

  const ring = () => {
    if (stopped || !isAppSoundEnabled()) return;
    try {
      playTone(660, 0.18, 0.13);
      playTone(880, 0.18, 0.13, 0.22);
      playTone(660, 0.22, 0.1, 0.44);
    } catch {
      // Sound is non-critical.
    }
  };

  if (isAppSoundEnabled()) {
    ring();
    timer = window.setInterval(ring, 1600);
  }

  return {
    stop: () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
      timer = null;
    },
  };
};
