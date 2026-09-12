/**
 * The language feature's single source of truth — shared by the web app and
 * the mobile app (suhoor-native).
 *
 * Before this file existed, each app hardcoded its own answer to the same four
 * questions and the answers disagreed: the web list carried `dir` but
 * anglicised native names ('Espanol', 'Turkey'), the native list carried
 * correct native names but no `dir` at all, the two apps persisted the choice
 * under different storage keys, and the native app had no RTL handling despite
 * shipping Arabic and Urdu. Anything language-related — the list, the storage
 * key, direction, device detection, Intl locale tags — belongs here and
 * nowhere else.
 *
 * This file has a twin that must stay byte-for-byte identical:
 *   src/config/languages.js            (web)
 *   suhoor-native/config/languages.js  (mobile)
 * Change one, copy it over the other, and verify with:
 *   diff src/config/languages.js suhoor-native/config/languages.js
 */

/**
 * Every language the product ships.
 *
 * To add one:
 *   1. Add an entry here (in BOTH twins).
 *   2. Create public/locales/{code}/translation.json.
 *   3. Run `npm run i18n:sync` to generate the mobile dictionary.
 * The web switcher, the native switcher, and both detectors pick it up with no
 * further changes.
 *
 * - `code`       BCP-47 primary subtag; the key used everywhere in code.
 * - `name`       English name, for the "(Arabic)" hint beside the native name.
 * - `nativeName` endonym, shown as the primary label in the switcher.
 * - `dir`        'ltr' | 'rtl' — drives document.dir on web, I18nManager on native.
 * - `intlTag`    locale tag for Intl.DateTimeFormat / toLocaleString. Kept
 *                explicit because the bare code is not always what Intl wants,
 *                and because call sites used to inline `code === 'ar' ? 'ar-SA'
 *                : 'en-US'` ternaries that silently ignored the other four.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', intlTag: 'en-US' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', intlTag: 'ar-SA' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', intlTag: 'fr-FR' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr', intlTag: 'es-ES' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', dir: 'ltr', intlTag: 'tr-TR' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl', intlTag: 'ur-PK' },
]

/** Fallback whenever detection, storage, and lookup all come up empty. */
export const DEFAULT_LANGUAGE = 'en'

/** Just the codes — for i18next's `supportedLngs`, guards, and tests. */
export const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code)

/**
 * One storage key for both apps: localStorage/cookie on web, AsyncStorage on
 * native. Identical naming means a user's choice is described the same way
 * everywhere, and there is one string to grep for.
 */
export const LANGUAGE_STORAGE_KEY = 'suhoor-language'

/**
 * Keys earlier builds wrote. Read once, migrated to LANGUAGE_STORAGE_KEY, then
 * ignored — without this the mobile app forgets the user's language the first
 * time they open a build containing this change.
 */
export const LEGACY_LANGUAGE_STORAGE_KEYS = ['suhoor_locale']

/** The full descriptor for a code, or undefined. */
export const getLanguage = (code) =>
  SUPPORTED_LANGUAGES.find((l) => l.code === code)

export const isSupportedLanguage = (code) => LANGUAGE_CODES.includes(code)

/**
 * Narrows any locale-ish string to a supported code.
 * Accepts what device APIs actually hand back — 'ar', 'ar-SA', 'ar_SA',
 * 'AR-sa' — and returns DEFAULT_LANGUAGE for anything unsupported.
 */
export const resolveLanguage = (tag) => {
  if (!tag || typeof tag !== 'string') return DEFAULT_LANGUAGE
  const primary = tag.toLowerCase().replace(/_/g, '-').split('-')[0]
  return isSupportedLanguage(primary) ? primary : DEFAULT_LANGUAGE
}

/** 'ltr' | 'rtl' for a code. Unknown codes are treated as ltr. */
export const directionFor = (code) => getLanguage(code)?.dir ?? 'ltr'

export const isRtl = (code) => directionFor(code) === 'rtl'

/**
 * Locale tag for Intl / toLocaleString / toLocaleDateString.
 * Use this instead of passing the bare language code, and never inline a
 * per-language ternary at the call site.
 *
 * NOTE: this is for *display* formatting only. The Firestore `date` key must
 * stay `toLocaleDateString('en-CA')` (see config/firestoreSchema.js) — it is a
 * storage key, not user-facing text, and must not follow the UI language.
 */
export const intlTagFor = (code) => getLanguage(code)?.intlTag ?? 'en-US'

/**
 * Canonical transliterations, used only when the runtime's ICU data has no
 * Islamic calendar (some older Android Hermes/JSC builds ship a trimmed ICU).
 * Index is `hijriMonth - 1`.
 */
const HIJRI_MONTHS_FALLBACK = [
  'Muharram',
  'Safar',
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qa'dah",
  'Dhu al-Hijjah',
]

/**
 * Localised Hijri month name for a Gregorian date.
 *
 * Replaces the hardcoded English `hijriMonths` array that every screen carried
 * its own copy of: Intl already knows these names in all six languages, so
 * "Ramadan" reads as "رمضان" in Arabic without a translation key per month.
 *
 * `hijriMonth` is the 1-based month from getHijriDate(date), passed in so the
 * fallback path does not have to recompute it.
 */
export const hijriMonthName = (date, code = DEFAULT_LANGUAGE, hijriMonth = null) => {
  const when = date instanceof Date ? date : new Date(date)

  try {
    return new Intl.DateTimeFormat(`${intlTagFor(code)}-u-ca-islamic-umalqura`, {
      month: 'long',
    }).format(when)
  } catch {
    // ICU without Islamic calendar support — fall through to transliterations.
  }

  const index = Number(hijriMonth) - 1
  return index >= 0 && index <= 11 ? HIJRI_MONTHS_FALLBACK[index] : ''
}

/**
 * Back-compat alias. The native app imported `languages` from
 * `../translations`; keep the old name working so call sites can migrate
 * without a flag day.
 */
export const languages = SUPPORTED_LANGUAGES

export default SUPPORTED_LANGUAGES
