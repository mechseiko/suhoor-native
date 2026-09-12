import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from './translations';
import {
  LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LEGACY_LANGUAGE_STORAGE_KEYS,
  isSupportedLanguage,
  resolveLanguage,
} from './config/languages';

/**
 * i18next for the mobile app — the same translation engine, at the same major
 * versions, as the web app's src/i18n.js.
 *
 * Both apps therefore share one `t()` contract, one interpolation syntax, one
 * fallback chain and one set of flat dotted keys, which is what makes a string
 * movable between the two codebases untouched. The differences are only the two
 * things that genuinely differ per platform:
 *
 *   web    HTTP backend  + localStorage/cookie/navigator detection
 *   mobile bundled JSON  + AsyncStorage/device-locale detection
 *
 * Resources are bundled rather than fetched because a phone that wakes you for
 * suhoor has to render before it has a network. The dictionaries in
 * translations/ are GENERATED from the web app's public/locales — edit the JSON
 * there and run `npm run i18n:sync` from the repo root.
 */

/** i18next wants { en: { translation: {...} } }; the generated files are flat. */
const resources = Object.fromEntries(
  LANGUAGE_CODES.map((code) => [code, { translation: translations[code] ?? {} }])
);

/**
 * Ordered device language preferences, via react-native-localize (a declared
 * dependency of this app). A device set to [fr, en] gets French even though both
 * are supported — which a plain "first locale wins" check gets wrong.
 */
const detectDeviceLanguage = () => {
  try {
    // Required lazily so a build without the native module linked still boots.
    const Localize = require('react-native-localize');
    for (const entry of Localize?.getLocales?.() ?? []) {
      const tag = entry?.languageTag || entry?.languageCode;
      const primary = typeof tag === 'string' ? tag.toLowerCase().split('-')[0] : null;
      if (isSupportedLanguage(primary)) return primary;
    }
  } catch {
    // Native module unavailable — fall through to the default.
  }
  return DEFAULT_LANGUAGE;
};

/**
 * Stored choice, migrating from any key an earlier build wrote. Without this,
 * unifying on LANGUAGE_STORAGE_KEY would silently reset every existing user
 * back to device detection.
 */
const readStoredLanguage = async () => {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(stored)) return stored;

    for (const legacyKey of LEGACY_LANGUAGE_STORAGE_KEYS) {
      const legacy = await AsyncStorage.getItem(legacyKey);
      if (isSupportedLanguage(legacy)) {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, legacy);
        await AsyncStorage.removeItem(legacyKey);
        return legacy;
      }
    }
  } catch (error) {
    console.warn('Could not read stored language:', error);
  }
  return null;
};

/**
 * The mobile counterpart to i18next-browser-languagedetector: same job, same
 * precedence (explicit choice beats device), different storage.
 */
const asyncStorageDetector = {
  type: 'languageDetector',
  async: true,
  init: () => {},
  detect: async (callback) => {
    const stored = await readStoredLanguage();
    callback(stored || detectDeviceLanguage());
  },
  cacheUserLanguage: async (language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, resolveLanguage(language));
    } catch (error) {
      console.warn('Could not persist language:', error);
    }
  },
};

i18n
  .use(asyncStorageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: LANGUAGE_CODES,
    // A device reporting 'ar-SA' is an Arabic device: accept the region tag,
    // then load the region-less dictionary rather than looking for 'ar-SA'.
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    ns: ['translation'],
    defaultNS: 'translation',
    // Flat dotted keys ("nav.home" is one key, not a path) — matches web.
    keySeparator: false,
    interpolation: { escapeValue: false },
    returnNull: false,
    // Suspense would blank the tree on every language change in RN.
    react: { useSuspense: false },
    compatibilityJSON: 'v4',
  });

export default i18n;
