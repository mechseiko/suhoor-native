import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import { db } from "../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  COLLECTIONS,
  BADGES,
  BADGE_TRACKS,
  BARAKAH_TIERS,
  getBarakahLevel,
  calculateUserSPAndBadges,
  gamificationStatsId,
  gamificationDoc,
} from "../config/firestoreSchema";

const EMPTY_STATS = {
  points: 0,
  totalFastingDays: 0,
  earlyBirds: 0,
  membersBuzzed: 0,
  sunnahFasts: 0,
  badges: [],
};

export function useGamification() {
  const { currentUser, userProfile } = useAuth();
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [wakeLogs, setWakeLogs] = useState([]);
  const [celebration, setCelebration] = useState(null);

  // 1. Live-sync stats from Firestore
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
            totalFastingDays: data.total_fasting_days || 0,
            earlyBirds: data.early_birds || 0,
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
        console.warn("Gamification stats offline fallback:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // 2. Fetch wake logs to calculate Fasting Days and Early Birds
  useEffect(() => {
    if (!currentUser?.uid) {
      setWakeLogs([]);
      return;
    }

    let cancelled = false;

    const fetchWakeLogs = async () => {
      try {
        const logsQuery = query(
          collection(db, COLLECTIONS.wakeUpLogs),
          where("user_id", "==", currentUser.uid)
        );
        const snap = await getDocs(logsQuery);
        if (cancelled) return;
        
        const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setWakeLogs(logs);
      } catch (err) {
        console.warn("Could not fetch wake logs:", err);
      }
    };

    fetchWakeLogs();
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

        let points = stats.points;
        let totalFastingDays = stats.totalFastingDays;
        let earlyBirds = stats.earlyBirds;
        let membersBuzzed = stats.membersBuzzed;
        let sunnahFasts = stats.sunnahFasts;
        const badgeSet = new Set(stats.badges);

        if (type === "wake_up") {
          totalFastingDays += 1;
          if (payload.isEarlyBird) {
            earlyBirds += 1;
          }
        } else if (type === "buzz_member") {
          membersBuzzed += 1;
        } else if (type === "sunnah_fast") {
          sunnahFasts += 1;
        } else if (type === "read_resource") {
          // resource read
        }

        const calculated = calculateUserSPAndBadges({
          totalFastingDays,
          earlyBirds,
          membersBuzzed,
          sunnahFasts,
        });

        points = calculated.points;
        const allBadgesList = Array.from(new Set([...Array.from(badgeSet), ...calculated.badges]));

        const updated = gamificationDoc({
          userId: currentUser.uid,
          points,
          successfulWakeups: totalFastingDays,
          totalFastingDays,
          earlyBirds,
          membersBuzzed,
          sunnahFasts,
          badges: allBadgesList,
        });

        await setDoc(docRef, updated, { merge: true });

        const previousLevel = getBarakahLevel(stats.points);
        const updatedLevel = getBarakahLevel(points);
        if (updatedLevel.level > previousLevel.level) {
          const storageKey = `suhoor_last_celebrated_level_${currentUser.uid}`;
          const lastCelebratedLevel = await AsyncStorage.getItem(storageKey);
          if (lastCelebratedLevel !== String(updatedLevel.level)) {
            await AsyncStorage.setItem(storageKey, String(updatedLevel.level));
            setCelebration({
              level: updatedLevel.level,
              name: updatedLevel.name,
              points,
            });
          }
        }
      } catch (err) {
        console.error("Error recording gamification activity:", err);
      }
    },
    [currentUser, stats]
  );

  // 3. Dynamic Early Bird Calculation for existing logs
  const calculatedEarlyBirds = useCallback(() => {
    let count = 0;
    wakeLogs.forEach(log => {
      if (!log.woke_up_at) return;
      const wokeUpDate = new Date(log.woke_up_at);
      const wokeUpHour = wokeUpDate.getHours();
      const wokeUpMinute = wokeUpDate.getMinutes();
      
      // If they woke up before 4:30 AM, consider it an Early Bird
      if (wokeUpHour < 4 || (wokeUpHour === 4 && wokeUpMinute < 30)) {
        count++;
      }
    });
    return count;
  }, [wakeLogs]);

  const currentLevel = getBarakahLevel(stats.points);
  const nextTier = BARAKAH_TIERS.find(
    (t) => t.level === currentLevel.level + 1
  );
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
    stats: {
      ...stats,
      totalFastingDays: new Set(wakeLogs.map(l => l.date)).size,
      earlyBirds: calculatedEarlyBirds(), // Override with exact calculation
    },
    loading,
    currentLevel,
    nextTier,
    progressPercent,
    recordActivity,
    celebration,
    dismissCelebration: () => setCelebration(null),
    allBadges: Object.values(BADGES),
    badges: stats.badges,
    refreshStats: () => {},
  };
}

export default useGamification;