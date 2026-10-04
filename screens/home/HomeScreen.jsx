import { FlatList, Image, Linking, Modal, RefreshControl, StyleSheet, TouchableOpacity, View, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../config/firebase';
import { CLOSED_TESTER_FEATURES } from '../../config/closedTesterFeatures';
import { COLLECTIONS } from '../../config/firestoreSchema';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import FastingPrompt from '../../components/FastingPrompt';
import AudioModeWarning from '../../components/AudioModeWarning';
import StatsCard from '../../components/StatsCard';
import ProfileSidebar from '../../components/ProfileSidebar';
import { Badge, Button, Card, IconTile, Screen, Text } from '../../components/ui';
import { brand, radius, spacing } from '../../theme';
import { useState, useEffect, useRef } from 'react';

const alpha = (color, opacity) => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const HomeScreen = ({ navigation }) => {
  const { currentUser, userProfile } = useAuth();
  const { colors } = useTheme();
  const { t, formatDate } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // PIN setup modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const pinRefs = [useRef(), useRef(), useRef(), useRef()];

  // Update available modal state
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Stats
  const [totalGroups, setTotalGroups] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalFastingDays, setTotalFastingDays] = useState(0);
  const [loading, setLoading] = useState(true);

  // Calendar history (for visual styling)
  const [weeklyFasting, setWeeklyFasting] = useState([false, false, false, false, false, false, false]);

  // Check for forced update
useEffect(() => {
  const checkForUpdate = async () => {
    if (!currentUser?.uid) return; // wait until user is loaded
    try {
      // Read from the user's OWN profile document
      const userDoc = await getDoc(doc(db, 'profiles', currentUser.uid));
      // ⬆️ change 'profiles' to 'users' if that's your collection name

      if (userDoc.exists() && userDoc.data()?.force_update === true) {
        setShowUpdateModal(true);
      }
    } catch (err) {
      console.log('[HomeScreen] Could not check for update:', err);
    }
  };
  checkForUpdate();
}, [currentUser]); // ⬅️ IMPORTANT: re-run when currentUser is ready

  const fetchDashboardData = async () => {
    if (!currentUser) return;
    try {
      console.log('[HomeScreen] Fetching dashboard data for user:', currentUser.uid);
      
      // 1. Fetch groups that user belongs to
      const membersRef = collection(db, 'group_members');
      const groupsQuery = query(membersRef, where('user_id', '==', currentUser.uid));
      const groupMembersSnap = await getDocs(groupsQuery);

      console.log('[HomeScreen] Group members query result size:', groupMembersSnap.size);

      const groupIds = [];
      groupMembersSnap.forEach((doc) => {
        groupIds.push(doc.data().group_id);
      });

      setTotalGroups(groupIds.length);
      console.log('[HomeScreen] Group IDs:', groupIds);

      // 2. Fetch unique member count across all groups
      const uniqueMemberIds = new Set();
      for (const gid of groupIds) {
        const membersQ = query(membersRef, where('group_id', '==', gid));
        const membersSnap = await getDocs(membersQ);
        membersSnap.forEach((mDoc) => {
          uniqueMemberIds.add(mDoc.data().user_id);
        });
      }
      setTotalMembers(uniqueMemberIds.size);
      console.log('[HomeScreen] Total unique members:', uniqueMemberIds.size);

      // 3. Fetch total fasting days this year (based on actual wake-up logs, not just intentions)
      const wakeUpLogsRef = collection(db, COLLECTIONS.wakeUpLogs);
      const wakeUpQuery = query(
        wakeUpLogsRef,
        where('user_id', '==', currentUser.uid)
      );
      const wakeUpSnap = await getDocs(wakeUpQuery);
      setTotalFastingDays(wakeUpSnap.size);
      console.log('[HomeScreen] Total fasting days:', wakeUpSnap.size);

      // 4. Determine fasting status for last 7 days for a nice visual widget (based on actual wake-ups)
      const last7DaysStatus = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toLocaleDateString('en-CA');
        const dayWakeUpQuery = query(
          wakeUpLogsRef,
          where('user_id', '==', currentUser.uid),
          where('date', '==', dateStr)
        );
        const daySnap = await getDocs(dayWakeUpQuery);
        let fasted = daySnap.size > 0; // Consider fasted if they actually woke up and logged it
        last7DaysStatus.push(fasted);
      }
      setWeeklyFasting(last7DaysStatus);
      console.log('[HomeScreen] Weekly fasting status:', last7DaysStatus);
    } catch (err) {
      console.error('[HomeScreen] Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentUser, userProfile?.pin]); // Re-fetch when PIN changes to update UI

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Weekday initial for the 7-day strip. Intl already knows the initial in
  // every supported language, so nothing is spelled out here — and RTL locales
  // get their own letters rather than transliterated Latin ones.
  const getDayLetter = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return formatDate(d, { weekday: 'narrow' });
  };

  const getWelcomeMessage = () => {
    const hours = new Date().getHours();
    if (hours < 12) return t('home.welcomeMorning');
    if (hours < 18) return t('home.welcomeAfternoon');
    return t('home.welcomeEvening');
  };

  // PIN setup functions
  const handlePinDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);
    setPinError('');
    if (digit && index < 3) {
      pinRefs[index + 1]?.current?.focus();
    }
    if (digit && index === 3) {
      const entered = [...next.slice(0, 3), digit].join('');
      handlePinVerify(entered);
    }
  };

  const handlePinKeyPress = (index, e) => {
    if (e.nativeEvent?.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs[index - 1]?.current?.focus();
    }
  };

  const handlePinVerify = async (override) => {
    const entered = override ?? pinDigits.join('');
    if (entered.length < 4) {
      setPinError('Enter your 4-digit PIN.');
      return;
    }

    try {
      // Save PIN to AsyncStorage (matching onboarding flow)
      await AsyncStorage.setItem('suhoor_alarm_pin', entered);

      setPinError('');
      setShowPinModal(false);
      setPinDigits(['', '', '', '']);
    } catch (err) {
      console.error('Error saving PIN:', err);
      setPinError('Failed to save PIN. Try again.');
    }
  };

  const displayName =
    userProfile?.display_name ||
    currentUser?.displayName ||
    currentUser?.email?.split('@')[0];

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      contentStyle={{ paddingTop: 16 }}
    >
      <View style={styles.greeting}>
        <View style={styles.greetingText}>
          <Text variant="body" tone="secondary">
            {getWelcomeMessage()}
          </Text>
          <Text variant="h1" tone="primary" style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <View style={{ alignItems: 'center' }}>
            {/* Profile Avatar */}
            <TouchableOpacity
              onPress={() => setSidebarVisible(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open profile sidebar"
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: brand.primary,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.15,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>
                {(displayName || 'U').charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>

         
        </View>
      </View>

      <Text variant="body" tone="secondary">
        {t('home.blessing')}
      </Text>

      {/* Alarm PIN Setup Prompt Card */}
      {(userProfile && !userProfile.pin) ? (
        <Card style={[styles.pinPromptCard, { borderColor: colors.warning, borderWidth: 1.5 }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: alpha(colors.warning, 0.1) }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.warning} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text variant="h3" style={{ color: colors.warning }}>Set Your Alarm PIN</Text>
              <Text variant="caption" tone="secondary">
                You need to set up your 4-digit PIN to be able to receive and dismiss alarms.
              </Text>
            </View>
          </View>
          <Button
            title="Set Up PIN"
            onPress={() => {
              setShowPinModal(true);
              setTimeout(() => pinRefs[0]?.current?.focus(), 200);
            }}
            variant="secondary"
            style={{ borderRadius: 8 }}
          />
        </Card>
      ) : CLOSED_TESTER_FEATURES.fastingPrompt ? <FastingPrompt /> : null}


      <View style={styles.section}>
        <Text variant="h3">{t('home.dashboardStats')}</Text>

        <View style={styles.statsRow}>
          <StatsCard
            icon="people-outline"
            title={t('home.totalGroups')}
            value={totalGroups}
            tone="primary"
            loading={loading}
          />
          <StatsCard
            icon="person-add-outline"
            title={t('home.totalMembers')}
            value={totalMembers}
            tone="accent"
            loading={loading}
          />
        </View>

        <StatsCard
          icon="ribbon-outline"
          title={t('home.fastingDays')}
          value={totalFastingDays}
          tone="secondary"
          loading={loading}
        />
      </View>

      <Card>
        <View style={styles.cardHeader}>
          <IconTile icon="analytics-outline" tone="primary" size={38} />
          <View style={styles.cardHeaderText}>
            <Text variant="h3">{t('home.fastingHistory')}</Text>
            <Text variant="caption" tone="secondary">
              {t('home.consistencySub')}
            </Text>
          </View>
        </View>

        <View style={styles.weekRow}>
          {weeklyFasting.map((fasted, index) => {
            const daysAgo = 6 - index;
            return (
              <View key={index} style={styles.dayCol}>
                <Text variant="caption" tone="secondary">
                  {getDayLetter(daysAgo)}
                </Text>
                <View
                  style={[
                    styles.dayMark,
                    fasted
                      ? {
                        backgroundColor: alpha(colors.accent, 0.12),
                        borderColor: alpha(colors.accent, 0.3),
                      }
                      : {
                        backgroundColor: colors.surfaceVariant,
                        borderColor: colors.border,
                      },
                  ]}
                >
                  <Ionicons
                    name={fasted ? 'checkmark-sharp' : 'remove'}
                    size={14}
                    color={fasted ? colors.accent : colors.muted}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.legend, { borderTopColor: colors.border }]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
            <Text variant="caption" tone="secondary">
              {t('home.legendFasted')}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.borderStrong }]} />
            <Text variant="caption" tone="secondary">
              {t('home.legendSkipped')}
            </Text>
          </View>
        </View>
      </Card>

      <ProfileSidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
      />

      {/* ── Uncancellable Update Modal ── */}
      <Modal
        visible={showUpdateModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {/* intentionally uncancellable */}}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 28, width: '100%', maxWidth: 340, alignItems: 'center' }}>
            {/* Icon */}
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: alpha(colors.primary, 0.1), alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Ionicons name="arrow-up-circle" size={40} color={colors.primary} />
            </View>

            <Text variant="h2" style={{ textAlign: 'center', marginBottom: 10 }}>
              Update Available
            </Text>
            <Text variant="body" tone="secondary" style={{ textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
              A new version of Suhoor is available. Download the latest version to continue using the app.
            </Text>

            <TouchableOpacity
              onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.mechseiko.suhoor')}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 16,
                paddingHorizontal: 32,
                width: '100%',
                alignItems: 'center',
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="logo-google-playstore" size={20} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Update on Play Store</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PIN Setup Modal */}
      <Modal
        visible={showPinModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPinModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 320 }}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: alpha(colors.primary, 0.1), alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="lock-closed" size={28} color={colors.primary} />
              </View>
              <Text variant="h2" style={{ textAlign: 'center', marginBottom: 8 }}>Set Your Alarm PIN</Text>
              <Text variant="body" tone="secondary" style={{ textAlign: 'center', fontSize: 13 }}>
                Enter a 4-digit PIN to dismiss your Suhoor alarm. This ensures you're truly awake when stopping the alarm.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', columnGap: 12, marginBottom: 16 }}>
              {pinDigits.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={pinRefs[i]}
                  value={digit}
                  onChangeText={(val) => handlePinDigitChange(i, val)}
                  onKeyPress={(e) => handlePinKeyPress(i, e)}
                  keyboardType="number-pad"
                  maxLength={1}
                  secureTextEntry
                  style={{
                    width: 54,
                    height: 60,
                    textAlign: 'center',
                    fontSize: 24,
                    fontWeight: '800',
                    borderWidth: 2,
                    borderColor: digit ? colors.primary : colors.border,
                    borderRadius: 12,
                    backgroundColor: digit ? alpha(colors.primary, 0.08) : colors.surfaceVariant,
                    color: colors.text,
                  }}
                  autoFocus={i === 0}
                />
              ))}
            </View>

            {pinError ? (
              <Text style={{ color: colors.error, fontSize: 12, marginBottom: 12, textAlign: 'center' }}>{pinError}</Text>
            ) : null}

            <View style={{ flexDirection: 'row', columnGap: 12 }}>
              <Button
                title={t('common.cancel')}
                onPress={() => {
                  setShowPinModal(false);
                  setPinDigits(['', '', '', '']);
                  setPinError('');
                }}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title="Save PIN"
                onPress={() => handlePinVerify()}
                variant="secondary"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  greeting: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: spacing.md,
    rowGap: spacing.md,
    marginTop: spacing.md,
  },
  greetingText: {
    flex: 1,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
    marginBottom: spacing.sm,
  },
  logo: {
    width: 32,
    height: 32,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '600',
  },
  name: {
    marginTop: spacing.xxs,
  },
  section: {
    columnGap: spacing.md,
    rowGap: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    columnGap: spacing.md,
    rowGap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.md,
    marginBottom: spacing.lg,
  },
  cardHeaderText: {
    flex: 1,
    columnGap: spacing.xxs,
    rowGap: spacing.xxs,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinPromptCard: {
    marginBottom: spacing.md,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    alignItems: 'center',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
  },
  dayMark: {
    height: 34,
    width: 34,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    columnGap: spacing.base,
    rowGap: spacing.base,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    marginTop: spacing.base,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.xs,
    rowGap: spacing.xs,
  },
  legendDot: {
    height: 8,
    width: 8,
    borderRadius: radius.pill,
  },
});

export default HomeScreen;
