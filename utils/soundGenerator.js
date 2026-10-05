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
  const duration = 2.4; // seconds
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // 3 pulses per second
    const pulseCycle = (t % 0.35);
    if (pulseCycle < 0.22) {
      const pulseT = pulseCycle / 0.22;
      const env = Math.sin(Math.PI * pulseT);
      const freq = (t % 0.7 < 0.35) ? 960 : 1280;
      
      // Fundamental + 2nd + 3rd harmonics for punchy apex wake-up
      const s1 = Math.sin(2 * Math.PI * freq * t);
      const s2 = 0.35 * Math.sin(2 * Math.PI * freq * 2 * t);
      const s3 = 0.15 * Math.sin(2 * Math.PI * freq * 3 * t);
      samples[i] = (s1 + s2 + s3) * env * 0.85;
    } else {
      samples[i] = 0;
    }
  }

  soundCache.apex = createWavDataUri(samples, sampleRate);
  return soundCache.apex;
};

/**
 * Generates "Soft" alarm:
 * A gentle, melodic, peaceful awakening sound with warm sine harmonics
 * and smooth fade-in / fade-out (E5 -> G#5 -> B5 major triad).
 */
export const generateSoftSoundUri = () => {
  if (soundCache.soft) return soundCache.soft;

  const sampleRate = 22050;
  const duration = 3.2; // seconds
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  // 4 notes: E5 (659Hz), G#5 (830Hz), B5 (987Hz), E6 (1318Hz)
  const notes = [659.25, 830.61, 987.77, 1318.51];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sampleVal = 0;

    notes.forEach((freq, noteIdx) => {
      const noteStart = noteIdx * 0.65;
      const noteT = t - noteStart;
      if (noteT >= 0 && noteT < 1.4) {
        // Bell-like smooth attack and exponential decay
        const env = Math.sin(Math.min(Math.PI / 2, noteT * 12)) * Math.exp(-noteT * 2.8);
        const s1 = Math.sin(2 * Math.PI * freq * noteT);
        const s2 = 0.25 * Math.sin(2 * Math.PI * freq * 2 * noteT);
        sampleVal += (s1 + s2) * env * 0.35;
      }
    });

    samples[i] = Math.max(-1, Math.min(1, sampleVal));
  }

  soundCache.soft = createWavDataUri(samples, sampleRate);
  return soundCache.soft;
};

/**
 * Generates "Pulse" alarm:
 * A modern, rhythmic dual-tone alert.
 */
export const generatePulseSoundUri = () => {
  if (soundCache.pulse) return soundCache.pulse;

  const sampleRate = 22050;
  const duration = 2.0;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const cycle = t % 1.0;
    if (cycle < 0.15 || (cycle > 0.22 && cycle < 0.37)) {
      const subT = cycle < 0.15 ? cycle / 0.15 : (cycle - 0.22) / 0.15;
      const env = Math.sin(Math.PI * subT);
      const freq = cycle < 0.15 ? 784 : 1046.5; // G5 and C6
      samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.8;
    } else {
      samples[i] = 0;
    }
  }

  soundCache.pulse = createWavDataUri(samples, sampleRate);
  return soundCache.pulse;
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
      return null; // Signals to use native default alarm sound
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
    title: 'Soft Chime',
    description: 'Gentle, melodious morning awakening',
    badge: 'Custom',
  },
  {
    id: 'pulse',
    title: 'Pulse',
    description: 'Rhythmic, modern wake-up beeps',
    badge: 'Custom',
  },
];
