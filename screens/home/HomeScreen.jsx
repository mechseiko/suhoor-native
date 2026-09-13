import { FlatList, Image, Modal, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import FastingPrompt from '../../components/FastingPrompt';
import StatsCard from '../../components/StatsCard';
import ProfileSidebar from '../../components/ProfileSidebar';
import { Badge, Button, Card, IconTile, Screen, Text } from '../../components/ui';
import { alpha, brand, radius, spacing } from '../../theme';
import { useState, useEffect } from 'react';

export const HomeScreen = ({ navigation }) => {
  const { currentUser, userProfile } = useAuth();
  const { colors } = useTheme();
  const { t, formatDate } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastSeenNotifications, setLastSeenNotifications] = useState(0);

  // Notifications listener (Goal 14)
  useEffect(() => {
    AsyncStorage.getItem('suhoor_notifications_last_seen').then(val => {
      if (val) setLastSeenNotifications(Number(val));
    });

    const q = query(collection(db, 'notifications'), orderBy('created_at', 'desc'), limit(20));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setNotifications(list);
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

      // 3. Fetch total fasting days this year
      const fastingRef = collection(db, 'daily_fasting_status');
      const fastingQuery = query(
        fastingRef,
        where('userId', '==', currentUser.uid),
        where('wantsToFast', '==', true)
      );
      const fastingSnap = await getDocs(fastingQuery);
      setTotalFastingDays(fastingSnap.size);
      console.log('[HomeScreen] Total fasting days:', fastingSnap.size);

      // 4. Determine fasting status for last 7 days for a nice visual widget
      const last7DaysStatus = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toLocaleDateString('en-CA');
        const dayStatusQuery = query(
          fastingRef,
          where('userId', '==', currentUser.uid),
          where('date', '==', dateStr)
        );
        const daySnap = await getDocs(dayStatusQuery);
        let fasted = false;
        daySnap.forEach((doc) => {
          if (doc.data().wantsToFast) fasted = true;
        });
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
  }, [currentUser]);

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

  const displayName =
    userProfile?.display_name ||
    currentUser?.displayName ||
    currentUser?.email?.split('@')[0];

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
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
              accessibilityLabel="Notifications"
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

          {/* <Badge
            label={formatDate(new Date(), { month: 'short', day: 'numeric' })}
            icon="calendar-outline"
            bordered
            pill={false}
          /> */}
        </View>
      </View>

      <Text variant="body" tone="secondary">
        {t('home.blessing')}
      </Text>

      <FastingPrompt />

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
                <Text variant="h2">Notifications</Text>
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
                <Text variant="h3" style={{ marginTop: 12 }}>No notifications yet</Text>
                <Text variant="caption" tone="secondary" style={{ marginTop: 4, textAlign: 'center' }}>
                  You are all caught up on everything.
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
