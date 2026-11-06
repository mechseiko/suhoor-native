/**
 * Release notes shown once after the installed version changes.
 *
 * Keyed by Android `versionCode` (the build number), because that is what
 * increments on every Play upload and what DeviceInfo reports reliably. A user
 * who skips versions sees every entry between their old build and the new one.
 *
 * HOW TO ADD AN ENTRY
 * 1. Bump `versionCode` in android/app/build.gradle.
 * 2. Add a block here under that new code:
 *
 *      28: {
 *        versionName: '1.0.22',
 *        items: [
 *          { titleKey: 'whatsNew.v28.alarmSound' },
 *          { bodyKey: 'whatsNew.v28.alarmSoundBody' },
 *        ],
 *      },
 *
 * 3. Add those keys to translations/en.js (and the other five files).
 *    `npm run i18n:check` fails if a key is missing, so it cannot ship blank.
 *
 * Item text is rendered with `t()`, so nothing here is hardcoded English. An
 * `items` entry may carry `titleKey` (a line) or `bodyKey` (a paragraph) — use
 * both for a title + explanation, or only `bodyKey` for a plain bullet.
 *
 * While this object is empty the What's New screen never appears, which is the
 * intended state until the first entry is written.
 */
export const WHATS_NEW = {};

/**
 * Every release between two build numbers, oldest first.
 * @param {number} fromCode build number the user last ran
 * @param {number} toCode   build number installed now
 */
export const getWhatsNewEntries = (fromCode, toCode) =>
  Object.entries(WHATS_NEW)
    .map(([code, entry]) => ({ versionCode: Number(code), ...entry }))
    .filter(
      (entry) =>
        Number.isFinite(entry.versionCode) &&
        entry.versionCode > fromCode &&
        entry.versionCode <= toCode &&
        (entry.titleKey || entry.items?.length)
    )
    .sort((a, b) => a.versionCode - b.versionCode);

export default WHATS_NEW;
