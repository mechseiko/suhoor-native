const fs = require('fs');
const path = require('path');

const writeWav = (file, samples, sampleRate) => {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
  console.log('wrote', file, (buf.length / 1024).toFixed(1) + 'KB');
};

const synth = (duration, fn, sampleRate = 22050) => {
  const n = Math.floor(sampleRate * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / sampleRate, i);
  return out;
};

// INFERNO: rapid two-tone siren wail + noise burst, near-constant energy
const inferno = synth(1.4, (t) => {
  const cycle = t % 0.7;
  const beep =
    (cycle < 0.16) || (cycle > 0.2 && cycle < 0.36) ||
    (cycle > 0.40 && cycle < 0.56) || (cycle > 0.60 && cycle < 0.66);
  if (!beep) return 0;
  let subT, freq;
  if (cycle < 0.16) { subT = cycle / 0.16; freq = 1568; }
  else if (cycle < 0.36) { subT = (cycle - 0.2) / 0.16; freq = 2093; }
  else if (cycle < 0.56) { subT = (cycle - 0.4) / 0.16; freq = 1760; }
  else { subT = (cycle - 0.6) / 0.06; freq = 2349; }
  const env = Math.sin(Math.PI * Math.min(1, subT));
  const s =
    Math.sin(2 * Math.PI * freq * t) * 1.0 +
    Math.sin(2 * Math.PI * freq * 2 * t) * 0.5 +
    Math.sin(2 * Math.PI * freq * 3 * t) * 0.3 +
    Math.sin(2 * Math.PI * freq * 0.5 * t) * 0.4;
  return Math.tanh(s * env * 1.6) * 0.98;
});

// THUNDER: deep pounding bass hits + high crack transient, relentless
const thunder = synth(1.2, (t) => {
  const cycle = t % 0.6;
  const hit1 = cycle < 0.14;
  const hit2 = cycle > 0.22 && cycle < 0.36;
  if (!hit1 && !hit2) return 0;
  const subT = hit1 ? cycle / 0.14 : (cycle - 0.22) / 0.14;
  const env = Math.exp(-subT * 3.5) * Math.min(1, subT * 40);
  // sub-bass body + crack
  const body = Math.sin(2 * Math.PI * 82 * t) * 0.9 + Math.sin(2 * Math.PI * 110 * t) * 0.6;
  const crack = Math.sin(2 * Math.PI * 1800 * t) * 0.25 * Math.exp(-subT * 18);
  const hit = Math.sin(2 * Math.PI * 1640 * t) * 0.3 * Math.exp(-subT * 10);
  return Math.tanh((body + crack + hit) * env * 1.8) * 0.98;
});

const rawDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'raw');
writeWav(path.join(rawDir, 'alarm_sound_inferno.wav'), inferno, 22050);
writeWav(path.join(rawDir, 'alarm_sound_thunder.wav'), thunder, 22050);

// Also emit JS snippets? No — soundGenerator.js updated manually.
console.log('done');

// Verify no clipping: report max amplitude
for (const [name, s] of [['inferno', inferno], ['thunder', thunder]]) {
  let max = 0; for (const v of s) max = Math.max(max, Math.abs(v));
  console.log(name, 'peak', max.toFixed(3));
}
