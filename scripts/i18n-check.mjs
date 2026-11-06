#!/usr/bin/env node
/**
 * Translation guard for the mobile app.
 *
 *   npm run i18n:check                 report + fail on real problems
 *   npm run i18n:check -- --strict     also fail when a value is still English
 *   npm run i18n:check -- --merge t.json
 *
 * `--merge` takes `{ "some.key": { "ar": "…", "fr": "…" } }` and appends the
 * keys each language is missing (existing keys are never touched).
 *
 * Why this exists: the dictionaries are flat, generated JSON-in-JS files. A key
 * that is missing in one language silently falls back to English, and a
 * duplicated key silently keeps the last value — both are invisible in review.
 *
 * No app code is imported: each file is read and JSON.parse'd, so this runs on
 * any Node version without React Native, Metro or a bundler.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'translations');
const LANGS = ['en', 'ar', 'fr', 'es', 'tr', 'ur'];

/**
 * Values that are legitimately identical to English in that language.
 * Add to this list only when the same word really is correct.
 */
const ENGLISH_IS_FINE = new Set([
  'app.name', // brand
  'common.searchShortcut', // "Ctrl K"
  'auth.email',
  'auth.emailPlaceholder',
  'auth.passwordPlaceholder',
  'fasting.iftar',
  'fasting.suhoor',
  'fasting.ramadan',
  'fasting.hijriDate',
  'fasting.no', // Spanish "No"
  'home.notifications',
  'settings.notifications', // French "Notifications"
  'settings.ramadan',
  'onboarding.pin',
  'onboarding.alarmPin',
  'onboarding.buzz',
  'leaderboard.global',
  'leaderboard.participantCount',
  'nav.actions',
  'nav.docs',
  'common.pages',
  'common.error',
  'groups.admin',
  'profile.version',
  'profile.badgeStandard',
  'whatsNew.versionLabel', // French uses "Version" unchanged
]);

const keyLine = /^\s*"((?:[^"\\]|\\.)+)"\s*:/gm;

function readRaw(lang) {
  return fs.readFileSync(path.join(DIR, `${lang}.js`), 'utf8');
}

/** The files are a JSON object preceded by `export const x =` — parse the object. */
function readDict(lang) {
  const raw = readRaw(lang);
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`${lang}.js: no object literal`);
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (err) {
    throw new Error(`${lang}.js is not valid JSON inside the object: ${err.message}`);
  }
}

function duplicateKeys(lang) {
  const keys = [...readRaw(lang).matchAll(keyLine)].map((m) => m[1]);
  const seen = new Set();
  const dupes = [];
  for (const k of keys) {
    if (seen.has(k)) dupes.push(k);
    seen.add(k);
  }
  return dupes;
}

const placeholders = (value) =>
  [...String(value).matchAll(/\{\{\s*(\w+)\s*\}\}/g)]
    .map((m) => m[1])
    .sort()
    .join(',');

const escapeKey = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Append `[key, value]` pairs before the closing `};`, keeping the file valid. */
function appendEntries(raw, entries) {
  if (!entries.length) return raw;
  const idx = raw.lastIndexOf('\n};');
  if (idx === -1) throw new Error('closing `};` not found');
  let head = raw.slice(0, idx).replace(/\s+$/, '');
  const tail = raw.slice(idx);
  if (!head.endsWith(',')) head += ',';
  const lines = entries
    .map(([k, v], i) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}${i === entries.length - 1 ? '' : ','}`)
    .join('\n');
  return `${head}\n${lines}${tail}`;
}

function mergeFromFile(file) {
  const payload = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const en = readDict('en');
  let changed = 0;

  for (const lang of LANGS) {
    const dict = readDict(lang);
    const additions = [];
    for (const [key, byLang] of Object.entries(payload)) {
      if (key in dict) continue;
      const value = byLang?.[lang];
      if (typeof value !== 'string' || !value) continue;

      // A new key may be introduced here, but only if the JSON also carries its
      // English value — the English is the source of truth for placeholders.
      const enValue = key in en ? en[key] : byLang?.en;
      if (!enValue) {
        console.warn(`! ${key} is not in en.js and has no "en" value — skipped`);
        continue;
      }
      if (lang !== 'en' && placeholders(value) !== placeholders(enValue)) {
        throw new Error(`${lang} ${key}: placeholders do not match en (${placeholders(enValue)})`);
      }
      additions.push([key, value]);
    }
    if (!additions.length) continue;
    fs.writeFileSync(path.join(DIR, `${lang}.js`), appendEntries(readRaw(lang), additions), 'utf8');
    console.log(`${lang}.js: added ${additions.length}`);
    changed += additions.length;
  }
  return changed;
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--merge') {
    const n = mergeFromFile(args[1] || '');
    console.log(n ? `\nmerged ${n} value(s) — re-run i18n:check` : '\nnothing to merge');
    return 0;
  }

  const strict = args.includes('--strict');
  const dicts = Object.fromEntries(LANGS.map((l) => [l, readDict(l)]));
  const en = dicts.en;
  const enKeys = Object.keys(en);
  let failures = 0;
  const warn = (msg) => { failures += 1; console.log(`✗ ${msg}`); };

  for (const lang of LANGS) {
    const dupes = duplicateKeys(lang);
    if (dupes.length) warn(`${lang}.js duplicate keys: ${dupes.join(', ')}`);
    console.log(`${lang}.js: ${Object.keys(dicts[lang]).length} keys`);
  }

  for (const lang of LANGS.filter((l) => l !== 'en')) {
    const dict = dicts[lang];
    const missing = enKeys.filter((k) => !(k in dict));
    const extra = Object.keys(dict).filter((k) => !(k in en));
    if (missing.length) warn(`${lang} missing ${missing.length}: ${missing.join(', ')}`);
    if (extra.length) warn(`${lang} has ${extra.length} key(s) not in en: ${extra.join(', ')}`);

    const badPlaceholders = enKeys.filter(
      (k) => k in dict && placeholders(en[k]) !== placeholders(dict[k])
    );
    if (badPlaceholders.length) warn(`${lang} placeholder mismatch: ${badPlaceholders.join(', ')}`);

    const english = enKeys.filter(
      (k) => k in dict && dict[k] === en[k] && !ENGLISH_IS_FINE.has(k)
    );
    if (english.length) {
      const line = `${lang} still English (${english.length}): ${english.join(', ')}`;
      if (strict) warn(line); else console.log(`… ${line}`);
    }
  }

  // Keys in en.js that no code references with a literal t('…').
  const SKIP_DIRS = new Set(['node_modules', '.git', 'android', 'ios', 'dist', 'suhoor-backend', '.expo', '.metro-cache', 'scripts', 'translations']);
  const sources = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|jsx)$/.test(e.name)) sources.push(p);
    }
  })(ROOT);

  const used = new Set();
  const usedRe = /(?:^|[^\w.])t\(\s*['"]([A-Za-z0-9_.]+)['"]/g;
  // Keys referenced through data files, e.g. whatsNew.js `titleKey: 'x.y'`.
  const dataKeyRe = /(?:titleKey|bodyKey|Key)\s*:\s*['"]([A-Za-z0-9_.]+)['"]/g;
  for (const file of sources) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(usedRe)) used.add(m[1]);
    if (/whatsNew/.test(file)) for (const m of src.matchAll(dataKeyRe)) used.add(m[1]);
  }
  const unused = enKeys.filter((k) => !used.has(k));
  console.log(`\nen.js keys used literally: ${used.size} of ${enKeys.length}`);
  console.log(`… never referenced by a literal key: ${unused.length} (informational; many are used via variables)`);

  console.log(failures === 0 ? '\n✔ translations OK' : `\n✗ ${failures} problem(s)`);
  return failures === 0 ? 0 : 1;
}

process.exit(main());
