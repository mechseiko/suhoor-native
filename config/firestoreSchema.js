/**
 * Firestore conventions shared by the web app and the mobile app (suhoor-native).
 *
 * Both apps read and write the SAME Firestore project, so any drift in a
 * collection name, document-ID scheme, or field name silently splits the data:
 * one app writes a record the other cannot find. This module is the single
 * source of truth for those three things.
 *
 * This file has a twin that must stay byte-for-byte identical:
 *   src/config/firestoreSchema.js            (web)
 *   suhoor-native/config/firestoreSchema.js  (mobile)
 * Change one, copy it over the other, and verify with:
 *   diff src/config/firestoreSchema.js suhoor-native/config/firestoreSchema.js
 */

/** Every collection either app touches. Use these instead of inline strings. */
export const COLLECTIONS = {
  profiles: 'profiles',
  groups: 'groups',
  groupMembers: 'group_members',
  groupInvites: 'group_invites',
  wakeUpLogs: 'wake_up_logs',
  missedWakeUps: 'missed_wake_ups',
  dailyFastingStatus: 'daily_fasting_status',
  userAlarms: 'user_alarms',
  fastingStats: 'fasting_stats',
  groupStats: 'group_stats',
  emailVerifications: 'email_verifications',
  passwordResets: 'password_resets',
  groupMessages: 'group_messages',
  groupExclusions: 'group_exclusions',
  gamificationStats: 'gamification_stats',
  groupBuzzes: 'group_buzzes',
  notifications: 'notifications',
}

/** Subcollection of `groups`: groups/{groupId}/locations/{userId}. */
export const SUBCOLLECTIONS = {
  groupLocations: 'locations',
}

/**
 * App-wide date key: the user's LOCAL calendar date as YYYY-MM-DD.
 * `en-CA` yields YYYY-MM-DD, which sorts lexicographically and matches the
 * `date` field stored on wake_up_logs, daily_fasting_status and missed_wake_ups.
 * Never use toISOString().slice(0,10) here — that is UTC and shifts the day
 * for users east/west of UTC precisely during the pre-dawn suhoor window.
 */
export const dateKey = (date = new Date()) => date.toLocaleDateString('en-CA')

/**
 * Deterministic document IDs. These make writes idempotent: a repeated
 * check-in or a re-submitted intention overwrites one document instead of
 * appending a duplicate. They also let the security rules verify ownership
 * from the ID alone (see firestore.rules).
 */

/** daily_fasting_status/{uid}_{YYYY-MM-DD} */
export const fastingStatusId = (userId, date = dateKey()) => `${userId}_${date}`

/**
 * wake_up_logs/{uid}_{YYYY-MM-DD}
 *
 * Deliberately NOT keyed by group. Per the product spec a check-in applies
 * across every group the user belongs to ("no one is able to wake user again
 * for that day"), and both apps read these logs globally by `date`. Including
 * groupId here would create one document per group for the same wake-up and
 * inflate every activity count.
 */
export const wakeUpLogId = (userId, date = dateKey()) => `${userId}_${date}`

/** missed_wake_ups/{uid}_{groupId}_{YYYY-MM-DD} — evaluated per group. */
export const missedWakeUpId = (userId, groupId, date = dateKey()) =>
  `${userId}_${groupId}_${date}`

/** fasting_stats/{uid} */
export const fastingStatsId = (userId) => userId

/** gamification_stats/{uid} */
export const gamificationStatsId = (userId) => userId

/** group_stats/{groupId}_{start}_{end} */
export const groupStatsId = (groupId, startDate, endDate) =>
  `${groupId}_${startDate}_${endDate}`

/** group_exclusions/{groupId}_{userId} */
export const groupExclusionId = (groupId, userId) => `${groupId}_${userId}`

/** Canonical group_exclusions body */
export const groupExclusionDoc = ({ groupId, userId, reason = 'left', byUserId = null }) => ({
  group_id: groupId,
  user_id: userId,
  reason, // 'left' | 'removed'
  by_user_id: byUserId,
  created_at: new Date().toISOString(),
})

/** Canonical group_messages body */
export const groupMessageDoc = ({
  groupId,
  userId,
  senderName,
  senderEmail,
  text,
  type = 'text',
}) => ({
  group_id: groupId,
  user_id: userId,
  sender_name: senderName || (senderEmail ? senderEmail.split('@')[0] : 'Member'),
  sender_email: senderEmail || '',
  text: text ? text.trim() : '',
  type, // 'text' | 'quick' | 'system'
  created_at_iso: new Date().toISOString(),
})

/**
 * `woke_up_at` is stored as an ISO 8601 STRING, not a Firestore Timestamp.
 * Readers in both apps do `new Date(log.woke_up_at)` and compare it against
 * the ISO string carried on the socket `member-woke-up` payload, so a
 * Timestamp object breaks both the comparison and the rendering.
 * This normalizes any legacy Timestamp rows already in the database.
 */
export const toIsoTime = (value) => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString()
  }
  return null
}

/**
 * Canonical wake_up_logs document body.
 * `group_id` records which group the user checked in from (useful for
 * analytics) but is not part of the document identity.
 */
export const wakeUpLogDoc = ({ userId, groupId = null, wokeUpAt = new Date() }) => ({
  user_id: userId,
  group_id: groupId,
  date: dateKey(wokeUpAt instanceof Date ? wokeUpAt : new Date()),
  woke_up_at: toIsoTime(wokeUpAt) ?? new Date().toISOString(),
})

/** Canonical missed_wake_ups body — snake_case, matching its sibling collections. */
export const missedWakeUpDoc = ({ userId, groupId, reason = 'did_not_wake_up' }) => ({
  user_id: userId,
  group_id: groupId,
  date: dateKey(),
  missed_at: new Date().toISOString(),
  reason,
})

/** Default fasting preferences applied to a brand-new profile. */
export const DEFAULT_FASTING_DEFAULTS = {
  sunnah: true,
  whiteDays: true,
  ramadan: true,
}

export const DEFAULT_PREFERENCES = {
  soundEnabled: true,
  defaultLocation: null, // { lat: number, lng: number, name: string }
}

/**
 * Canonical profiles/{uid} body for a newly created account.
 * Both apps must write the same shape or the Settings screen has no
 * fastingDefaults to toggle and getDefaultIntention silently falls back.
 */
export const newProfileDoc = ({ uid, email, displayName }) => ({
  uid,
  email,
  display_name: displayName || (email ? email.split('@')[0] : ''),
  isVerified: false,
  createdAt: new Date().toISOString(),
  fastingDefaults: { ...DEFAULT_FASTING_DEFAULTS },
  preferences: { ...DEFAULT_PREFERENCES },
})

/**
 * Reads a profile's creation time regardless of which app wrote it.
 * Older web rows used snake_case `created_at`; native has always used
 * `createdAt`. New writes use `createdAt`.
 */
export const profileCreatedAt = (profile) =>
  toIsoTime(profile?.createdAt ?? profile?.created_at)

/**
 * Gamification & Barakah Milestones System.
 */
export const BADGES = {
  FIRST_SUHOOR: {
    id: 'first_suhoor',
    title: 'Dawn Seeker',
    titleArabic: 'طالب الفجر',
    description: 'Completed your first recorded Suhoor wake-up check-in',
    icon: '🌅',
    category: 'milestone',
    points: 50,
  },
  DAYS_3: {
    id: 'days_3',
    title: 'Consistent Riser',
    titleArabic: 'المستقيم',
    description: 'Completed 3 total fasting days',
    icon: '🔥',
    category: 'milestone',
    points: 100,
  },
  DAYS_7: {
    id: 'days_7',
    title: 'Week Warrior',
    titleArabic: 'بطل الأسبوع',
    description: 'Completed 7 total fasting days',
    icon: '⚡',
    category: 'milestone',
    points: 250,
  },
  DAYS_14: {
    id: 'days_14',
    title: 'White Moon Luminary',
    titleArabic: 'منير البدر',
    description: 'Completed 14 total fasting days',
    icon: '🌕',
    category: 'milestone',
    points: 500,
  },
  DAYS_30: {
    id: 'days_30',
    title: 'Ramadan Champion',
    titleArabic: 'سيد رمضان',
    description: 'Completed 30 total fasting days',
    icon: '👑',
    category: 'milestone',
    points: 1000,
  },
  EARLY_BIRD: {
    id: 'early_bird',
    title: 'Fajr Vanguard',
    titleArabic: 'طليعة الفجر',
    description: 'Checked in more than 40 minutes before Fajr',
    icon: '🦅',
    category: 'punctuality',
    points: 75,
  },
  GROUP_GUARDIAN: {
    id: 'group_guardian',
    title: 'Wake-Up Angel',
    titleArabic: 'حارس الإخوان',
    description: 'Successfully buzzed and woke up 5 sleeping group members',
    icon: '🔔',
    category: 'community',
    points: 150,
  },
  SUNNAH_DEVOTEE: {
    id: 'sunnah_devotee',
    title: 'Sunnah Champion',
    titleArabic: 'محيي السنة',
    description: 'Recorded 8 voluntary Sunnah fasts (Mon/Thu or White Days)',
    icon: '🌿',
    category: 'sunnah',
    points: 200,
  },
  KNOWLEDGE_SEEKER: {
    id: 'knowledge_seeker',
    title: 'Seeker of Ilm',
    titleArabic: 'طالب العلم',
    description: 'Explored fasting treatises and recited Du\'as in the library',
    icon: '📖',
    category: 'knowledge',
    points: 100,
  },
}

export const BARAKAH_TIERS = [
  { level: 1, name: 'Barakah Seeker', minPoints: 0, icon: '🌱' },
  { level: 2, name: 'Steadfast Riser', minPoints: 100, icon: '🌿' },
  { level: 3, name: 'Suhoor Guardian', minPoints: 300, icon: '⭐' },
  { level: 4, name: 'Fajr Vanguard', minPoints: 700, icon: '🌙' },
  { level: 5, name: 'Barakah Master', minPoints: 1500, icon: '👑' },
]

export const getBarakahLevel = (points = 0) => {
  let currentTier = BARAKAH_TIERS[0]
  for (const tier of BARAKAH_TIERS) {
    if (points >= tier.minPoints) {
      currentTier = tier
    } else {
      break
    }
  }
  return currentTier
}

/** Canonical gamification_stats document body */
export const gamificationDoc = ({
  userId,
  points = 0,
  successfulWakeups = 0,
  currentStreak = 0,
  bestStreak = 0,
  membersBuzzed = 0,
  sunnahFasts = 0,
  badges = [],
}) => ({
  user_id: userId,
  points: Number(points) || 0,
  successful_wakeups: Number(successfulWakeups) || 0,
  current_streak: Number(currentStreak) || 0,
  best_streak: Number(bestStreak) || 0,
  members_buzzed: Number(membersBuzzed) || 0,
  sunnah_fasts: Number(sunnahFasts) || 0,
  badges: Array.isArray(badges) ? badges : [],
  updated_at: new Date().toISOString(),
})
