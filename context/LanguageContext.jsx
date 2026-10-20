import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { I18nManager, NativeModules, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  directionFor,
  intlTagFor,
  isRtl,
  resolveLanguage,
} from '../config/languages';

/**
 * The one language provider for the mobile app.
 *
 * Translation itself is i18next (see ../i18n.js) — the same library the web app
 * uses — so `t` here IS i18next's `t`, with i18next's `t(key, fallback, values)`
 * signature and `{{name}}` interpolation. This provider adds only the parts
 * i18next has no opinion about on a phone: React Native's layout direction, and
 * locale-aware date/time formatting.
 *
 * Its public shape matches the web app's `useLanguage()`
 * (src/hooks/useLanguage.js) field for field:
 *
 *   { locale, t, i18n, changeLanguage, languages, dir, isRTL, intlTag,
 *     formatDate, formatTime }
 *
 * plus one mobile-only flag (`isLoadingLocale`), so a component body reads
 * the same in both codebases.
 */

const LanguageContext = createContext({});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  // react-i18next re-renders this subtree on every language change.
  const { t, i18n: instance } = useTranslation();

  const [isLoadingLocale, setIsLoadingLocale] = useState(!i18n.isInitialized);

  const locale = resolveLanguage(instance.resolvedLanguage || instance.language);

  /**
   * Applies layout direction. `allowRTL` must be enabled before `forceRTL` has
   * any effect, and neither takes hold mid-session, so we trigger an automatic
   * reload on Android when direction changes.
   */
  const applyDirection = useCallback((code) => {
    const shouldBeRtl = isRtl(code);
    try {
      I18nManager.allowRTL(true);
      if (I18nManager.isRTL !== shouldBeRtl) {
        I18nManager.forceRTL(shouldBeRtl);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Failed to apply layout direction:', error);
      return false;
    }
  }, []);

  // Detection is async (AsyncStorage), so the first resolved language can
  // arrive after mount.
  useEffect(() => {
    const onReady = () => {
      setIsLoadingLocale(false);
      applyDirection(resolveLanguage(i18n.resolvedLanguage || i18n.language));
    };

    if (i18n.isInitialized) {
      onReady();
    } else {
      i18n.on('initialized', onReady);
    }

    return () => i18n.off('initialized', onReady);
  }, [applyDirection]);

  const changeLanguage = useCallback(
    async (code) => {
      const next = resolveLanguage(code);
      try {
        // i18next persists the choice itself, via the detector's
        // cacheUserLanguage — no separate AsyncStorage write to keep in sync.
        await i18n.changeLanguage(next);
        const needsRestart = applyDirection(next);

        // Automatically restart if layout direction changed
        if (needsRestart) {
          if (Platform.OS === 'android') {
            try {
              if (NativeModules && NativeModules.DevSettings) {
                await NativeModules.DevSettings.reload();
              }
            } catch (e) {
              console.warn('Could not reload automatically:', e);
            }
          } else {
            // iOS doesn't have DevSettings.reload, we'll rely on the banner
            console.log('RTL layout changed - restart required on iOS');
          }
        }

        return { success: true, locale: next };
      } catch (error) {
        console.error('Failed to change language:', error);
        return { success: false, error: error.message };
      }
    },
    [applyDirection]
  );

  const formatDate = useCallback(
    (date, options = {}) => {
      const when = date instanceof Date ? date : new Date(date);
      if (Number.isNaN(when.getTime())) return '';
      try {
        return when.toLocaleDateString(intlTagFor(locale), options);
      } catch {
        return when.toLocaleDateString(intlTagFor(DEFAULT_LANGUAGE), options);
      }
    },
    [locale]
  );

  const formatTime = useCallback(
    (date, options = { hour: '2-digit', minute: '2-digit' }) => {
      const when = date instanceof Date ? date : new Date(date);
      if (Number.isNaN(when.getTime())) return '';
      try {
        return when.toLocaleTimeString(intlTagFor(locale), options);
      } catch {
        return when.toLocaleTimeString(intlTagFor(DEFAULT_LANGUAGE), options);
      }
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      t,
      i18n: instance,
      changeLanguage,
      languages: SUPPORTED_LANGUAGES,
      dir: directionFor(locale),
      isRTL: isRtl(locale),
      intlTag: intlTagFor(locale),
      formatDate,
      formatTime,
      isLoadingLocale,
    }),
    [
      locale,
      t,
      instance,
      changeLanguage,
      formatDate,
      formatTime,
      isLoadingLocale,
    ]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
};

export default LanguageContext;
