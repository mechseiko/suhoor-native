/**
 * useGamification — mirrors the web hook (src/hooks/useGamification.js).
 *
 * Uses the same BADGES, BARAKAH_TIERS and getBarakahLevel from
 * firestoreSchema.js so that levels, milestone names and point values are
 * identical across web and native. Both apps read / write the same Firestore
 * collection (gamification_stats/{uid}).
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import {
  COLLECTIONS,
  BADGES,
  BARAKAH_TIERS,
  getBarakahLevel,
  gamificationStatsId,
  gamificationDoc,
} from '../config/firestoreSchema';

const EMPTY_STATS = {
  points: 0,
  successfulWakeups: 0,
  totalFastingDays: 0,
  membersBuzzed: 0,
  sunnahFasts: 0,
  badges: [],
};

export function useGamification() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [wakeDates, setWakeDates] = useState([]);

  // Live-sync gamification stats from Firestore
  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const docRef = doc(
      db,
      COLLECTIONS.gamificationStats,
      gamificationStatsId(currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setStats({
            points: data.points || 0,
            successfulWakeups: data.successful_wakeups || 0,
            totalFastingDays: data.total_fasting_days || 0,
            membersBuzzed: data.members_buzzed || 0,
            sunnahFasts: data.sunnah_fasts || 0,
            badges: data.badges || [],
          });
        } else {
          const initial = gamificationDoc({ userId: currentUser.uid });
          setDoc(docRef, initial).catch(console.error);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Gamification stats offline fallback:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Derive totalFastingDays from wake_up_logs (same source as web)
  useEffect(() => {
    if (!currentUser?.uid) {
      setWakeDates([]);
      return;
    }

    let cancelled = false;

    const fetchWakeDates = async () => {
      try {
        const logsQuery = query(
          collection(db, COLLECTIONS.wakeUpLogs),
          where('user_id', '==', currentUser.uid)
        );
        const snap = await getDocs(logsQuery);
        if (cancelled) return;
        const dates = snap.docs.map(d => d.data().date).filter(Boolean);
        setWakeDates(dates);
      } catch (err) {
        console.warn('Could not fetch wake dates:', err);
      }
    };

    fetchWakeDates();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const recordActivity = useCallback(
    async (type, payload = {}) => {
      if (!currentUser?.uid) return;

      try {
        const docRef = doc(
          db,
          COLLECTIONS.gamificationStats,
          gamificationStatsId(currentUser.uid)
        );

        // Read current totals from the snapshot state (already synced)
        let points = stats.points;
        let successfulWakeups = stats.successfulWakeups;
        let totalFastingDays = stats.totalFastingDays;
        let membersBuzzed = stats.membersBuzzed;
        let sunnahFasts = stats.sunnahFasts;
        const badgeSet = new Set(stats.badges);

        if (type === 'wake_up') {
          successfulWakeups += 1;
          totalFastingDays = wakeDates.length + 1;
          points += 20;

          badgeSet.add(BADGES.FIRST_SUHOOR.id);
          if (totalFastingDays >= 3) badgeSet.add(BADGES.DAYS_3.id);
          if (totalFastingDays >= 7) badgeSet.add(BADGES.DAYS_7.id);
          if (totalFastingDays >= 14) badgeSet.add(BADGES.DAYS_14.id);
          if (totalFastingDays >= 30) badgeSet.add(BADGES.DAYS_30.id);

          if (payload.minutesBeforeFajr && payload.minutesBeforeFajr >= 40) {
            badgeSet.add(BADGES.EARLY_BIRD.id);
            points += BADGES.EARLY_BIRD.points;
          }
        } else if (type === 'buzz_member') {
          membersBuzzed += 1;
          points += 15;
          if (membersBuzzed >= 5) {
            badgeSet.add(BADGES.GROUP_GUARDIAN.id);
            points += BADGES.GROUP_GUARDIAN.points;
          }
        } else if (type === 'sunnah_fast') {
          sunnahFasts += 1;
          points += 25;
          if (sunnahFasts >= 8) {
            badgeSet.add(BADGES.SUNNAH_DEVOTEE.id);
            points += BADGES.SUNNAH_DEVOTEE.points;
          }
        } else if (type === 'read_resource') {
          points += 10;
          badgeSet.add(BADGES.KNOWLEDGE_SEEKER.id);
        }

        const updated = gamificationDoc({
          userId: currentUser.uid,
          points,
          successfulWakeups,
          totalFastingDays,
          membersBuzzed,
          sunnahFasts,
          badges: Array.from(badgeSet),
        });

        await setDoc(docRef, updated, { merge: true });
      } catch (err) {
        console.error('Error recording gamification activity:', err);
      }
    },
    [currentUser, stats, wakeDates]
  );

  const currentLevel = getBarakahLevel(stats.points);
  const statsWithTotalDays = { ...stats, totalFastingDays: wakeDates.length };
  const nextTier = BARAKAH_TIERS.find(t => t.level === currentLevel.level + 1);
  const progressPercent = nextTier
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((stats.points - currentLevel.minPoints) /
              (nextTier.minPoints - currentLevel.minPoints)) *
              100
          )
        )
      )
    : 100;

  return {
    stats: statsWithTotalDays,
    loading,
    currentLevel,
    nextTier,
    progressPercent,
    recordActivity,
    allBadges: Object.values(BADGES),
    // Legacy-compat exports (for any screens still using old API)
    badges: stats.badges,
    refreshStats: () => {},
  };
}

export default useGamification;
