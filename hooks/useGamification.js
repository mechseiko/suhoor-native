import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import { db } from "../config/firebase";
import { presentNotification } from "../services/notifications";
import { useLanguage } from "../context/LanguageContext";
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
  milestoneAchievementId,
  milestoneAchievementDoc,
} from "../config/firestoreSchema";

const EMPTY_STATS = {
  points: 0,
  totalFastingDays: 0,
  earlyBirds: 0,
  membersBuzzed: 0,
  sunnahFasts: 0,
  knowledgeCount: 0,
  badges: [],
};

/**
 * A wake-up before 04:30 local time counts as an early bird.
 *
 * One predicate, used by both the stored counter and the displayed count, so
 * the number a user is shown and the number their badges are computed from can
 * never disagree.
 */
const isEarlyHour = (timestamp) => {
  if (!timestamp) return false;
  const when = new Date(timestamp);
  if (Number.isNaN(when.getTime())) return false;
  const hours = when.getHours();
  const minutes = when.getMinutes();
  return hours < 4 || (hours === 4 && minutes < 30);
};

export function useGamification() {
  const { currentUser, userProfile } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [wakeLogs, setWakeLogs] = useState([]);
  const [celebration, setCelebration] = useState(null);
  const [newBadgeAchievement, setNewBadgeAchievement] = useState(null);

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
            knowledgeCount: data.knowledge_count || 0,
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
        const knowledgeCount = stats.knowledgeCount || 0;
        const badgeSet = new Set(stats.badges);

        // Fasting days and early birds are DERIVED from the wake-up logs, not
        // incremented blind.
        //
        // A wake-up log is one document per user per day, so re-counting it is
        // idempotent: a repeated check-in cannot count twice, and a stale
        // listener snapshot cannot lose an increment (the old `counter + 1`
        // did both). max() keeps the stored counter as a floor, so a session
        // that cannot load logs — offline, or a failed query — never resets a
        // user's progress downwards.
        const logDates = new Set();
        let earlyFromLogs = 0;
        for (const log of wakeLogs) {
          if (log.date) logDates.add(log.date);
          if (isEarlyHour(log.woke_up_at)) earlyFromLogs += 1;
        }
        if (type === "wake_up") {
          // Today's log has just been written, so it is not in the snapshot yet.
          logDates.add(new Date().toLocaleDateString("en-CA"));
          if (payload.isEarlyBird) earlyFromLogs += 1;
        }
        totalFastingDays = Math.max(totalFastingDays, logDates.size);
        earlyBirds = Math.max(earlyBirds, earlyFromLogs);

        if (type === "buzz_member") {
          membersBuzzed += 1;
        } else if (type === "sunnah_fast") {
          sunnahFasts += 1;
        } else if (type === "read_resource") {
          // Knowledge points exist in the schema but nothing reads resources
          // yet; the counter is carried through below so a future caller does
          // not have its value silently reset to zero.
        }

        const calculated = calculateUserSPAndBadges({
          totalFastingDays,
          earlyBirds,
          membersBuzzed,
          sunnahFasts,
          knowledgeCount,
        });

        points = calculated.points;
        const allBadgesList = Array.from(new Set([...Array.from(badgeSet), ...calculated.badges]));

        // Track newly earned badges
        const newBadges = calculated.badges.filter(badgeId => !badgeSet.has(badgeId));

        // Record milestone achievements for each new badge
        for (const badgeId of newBadges) {
          let badgeInfo = null;
          let trackInfo = null;

          // Find badge info in BADGE_TRACKS
          for (const track of Object.values(BADGE_TRACKS)) {
            const level = track.levels.find(l => l.badgeId === badgeId);
            if (level) {
              badgeInfo = level;
              trackInfo = track;
              break;
            }
          }

          if (badgeInfo && trackInfo) {
            const achievementId = milestoneAchievementId(currentUser.uid, badgeId);
            const achievementDoc = milestoneAchievementDoc({
              userId: currentUser.uid,
              badgeId,
              badgeTitle: badgeInfo.title,
              // badgeCategory: badgeInfo.category,
              points: badgeInfo.points,
              // trackName: trackInfo.name,
              level: badgeInfo.level,
              trackIcon: trackInfo.icon,
              badgeCategory: trackInfo.category,
              trackName: trackInfo.title,
            });
            await setDoc(doc(db, COLLECTIONS.milestoneAchievements, achievementId), achievementDoc);

            // Trigger in-app notification for new badge
            setNewBadgeAchievement({
              badgeId,
              title: badgeInfo.title,
              category: badgeInfo.category,
              points: badgeInfo.points,
              trackName: trackInfo.name,
              level: badgeInfo.level,
              icon: trackInfo.icon,
            });

            // Show notification. Title and body are separate keys: the body
            // names the badge so the two lines never repeat each other.
            presentNotification({
              title: `${trackInfo.icon} ${t('milestones.newBadge')}`,
              message: t('milestones.badgeUnlocked', { title: badgeInfo.title }),
              data: { type: 'badge', badgeId },
            });
          }
        }

        const updated = gamificationDoc({
          userId: currentUser.uid,
          points,
          successfulWakeups: totalFastingDays,
          totalFastingDays,
          earlyBirds,
          membersBuzzed,
          sunnahFasts,
          knowledgeCount,
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
    [currentUser, stats, wakeLogs]
  );

  // 3. Dynamic Early Bird Calculation for existing logs
  const calculatedEarlyBirds = useCallback(
    () => wakeLogs.filter(log => isEarlyHour(log.woke_up_at)).length,
    [wakeLogs]
  );

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

  // The numbers the screen SHOWS and the numbers the badges are calculated from
  // must be the same numbers.
  //
  // Before, the counters were displayed from the wake-up logs while `badges`
  // came from the stored document, which was built from whatever counters it
  // had when it was last written — so the screen could happily show "12 days"
  // next to a 7-day badge that was still locked. Both sides now use this one
  // snapshot, and max() stops a failed log fetch from displaying zero.
  const displayedStats = {
    ...stats,
    totalFastingDays: Math.max(
      stats.totalFastingDays,
      new Set(wakeLogs.map(l => l.date)).size
    ),
    earlyBirds: Math.max(stats.earlyBirds, calculatedEarlyBirds()),
  };

  const unlockedFromDisplayed = calculateUserSPAndBadges({
    totalFastingDays: displayedStats.totalFastingDays,
    earlyBirds: displayedStats.earlyBirds,
    membersBuzzed: displayedStats.membersBuzzed,
    sunnahFasts: displayedStats.sunnahFasts,
    knowledgeCount: displayedStats.knowledgeCount,
  }).badges;

  // Union with what is already stored: a badge a user earned is never removed.
  const badges = Array.from(
    new Set([...(stats.badges || []), ...unlockedFromDisplayed])
  );

  return {
    stats: { ...displayedStats, badges },
    loading,
    currentLevel,
    nextTier,
    progressPercent,
    recordActivity,
    celebration,
    dismissCelebration: () => setCelebration(null),
    allBadges: Object.values(BADGES),
    badges,
    refreshStats: () => { },
  };
}

export default useGamification;