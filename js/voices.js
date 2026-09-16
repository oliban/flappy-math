// Character jump voices, synthesized with Web Audio. Each body type has a
// short cartoon "voice" (chirp, meow, croak, beep...) and every character
// gets its own pitch offset derived from its id, so all 250 sound distinct.
// No audio files, no downloads, no per-play network requests.

// f0: start pitch (Hz), f1: end pitch, dur: seconds, wave: oscillator type,
// vib: vibrato depth (Hz) and rate, filter: lowpass cutoff, noise: add breath/hiss,
// steps: for beepy voices, number of discrete notes.
export const VOICE_PROFILES = {
  bird:    { wave: 'sine',     f0: 1200, f1: 1900, dur: 0.16, vib: [40, 40],  filter: 6000, noise: 0 },
  cat:     { wave: 'triangle', f0: 620,  f1: 420,  dur: 0.32, vib: [18, 9],   filter: 3200, noise: 0 },
  frog:    { wave: 'square',   f0: 150,  f1: 110,  dur: 0.22, vib: [12, 30],  filter: 700,  noise: 0.05 },
  penguin: { wave: 'sawtooth', f0: 520,  f1: 700,  dur: 0.14, vib: [0, 0],    filter: 2600, noise: 0.04 },
  owl:     { wave: 'sine',     f0: 380,  f1: 300,  dur: 0.36, vib: [6, 6],    filter: 1200, noise: 0 },
  fox:     { wave: 'sawtooth', f0: 700,  f1: 1100, dur: 0.13, vib: [0, 0],    filter: 3500, noise: 0.08 },
  panda:   { wave: 'triangle', f0: 200,  f1: 160,  dur: 0.26, vib: [8, 12],   filter: 900,  noise: 0.05 },
  rabbit:  { wave: 'sine',     f0: 1500, f1: 1150, dur: 0.11, vib: [30, 50],  filter: 6000, noise: 0 },
  dog:     { wave: 'sawtooth', f0: 320,  f1: 240,  dur: 0.15, vib: [0, 0],    filter: 1800, noise: 0.1 },
  bear:    { wave: 'sawtooth', f0: 120,  f1: 90,   dur: 0.35, vib: [5, 8],    filter: 600,  noise: 0.08 },
  mouse:   { wave: 'sine',     f0: 2200, f1: 2600, dur: 0.09, vib: [60, 60],  filter: 8000, noise: 0 },
  pig:     { wave: 'sawtooth', f0: 260,  f1: 380,  dur: 0.18, vib: [25, 35],  filter: 1400, noise: 0.12 },
  fish:    { wave: 'sine',     f0: 500,  f1: 900,  dur: 0.12, vib: [0, 0],    filter: 1500, noise: 0, bubble: true },
  octopus: { wave: 'sine',     f0: 300,  f1: 650,  dur: 0.2,  vib: [0, 0],    filter: 1200, noise: 0, bubble: true },
  ghost:   { wave: 'sine',     f0: 420,  f1: 260,  dur: 0.45, vib: [14, 5],   filter: 2000, noise: 0.03 },
  robot:   { wave: 'square',   f0: 880,  f1: 1320, dur: 0.16, vib: [0, 0],    filter: 5000, noise: 0, steps: 2 },
  slime:   { wave: 'sine',     f0: 260,  f1: 180,  dur: 0.2,  vib: [0, 0],    filter: 900,  noise: 0.15, bubble: true },
  dragon:  { wave: 'sawtooth', f0: 180,  f1: 140,  dur: 0.3,  vib: [10, 20],  filter: 1000, noise: 0.2 },
  bug:     { wave: 'sawtooth', f0: 900,  f1: 940,  dur: 0.2,  vib: [80, 90],  filter: 3000, noise: 0 },
  cactus:  { wave: 'triangle', f0: 440,  f1: 660,  dur: 0.14, vib: [0, 0],    filter: 2500, noise: 0.03 },
  star:    { wave: 'sine',     f0: 1046, f1: 2093, dur: 0.24, vib: [0, 0],    filter: 8000, noise: 0, steps: 3 }
};

const DEFAULT_PROFILE = 'bird';

export function getVoiceProfile(avatar) {
  const base = (avatar && (avatar.base || avatar.id)) || DEFAULT_PROFILE;
  return VOICE_PROFILES[base] || VOICE_PROFILES[DEFAULT_PROFILE];
}

// Deterministic pitch multiplier in [0.8, 1.25] from the character id
export function characterDetune(id) {
  let h = 2166136261;
  const str = String(id || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const unit = (h % 1000) / 999; // 0..1
  return 0.8 + unit * 0.45;
}

export function createCharacterVoices(getContext) {
  let muted = false;
  let noiseBuffer = null;

  function getNoise(ctx) {
    if (noiseBuffer) return noiseBuffer;
    const len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  return {
    setMuted(value) { muted = value; },
    isMuted() { return muted; },

    playJump(avatar) {
      if (muted) return;
      const ctx = getContext && getContext();
      if (!ctx) return;

      const p = getVoiceProfile(avatar);
      const detune = characterDetune(avatar && avatar.id);
      const t0 = ctx.currentTime;
      const dur = p.dur;

      // Master envelope -> lowpass -> out
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(0.35, t0 + 0.015);
      master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = p.filter;
      filter.Q.value = 0.8;
      master.connect(filter);
      filter.connect(ctx.destination);

      const steps = p.steps || 1;
      const stepDur = dur / steps;
      for (let s = 0; s < steps; s++) {
        const osc = ctx.createOscillator();
        osc.type = p.wave;
        const start = t0 + s * stepDur;
        const f0 = p.f0 * detune * (steps > 1 ? Math.pow(1.5, s) : 1);
        const f1 = p.f1 * detune * (steps > 1 ? Math.pow(1.5, s) : 1);
        osc.frequency.setValueAtTime(f0, start);
        if (p.bubble) {
          // quick upward "blub"
          osc.frequency.exponentialRampToValueAtTime(f1, start + stepDur * 0.35);
          osc.frequency.exponentialRampToValueAtTime(f0 * 0.9, start + stepDur);
        } else {
          osc.frequency.exponentialRampToValueAtTime(f1, start + stepDur);
        }
        osc.connect(master);
        osc.start(start);
        osc.stop(start + stepDur + 0.02);

        // Vibrato via a second oscillator modulating frequency
        if (p.vib && p.vib[0] > 0) {
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          lfo.frequency.value = p.vib[1];
          lfoGain.gain.value = p.vib[0] * detune;
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          lfo.start(start);
          lfo.stop(start + stepDur + 0.02);
        }
      }

      // Breath / hiss layer for growls, barks and squishes
      if (p.noise > 0) {
        const src = ctx.createBufferSource();
        src.buffer = getNoise(ctx);
        const g = ctx.createGain();
        g.gain.setValueAtTime(p.noise, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(g);
        g.connect(filter);
        src.start(t0);
        src.stop(t0 + dur + 0.02);
      }
    }
  };
}
