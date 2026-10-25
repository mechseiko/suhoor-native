/**
 * Synthesizes high-quality alarm sounds directly with code.
 * Generates self-contained 16-bit PCM WAV base64 Data URIs without external dependencies.
 */

const bytesToBase64 = (bytes) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    base64 += chars[b0 >> 2];
    base64 += chars[((b0 & 3) << 4) | (b1 >> 4)];
    base64 += i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    base64 += i + 2 < len ? chars[b2 & 63] : '=';
  }
  return base64;
};

const createWavDataUri = (samples, sampleRate = 22050) => {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const fileSize = 36 + dataSize;
  const buffer = new Uint8Array(44 + dataSize);

  // RIFF Chunk
  buffer[0] = 0x52; // 'R'
  buffer[1] = 0x49; // 'I'
  buffer[2] = 0x46; // 'F'
  buffer[3] = 0x46; // 'F'
  buffer[4] = fileSize & 0xff;
  buffer[5] = (fileSize >> 8) & 0xff;
  buffer[6] = (fileSize >> 16) & 0xff;
  buffer[7] = (fileSize >> 24) & 0xff;

  // WAVE Chunk
  buffer[8] = 0x57;  // 'W'
  buffer[9] = 0x41;  // 'A'
  buffer[10] = 0x56; // 'V'
  buffer[11] = 0x45; // 'E'

  // fmt Subchunk
  buffer[12] = 0x66; // 'f'
  buffer[13] = 0x6d; // 'm'
  buffer[14] = 0x74; // 't'
  buffer[15] = 0x20; // ' '
  buffer[16] = 16;   // Subchunk1Size (16 for PCM)
  buffer[17] = 0;
  buffer[18] = 0;
  buffer[19] = 0;
  buffer[20] = 1;    // AudioFormat (1 for PCM)
  buffer[21] = 0;
  buffer[22] = 1;    // NumChannels (1 mono)
  buffer[23] = 0;
  buffer[24] = sampleRate & 0xff;
  buffer[25] = (sampleRate >> 8) & 0xff;
  buffer[26] = (sampleRate >> 16) & 0xff;
  buffer[27] = (sampleRate >> 24) & 0xff;

  const byteRate = sampleRate * 2;
  buffer[28] = byteRate & 0xff;
  buffer[29] = (byteRate >> 8) & 0xff;
  buffer[30] = (byteRate >> 16) & 0xff;
  buffer[31] = (byteRate >> 24) & 0xff;
  buffer[32] = 2;    // BlockAlign (2 bytes for 16-bit mono)
  buffer[33] = 0;
  buffer[34] = 16;   // BitsPerSample
  buffer[35] = 0;

  // data Subchunk
  buffer[36] = 0x64; // 'd'
  buffer[37] = 0x61; // 'a'
  buffer[38] = 0x74; // 't'
  buffer[39] = 0x61; // 'a'
  buffer[40] = dataSize & 0xff;
  buffer[41] = (dataSize >> 8) & 0xff;
  buffer[42] = (dataSize >> 16) & 0xff;
  buffer[43] = (dataSize >> 24) & 0xff;

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    const intVal = Math.round(val);
    buffer[offset++] = intVal & 0xff;
    buffer[offset++] = (intVal >> 8) & 0xff;
  }

  return `data:audio/wav;base64,${bytesToBase64(buffer)}`;
};

/**
 * Cache for generated sound URIs to avoid re-generating on every tick.
 */
const soundCache = {};

/**
 * Generates "Apex" alarm:
 * A high-intensity, bright, waking alert pattern. Alternating sharp pulses (880Hz / 1320Hz)
 * with harmonics and crisp attacks designed to pierce through sleep.
 */
export const generateApexSoundUri = () => {
  if (soundCache.apex) return soundCache.apex;

  const sampleRate = 22050;
  const duration = 1.6; // tight, seamless 1.6s loop
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Rapid urgent pulses: 4 pulses per 0.8s pattern
    const subCycle = t % 0.8;
    const pulseIdx = Math.floor(subCycle / 0.18);
    const pulseT = (subCycle % 0.18) / 0.14;

    if (pulseIdx < 4 && pulseT <= 1.0) {
      // Fast, crisp attack and sustained punch
      const env = Math.sin(Math.PI * Math.min(1.0, pulseT * 1.2));
      const freq = (pulseIdx % 2 === 0) ? 1046.5 : 1318.5; // C6 and E6 piercing sirens
      
      const s1 = Math.sin(2 * Math.PI * freq * t);
      const s2 = 0.45 * Math.sin(2 * Math.PI * freq * 2 * t);
      const s3 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t);
      // Punchy saturation to pierce heavy sleep
      const raw = (s1 + s2 + s3) * env;
      samples[i] = Math.tanh(raw * 1.3) * 0.95;
    } else {
      samples[i] = 0;
    }
  }

  soundCache.apex = createWavDataUri(samples, sampleRate);
  return soundCache.apex;
};

/**
 * Generates "Chime" alarm:
 * Crisp, bright, active awakening sound with a punchy cadence.
 * Plays a quick, energetic two-tone pattern (C6 -> E6) that's distinct and awakening
 * without being harsh. Tight loop with no long silent gaps.
 */
export const generateSoftSoundUri = () => {
  if (soundCache.soft) return soundCache.soft;

  const sampleRate = 22050;
  const duration = 1.2; // Tight 1.2s loop for continuous, punchy rhythm
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const cycle = t % 0.6; // 2 chimes per loop
    const isChime1 = cycle < 0.12;
    const isChime2 = cycle > 0.16 && cycle < 0.28;

    if (isChime1 || isChime2) {
      const subT = isChime1 ? cycle / 0.12 : (cycle - 0.16) / 0.12;
      // Quick attack, medium decay for crisp but pleasant sound
      const env = Math.sin(Math.PI * subT) * Math.exp(-subT * 1.5);
      const freq = isChime1 ? 1046.5 : 1318.5; // C6 and E6 bright chimes
      const s1 = Math.sin(2 * Math.PI * freq * t);
      const s2 = 0.4 * Math.sin(2 * Math.PI * freq * 2 * t);
      const s3 = 0.2 * Math.sin(2 * Math.PI * freq * 3 * t);
      samples[i] = Math.tanh((s1 + s2 + s3) * env * 1.1) * 0.92;
    } else {
      samples[i] = 0;
    }
  }

  soundCache.soft = createWavDataUri(samples, sampleRate);
  return soundCache.soft;
};

/**
 * Generates "Pulse" alarm:
 * Driving, rhythmic dual-tone alert with high presence and continuous momentum.
 */
export const generatePulseSoundUri = () => {
  if (soundCache.pulse) return soundCache.pulse;

  const sampleRate = 22050;
  const duration = 1.2; // 1.2s tight loop
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const cycle = t % 0.6; // 2 double-pulses per duration
    const isBeep1 = cycle < 0.13;
    const isBeep2 = cycle > 0.18 && cycle < 0.31;

    if (isBeep1 || isBeep2) {
      const subT = isBeep1 ? cycle / 0.13 : (cycle - 0.18) / 0.13;
      const env = Math.sin(Math.PI * subT);
      const freq = isBeep1 ? 880 : 1174.66; // A5 & D6
      const s1 = Math.sin(2 * Math.PI * freq * t);
      const s2 = 0.4 * Math.sin(2 * Math.PI * freq * 2 * t);
      samples[i] = Math.tanh((s1 + s2) * env * 1.2) * 0.95;
    } else {
      samples[i] = 0;
    }
  }

  soundCache.pulse = createWavDataUri(samples, sampleRate);
  return soundCache.pulse;
};

/**
 * Generates "Default Suhoor" alarm:
 * Classic, energetic, loud wake-up electronic tone with an alternating dual-frequency cadence.
 * Maximally loud, urgent, and consistent over any duration.
 */
export const generateDefaultSoundUri = () => {
  if (soundCache.default) return soundCache.default;

  const sampleRate = 22050;
  const duration = 1.4; // 1.4s energetic loop
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const cycle = t % 0.7; // 2 cycles per loop
    const isBeep1 = cycle < 0.10;
    const isBeep2 = cycle > 0.14 && cycle < 0.24;
    const isBeep3 = cycle > 0.28 && cycle < 0.38;
    const isBeep4 = cycle > 0.42 && cycle < 0.52;

    if (isBeep1 || isBeep2 || isBeep3 || isBeep4) {
      let subT;
      if (isBeep1) subT = cycle / 0.10;
      else if (isBeep2) subT = (cycle - 0.14) / 0.10;
      else if (isBeep3) subT = (cycle - 0.28) / 0.10;
      else subT = (cycle - 0.42) / 0.10;

      const env = Math.sin(Math.PI * subT);
      const freq = (isBeep1 || isBeep3) ? 987.77 : 1318.51; // B5 / E6
      const s1 = Math.sin(2 * Math.PI * freq * t);
      const s2 = 0.45 * Math.sin(2 * Math.PI * freq * 2 * t);
      const s3 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t);
      samples[i] = Math.tanh((s1 + s2 + s3) * env * 1.25) * 0.96;
    } else {
      samples[i] = 0;
    }
  }

  soundCache.default = createWavDataUri(samples, sampleRate);
  return soundCache.default;
};

/**
 * Returns sound URI or identifier for a given sound key.
 */
export const getAlarmSoundUri = (soundKey) => {
  switch (soundKey) {
    case 'apex':
      return generateApexSoundUri();
    case 'soft':
      return generateSoftSoundUri();
    case 'pulse':
      return generatePulseSoundUri();
    case 'default':
    default:
      return generateDefaultSoundUri();
  }
};

export const getAlarmSoundResourceName = (soundKey) => {
  switch (soundKey) {
    case 'apex':
      return 'alarm_sound_apex';
    case 'soft':
      return 'alarm_sound_soft';
    case 'pulse':
      return 'alarm_sound_pulse';
    case 'default':
    default:
      return 'alarm_sound';
  }
};

export const ALARM_SOUND_OPTIONS = [
  {
    id: 'default',
    title: 'Default Suhoor',
    description: 'Classic loud alarm tone',
    badge: 'Standard',
  },
  {
    id: 'apex',
    title: 'Apex',
    description: 'Sharp, energetic high-priority pulse',
    badge: 'Custom',
  },
  {
    id: 'soft',
    title: 'Chime',
    description: 'Crisp, bright morning awakening',
    badge: 'Custom',
  },
  {
    id: 'pulse',
    title: 'Pulse',
    description: 'Rhythmic, modern wake-up beeps',
    badge: 'Custom',
  },
];
