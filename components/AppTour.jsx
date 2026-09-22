import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  I18nManager,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { font, size, weight } from '../theme';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

const PENDING_KEY = 'suhoor-tab-tour-pending';
const DONE_KEY = 'suhoor-tab-tour-done';

const TAB_ICONS = ['home', 'alarm', 'people', 'book', 'person'];
const INTRO_KEYS = [
  'tour.intro.overview',
  'tour.intro.alarms',
  'tour.intro.groups',
  'tour.intro.duas',
  'tour.intro.profile',
];
const SUMMARY = [
  {
    titleKey: 'tour.summary.overview',
    bulletKeys: ['tour.overview.1', 'tour.overview.2', 'tour.overview.3', 'tour.overview.4'],
  },
  {
    titleKey: 'tour.summary.alarms',
    bulletKeys: ['tour.alarms.1', 'tour.alarms.2', 'tour.alarms.3', 'tour.alarms.4'],
  },
  {
    titleKey: 'tour.summary.groups',
    bulletKeys: ['tour.groups.1', 'tour.groups.2', 'tour.groups.3', 'tour.groups.4'],
  },
  {
    titleKey: 'tour.summary.duas',
    bulletKeys: ['tour.duas.1', 'tour.duas.2', 'tour.duas.3'],
  },
  {
    titleKey: 'tour.summary.profile',
    bulletKeys: ['tour.profile.1', 'tour.profile.2', 'tour.profile.3', 'tour.profile.4'],
  },
];

const TOUR_STEPS = [
  ...INTRO_KEYS.map((_, tab) => ({ tab, phase: 'intro' })),
  ...SUMMARY.map((_, tab) => ({ tab, phase: 'summary' })),
];

const TAB_BAR_FALLBACK_HEIGHT = Platform.OS === 'web' ? 70 : 62;
const HOLE_PAD = 8;
// Height of the dimmed band above the tab bar that carries the intro text
const TEXT_BAND = 270;

// Only import safe area context on mobile platforms
let useSafeAreaInsets;
if (Platform.OS !== 'web') {
  try {
    useSafeAreaInsets = require('react-native-safe-area-context').useSafeAreaInsets;
  } catch (e) {
    console.warn('react-native-safe-area-context not available');
  }
}

export const AppTour = ({ children, tabBarRef }) => {
  const { t } = useLanguage();
  const { colors, isDark } = useTheme();
  const insets = Platform.OS === 'web'
    ? { top: 0 }
    : useSafeAreaInsets
      ? useSafeAreaInsets()
      : { top: 0 };

  const [visible, setVisible] = useState(false);
  const [frame, setFrame] = useState(null);
  const [step, setStep] = useState(0);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(1)).current;
  const holeL = useRef(new Animated.Value(0)).current;
  const holeT = useRef(new Animated.Value(0)).current;
  const holeW = useRef(new Animated.Value(0)).current;
  const holeH = useRef(new Animated.Value(0)).current;

  const layoutRtl = I18nManager.isRTL;
  const isLastStep = step === TOUR_STEPS.length - 1;

  // The tour only runs for fresh signups: SignupScreen sets PENDING_KEY at
  // account creation and the flag is cleared once the tour finishes.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [done, pending] = await Promise.all([
          AsyncStorage.getItem(DONE_KEY),
          AsyncStorage.getItem(PENDING_KEY),
        ]);
        if (active && done !== 'true' && pending === 'true') {
          setVisible(true);
        }
      } catch (e) {
        console.error('Error checking tab tour status:', e);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    setFrame({
      x: 0,
      y: WINDOW_HEIGHT - TAB_BAR_FALLBACK_HEIGHT,
      width: WINDOW_WIDTH,
      height: TAB_BAR_FALLBACK_HEIGHT,
    });
    const timer = setTimeout(() => {
      try {
        const node = tabBarRef && tabBarRef.current;
        if (node && node.measureInWindow) {
          node.measureInWindow((x, y, w, h) => {
            if (w > 0 && h > 0 && y > 0) {
              setFrame({ x, y, width: w, height: h });
            }
          });
        }
      } catch (e) {
        console.warn('Tab tour measurement failed, using fallback:', e);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [visible]);

  const getHoleRect = (stepIndex) => {
    const target = TOUR_STEPS[stepIndex];
    if (target.phase === 'intro' && target.tab === 0) {
      // Home screen: spotlight the content area, keeping a dimmed band
      // above the tab bar for the welcome text.
      const top = insets.top + 10;
      const bottom = Math.max(frame.y - TEXT_BAND, top + 120);
      return { l: 14, t: top, w: WINDOW_WIDTH - 28, h: bottom - top };
    }
    const cellW = frame.width / TAB_ICONS.length;
    const visual = layoutRtl ? TAB_ICONS.length - 1 - target.tab : target.tab;
    return {
      l: frame.x + cellW * visual + HOLE_PAD,
      t: frame.y + HOLE_PAD,
      w: cellW - HOLE_PAD * 2,
      h: frame.height - HOLE_PAD * 2,
    };
  };

  useEffect(() => {
    if (!visible || !frame) return;
    const rect = getHoleRect(0);
    holeL.setValue(rect.l);
    holeT.setValue(rect.t);
    holeW.setValue(rect.w);
    holeH.setValue(rect.h);
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 450,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 0.45,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, frame]);

  const goToStep = (next) => {
    if (next < 0 || next >= TOUR_STEPS.length || !frame) return;
    const rect = getHoleRect(next);
    Animated.parallel([
      Animated.timing(holeL, {
        toValue: rect.l,
        duration: 520,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(holeT, {
        toValue: rect.t,
        duration: 520,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(holeW, {
        toValue: rect.w,
        duration: 520,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(holeH, {
        toValue: rect.h,
        duration: 520,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(next);
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem(DONE_KEY, 'true');
      await AsyncStorage.removeItem(PENDING_KEY);
    } catch (e) {
      console.error('Error saving tab tour status:', e);
    }
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  };

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      goToStep(step + 1);
    }
  };

  if (!visible || !frame) {
    return <>{children}</>;
  }

  const current = TOUR_STEPS[step];
  const iconName = TAB_ICONS[current.tab];

  const renderControls = () => (
    <View style={styles.controlsRow}>
      {step > 0 && (
        <TouchableOpacity style={styles.backBtn} onPress={() => goToStep(step - 1)}>
          <Ionicons
            name={layoutRtl ? 'arrow-forward' : 'arrow-back'}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.backBtnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.nextBtn, { backgroundColor: colors.primary }]}
        onPress={handleNext}
      >
        <Text style={styles.nextBtnText}>
          {isLastStep ? t('common.done') : t('common.next')}
        </Text>
        <Ionicons
          name={isLastStep ? 'checkmark' : layoutRtl ? 'arrow-back' : 'arrow-forward'}
          size={18}
          color="#FFFFFF"
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      {children}
      <Modal
        visible
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleComplete}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}>
          {/* Dimmed panels around the spotlight hole */}
          <Animated.View style={[styles.shade, { left: 0, right: 0, top: 0, height: holeT }]} />
          <Animated.View
            style={[styles.shade, { left: 0, right: 0, bottom: 0, top: Animated.add(holeT, holeH) }]}
          />
          <Animated.View style={[styles.shade, { left: 0, top: holeT, width: holeL, height: holeH }]} />
          <Animated.View
            style={[styles.shade, { right: 0, top: holeT, height: holeH, left: Animated.add(holeL, holeW) }]}
          />

          {/* Spotlight ring with a continuous pulse */}
          <Animated.View
            style={{
              position: 'absolute',
              left: holeL,
              top: holeT,
              width: holeW,
              height: holeH,
              borderRadius: 16,
              borderWidth: 2.5,
              borderColor: colors.primary,
              opacity: ringPulse,
            }}
          />

          <TouchableOpacity
            style={[styles.skipBtn, { top: insets.top + 10 }]}
            onPress={handleComplete}
          >
            <Text style={styles.skipText}>{t('common.skip')}</Text>
          </TouchableOpacity>

          <View style={[styles.dotsRow, { top: insets.top + 18 }]}>
            {TOUR_STEPS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === step && styles.dotActive,
                  {
                    backgroundColor:
                      index === step ? colors.primary : 'rgba(255, 255, 255, 0.35)',
                  },
                ]}
              />
            ))}
          </View>

          {current.phase === 'intro' ? (
            <Animated.View
              style={[
                styles.introWrap,
                { opacity: textOpacity, bottom: WINDOW_HEIGHT - frame.y + 20 },
              ]}
            >
              <View style={styles.introIconWrap}>
                <Ionicons name={iconName} size={32} color={colors.primary} />
              </View>
              {step === 0 ? (
                <>
                  <Text style={styles.eyebrow}>{t('tour.subtitle')}</Text>
                  <Text style={styles.introTitle}>{t('tour.welcome')}</Text>
                  <Text style={styles.introText}>{t('tour.intro.overview')}</Text>
                </>
              ) : (
                <Text style={styles.introTitle}>{t(INTRO_KEYS[current.tab])}</Text>
              )}
              {renderControls()}
            </Animated.View>
          ) : (
            <Animated.View style={[styles.summaryWrap, { opacity: textOpacity, height: frame.y }]}>
              <View
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View
                  style={[
                    styles.cardIconWrap,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                    },
                  ]}
                >
                  <Ionicons name={iconName} size={26} color={colors.primary} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {t(SUMMARY[current.tab].titleKey)}
                </Text>
                {SUMMARY[current.tab].bulletKeys.map((key) => (
                  <View key={key} style={styles.bulletRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                      {t(key)}
                    </Text>
                  </View>
                ))}
                {renderControls()}
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  shade: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  skipBtn: {
    position: 'absolute',
    right: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: size.sm,
    ...font('body', weight.semibold),
  },
  dotsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    borderRadius: 4,
  },
  introWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  introIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  eyebrow: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: size.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    ...font('body', weight.semibold),
  },
  introTitle: {
    color: '#FFFFFF',
    fontSize: size.xxl,
    textAlign: 'center',
    marginBottom: 8,
    ...font('heading', weight.bold),
  },
  introText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: size.base,
    textAlign: 'center',
    ...font('body', weight.medium),
  },
  summaryWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: size.xl,
    marginBottom: 14,
    textAlign: 'center',
    ...font('heading', weight.bold),
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  bulletText: {
    flex: 1,
    fontSize: size.sm,
    ...font('body', weight.medium),
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    alignSelf: 'stretch',
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: size.sm,
    ...font('body', weight.semibold),
  },
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: size.sm,
    ...font('body', weight.bold),
  },
});

export default AppTour;
