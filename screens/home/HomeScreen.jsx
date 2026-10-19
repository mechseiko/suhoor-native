import { FlatList, Image, Modal, RefreshControl, StyleSheet, TouchableOpacity, View, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/firestoreSchema';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import FastingPrompt from '../../components/FastingPrompt';
import AudioModeWarning from '../../components/AudioModeWarning';
import StatsCard from '../../components/StatsCard';
import ProfileSidebar from '../../components/ProfileSidebar';
import UpdateModal from '../../components/UpdateModal';
import { checkAppUpdate } from '../../services/versionService';
import { presentNotification } from '../../services/notifications';
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
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastSeenNotifications, setLastSeenNotifications] = useState(0);
  
  // PIN setup modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const pinRefs = [useRef(), useRef(), useRef(), useRef()];

  // App Update Modal state
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState({
    isAvailable: false,
    currentVersion: '',
    latestVersion: '',
    playStoreUrl: '',
  });

  useEffect(() => {
    let isMounted = true;
    const verifyAppUpdate = async () => {
      try {
        const res = await checkAppUpdate();
        if (!isMounted) return;
        if (res?.isAvailable) {
          setUpdateInfo(res);
          const lastDismissed = await AsyncStorage.getItem('suhoor_update_dismissed_time');
          const now = Date.now();
          // If never dismissed, or dismissed > 24 hours ago, prompt user
          if (!lastDismissed || now - Number(lastDismissed) > 24 * 60 * 60 * 1000) {
            setShowUpdateModal(true);
          }
        }
      } catch (err) {
        console.log('[HomeScreen] Version verification notice:', err);
      }
    };
    verifyAppUpdate();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismissUpdate = async () => {
    setShowUpdateModal(false);
    try {
      await AsyncStorage.setItem('suhoor_update_dismissed_time', String(Date.now()));
    } catch (e) {}
  };

  // Notifications listener (Goal 14)
  useEffect(() => {
    let lastSeen = 0;
    AsyncStorage.getItem('suhoor_notifications_last_seen').then(val => {
      if (val) {
        lastSeen = Number(val);
        setLastSeenNotifications(lastSeen);
      }
    });

    let isFirst = true;
    const q = query(collection(db, 'notifications'), orderBy('created_at', 'desc'), limit(20));
    const unsub = onSnapshot(q, async snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setNotifications(list);

      if (!isFirst) {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            presentNotification({
              title: `${data.emoji || '🌙'} ${data.title}`,
              message: data.message || '',
              data: { id: change.doc.id, type: 'broadcast' }
            });
          }
        });
      } else {
        try {
          const storedLastSeen = await AsyncStorage.getItem('suhoor_notifications_last_seen');
          const effectiveLastSeen = storedLastSeen ? Number(storedLastSeen) : lastSeen;
          if (effectiveLastSeen > 0) {
            const now = Date.now();
            const ONE_DAY_MS = 24 * 60 * 60 * 1000;
            const newUnseen = list.find(n => {
              const t = n.created_at?.toMillis ? n.created_at.toMillis() : (n.created_at?.seconds ? n.created_at.seconds * 1000 : 0);
              return t > effectiveLastSeen && (now - t) < ONE_DAY_MS;
            });
            if (newUnseen) {
              presentNotification({
                title: `${newUnseen.emoji || '🌙'} ${newUnseen.title}`,
                message: newUnseen.message || '',
                data: { id: newUnseen.id, type: 'broadcast' }
              });
            }
          }
        } catch (_) {}
      }
      isFirst = false;
    }, err => console.log('Error fetching notifications:', err));

    return () => unsub();
  }, []);

  const unreadNotificationsCount = notifications.filter(n => {
    const t = n.created_at?.toMillis ? n.created_at.toMillis() : (n.created_at?.seconds ? n.created_at.seconds * 1000 : 0);
    return t > lastSeenNotifications;
  }).length;

  const handleOpenNotifications = () => {
    setShowNotifications(true);
    const now = Date.now();
    setLastSeenNotifications(now);
    AsyncStorage.setItem('suhoor_notifications_last_seen', String(now));
  };

  // Stats
  const [totalGroups, setTotalGroups] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalFastingDays, setTotalFastingDays] = useState(0);
  const [loading, setLoading] = useState(true);

  // Calendar history (for visual styling)
  const [weeklyFasting, setWeeklyFasting] = useState([false, false, false, false, false, false, false]);

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
      // Count distinct days, not documents: legacy logs were added with random
      // IDs, so the same day could hold several docs and inflate the stat.
      const distinctFastingDays = new Set(
        wakeUpSnap.docs
          .map((logDoc) => logDoc.data().date)
          .filter(Boolean)
      );
      setTotalFastingDays(distinctFastingDays.size);
      console.log('[HomeScreen] Total fasting days:', distinctFastingDays.size);

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
      setPinError(t('home.pinError'));
      return;
    }

    try {
      // Save PIN to AsyncStorage (matching onboarding flow)...
      await AsyncStorage.setItem('suhoor_alarm_pin', entered);

      // ...and to the Firestore profile, same as ProfileScreen.saveAlarmPin.
      // The "Set Your Alarm PIN" card keys off userProfile.pin, so without
      // this write the card could never be dismissed.
      if (currentUser) {
        await updateDoc(doc(db, COLLECTIONS.profiles, currentUser.uid), {
          pin: entered,
        });
      }

      setPinError('');
      setShowPinModal(false);
      setPinDigits(['', '', '', '']);
    } catch (err) {
      console.error('Error saving PIN:', err);
      setPinError(t('home.pinSaveError'));
    }
  };

  const displayName =
    userProfile?.display_name ||
    currentUser?.displayName ||
    currentUser?.email?.split('@')[0];

  const avatarUrl =
    userProfile?.avatar_url ||
    userProfile?.photoURL ||
    currentUser?.photoURL;

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Bell Icon button (Goal 14) */}
            <TouchableOpacity
              onPress={handleOpenNotifications}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('settings.notifications')}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: colors.surfaceVariant || '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              {unreadNotificationsCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.primary,
                  }}
                />
              )}
            </TouchableOpacity>

            {/* Profile Avatar */}
            <TouchableOpacity
              onPress={() => setSidebarVisible(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.openProfileSidebar')}
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
                overflow: 'hidden',
              }}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{ width: 38, height: 38, borderRadius: 19 }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>
                  {(displayName || 'U').charAt(0).toUpperCase()}
                </Text>
              )}
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
              <Text variant="h3" style={{ color: colors.warning }}>{t('home.pinPromptTitle')}</Text>
              <Text variant="caption" tone="secondary">
                {t('home.pinPromptDesc')}
              </Text>
            </View>
          </View>
          <Button
            title={t('home.pinPromptButton')}
            onPress={() => {
              setShowPinModal(true);
              setTimeout(() => pinRefs[0]?.current?.focus(), 200);
            }}
            variant="secondary"
            style={{ borderRadius: 8 }}
          />
        </Card>
      ) : <FastingPrompt />}

      <AudioModeWarning />

      {/* Sound Disabled Disclaimer Card */}
      {userProfile?.preferences?.soundEnabled === false && (
        <Card style={[styles.pinPromptCard, { borderColor: '#EF4444', borderWidth: 1.5, backgroundColor: alpha('#EF4444', 0.05) }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: alpha('#EF4444', 0.12) }]}>
              <Ionicons name="volume-mute" size={20} color="#EF4444" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text variant="h3" style={{ color: '#EF4444' }}>{t('home.audioOffTitle')}</Text>
              <Text variant="caption" tone="secondary">
                {t('home.audioOffDesc')}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button
              title={t('home.turnOnSound')}
              onPress={async () => {
                if (currentUser?.uid) {
                  try {
                    await updateDoc(doc(db, COLLECTIONS.profiles, currentUser.uid), {
                      'preferences.soundEnabled': true,
                    });
                  } catch (err) {
                    console.error('Failed to enable sound:', err);
                  }
                }
              }}
              variant="primary"
              style={{ flex: 1, borderRadius: 8 }}
            />
            <Button
              title={t('home.settings')}
              onPress={() => navigation.navigate('ProfileTab')}
              variant="secondary"
              style={{ borderRadius: 8, paddingHorizontal: 16 }}
            />
          </View>
        </Card>
      )}

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
              <Text variant="h2" style={{ textAlign: 'center', marginBottom: 8 }}>{t('home.pinModalTitle')}</Text>
              <Text variant="body" tone="secondary" style={{ textAlign: 'center', fontSize: 13 }}>
                {t('home.pinModalDesc')}
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

      {/* Notifications Modal (Goal 14) */}
      <Modal
        visible={showNotifications}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.surface || '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '80%',
              paddingBottom: 28,
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 18,
                borderBottomWidth: 1,
                borderBottomColor: colors.border || '#F3F4F6',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="notifications" size={20} color={colors.primary} />
                <Text variant="h2">{t('home.notifications')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowNotifications(false)}
                hitSlop={10}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.surfaceVariant || '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Notifications List */}
            {notifications.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="notifications-outline" size={48} color={colors.muted || '#9CA3AF'} />
                <Text variant="h3" style={{ marginTop: 12 }}>{t('home.noNotifications')}</Text>
                <Text variant="caption" tone="secondary" style={{ marginTop: 4, textAlign: 'center' }}>
                  {t('home.allCaughtUp')}
                </Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
                renderItem={({ item }) => (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      columnGap: 12,
                    rowGap: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      backgroundColor: colors.surfaceVariant || '#F9FAFB',
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: colors.border || '#E5E7EB',
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{item.emoji || '🌙'}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text variant="h3" style={{ fontSize: 14 }}>{item.title}</Text>
                        {item.category && (
                          <View
                            style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 6,
                              backgroundColor: alpha(colors.primary, 0.08),
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>
                              {item.category}
                            </Text>
                          </View>
                        )}
                      </View>
                      {item.message ? (
                        <Text variant="body" tone="secondary" style={{ fontSize: 12, lineHeight: 16 }}>
                          {item.message}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* App Update Modal */}
      <UpdateModal
        visible={showUpdateModal}
        currentVersion={updateInfo.currentVersion}
        latestVersion={updateInfo.latestVersion}
        playStoreUrl={updateInfo.playStoreUrl}
        onClose={handleDismissUpdate}
      />
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
