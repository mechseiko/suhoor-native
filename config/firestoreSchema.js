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
  /** Append-only buzz log: one document per buzz. `group_buzzes` stays as the
   *  last-buzz-per-(group,member) record used for the cooldown. */
  buzzEvents: 'buzz_events',
  notifications: 'notifications',
  milestoneAchievements: 'milestone_achievements',
}

/** Subcollection of `groups`: groups/{groupId}/locations/{userId}. */
export const SUBCOLLECTIONS = {
  groupLocations: 'locations',
}

/**
 * App-wide date key: the user's LOCAL calendar date as YYYY-MM-DD.
 */
export const dateKey = (date = new Date()) => date.toLocaleDateString('en-CA')

/** daily_fasting_status/{uid}_{YYYY-MM-DD} */
export const fastingStatusId = (userId, date = dateKey()) => `${userId}_${date}`

/** wake_up_logs/{uid}_{YYYY-MM-DD} */
export const wakeUpLogId = (userId, date = dateKey()) => `${userId}_${date}`

/** missed_wake_ups/{uid}_{groupId}_{YYYY-MM-DD} */
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

/** milestone_achievements/{uid}_{badgeId}_{timestamp} */
export const milestoneAchievementId = (userId, badgeId, timestamp = Date.now()) =>
  `${userId}_${badgeId}_${timestamp}`

export const milestoneAchievementDoc = ({
  userId,
  badgeId,
  badgeTitle,
  badgeCategory,
  points,
  trackName,
  level,
  trackIcon,
}) => ({
  user_id: userId,
  badge_id: badgeId,
  badge_title: badgeTitle,
  badge_category: badgeCategory,
  points_earned: points,
  track_name: trackName,
  level,
  track_icon: trackIcon,
  achieved_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
})

export const groupExclusionDoc = ({ groupId, userId, reason = 'left', byUserId = null }) => ({
  group_id: groupId,
  user_id: userId,
  reason,
  by_user_id: byUserId,
  created_at: new Date().toISOString(),
})

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
  type,
  created_at_iso: new Date().toISOString(),
})

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

export const wakeUpLogDoc = ({ userId, groupId = null, wokeUpAt = new Date() }) => ({
  user_id: userId,
  group_id: groupId,
  date: dateKey(wokeUpAt instanceof Date ? wokeUpAt : new Date()),
  woke_up_at: toIsoTime(wokeUpAt) ?? new Date().toISOString(),
})

export const missedWakeUpDoc = ({ userId, groupId, reason = 'did_not_wake_up' }) => ({
  user_id: userId,
  group_id: groupId,
  date: dateKey(),
  missed_at: new Date().toISOString(),
  reason,
})

export const DEFAULT_FASTING_DEFAULTS = {
  sunnah: true,
  whiteDays: true,
  ramadan: true,
}

export const DEFAULT_PREFERENCES = {
  soundEnabled: true,
  defaultLocation: null,
  alarmSound: 'default',
}

export const newProfileDoc = ({ uid, email, displayName, signupSource = 'mobile', platform = 'mobile' }) => ({
  uid,
  email,
  display_name: displayName || (email ? email.split('@')[0] : ''),
  isVerified: false,
  createdAt: new Date().toISOString(),
  signupSource,
  platform,
  fastingDefaults: { ...DEFAULT_FASTING_DEFAULTS },
  preferences: { ...DEFAULT_PREFERENCES },
})

export const profileCreatedAt = (profile) =>
  toIsoTime(profile?.createdAt ?? profile?.created_at)

/**
 * Lifetime Badge Tracks with Levels.
 * Designed so that milestones never finish and can last a lifetime.
 */
export const BADGE_TRACKS = {
  FASTING: {
    id: 'fasting',
    title: 'Dawn Seeker',
    titleArabic: 'طالب الفجر',
    icon: '🌅',
    category: 'milestone',
    description: 'Record Suhoor check-ins and completed fasting days',
    unit: 'days',
    levels: [
      { level: 1, requirement: 1, title: 'Dawn Seeker I', points: 50, badgeId: 'first_suhoor' },
      { level: 2, requirement: 3, title: 'Consistent Riser II', points: 100, badgeId: 'days_3' },
      { level: 3, requirement: 7, title: 'Week Warrior III', points: 250, badgeId: 'days_7' },
      { level: 4, requirement: 14, title: 'White Moon Luminary IV', points: 500, badgeId: 'days_14' },
      { level: 5, requirement: 30, title: 'Ramadan Champion V', points: 1000, badgeId: 'days_30' },
      { level: 6, requirement: 60, title: 'Baqarah Luminary VI', points: 2000, badgeId: 'days_60' },
      { level: 7, requirement: 100, title: 'Century Champion VII', points: 3500, badgeId: 'days_100' },
      { level: 8, requirement: 180, title: 'Half-Year Pillar VIII', points: 5500, badgeId: 'days_180' },
      { level: 9, requirement: 365, title: 'Annual Guardian IX', points: 10000, badgeId: 'days_365' },
      { level: 10, requirement: 500, title: 'Devoted Steadfast X', points: 15000, badgeId: 'days_500' },
      { level: 11, requirement: 730, title: 'Two-Year Vanguard XI', points: 22000, badgeId: 'days_730' },
      { level: 12, requirement: 1000, title: 'Millennial Sage XII', points: 35000, badgeId: 'days_1000' },
    ]
  },
  EARLY_BIRD: {
    id: 'early_bird',
    title: 'Fajr Vanguard',
    titleArabic: 'طليعة الفجر',
    icon: '🦅',
    category: 'punctuality',
    description: 'Check in early before Fajr during pre-dawn hours',
    unit: 'times',
    levels: [
      { level: 1, requirement: 1, title: 'Fajr Sentinel I', points: 75, badgeId: 'early_bird' },
      { level: 2, requirement: 5, title: 'Dawn Pioneer II', points: 150, badgeId: 'early_bird_5' },
      { level: 3, requirement: 15, title: 'Horizon Sentinel III', points: 350, badgeId: 'early_bird_15' },
      { level: 4, requirement: 30, title: 'Vanguard Leader IV', points: 750, badgeId: 'early_bird_30' },
      { level: 5, requirement: 60, title: 'Pre-Dawn Master V', points: 1500, badgeId: 'early_bird_60' },
      { level: 6, requirement: 100, title: 'Eternal Dawn VI', points: 3000, badgeId: 'early_bird_100' },
      { level: 7, requirement: 250, title: 'Celestial Vanguard VII', points: 7500, badgeId: 'early_bird_250' },
      { level: 8, requirement: 500, title: 'Master of Fajr VIII', points: 15000, badgeId: 'early_bird_500' },
    ]
  },
  GROUP_GUARDIAN: {
    id: 'group_guardian',
    title: 'Wake-Up Angel',
    titleArabic: 'حارس الإخوان',
    icon: '🔔',
    category: 'community',
    description: 'Buzz and wake up sleeping accountability members',
    unit: 'buzzes',
    levels: [
      { level: 1, requirement: 1, title: 'Accountability Helper I', points: 50, badgeId: 'group_guardian_1' },
      { level: 2, requirement: 5, title: 'Wake-Up Angel II', points: 150, badgeId: 'group_guardian' },
      { level: 3, requirement: 15, title: 'Brotherhood Pillar III', points: 350, badgeId: 'group_guardian_15' },
      { level: 4, requirement: 30, title: 'Sentinel Protector IV', points: 750, badgeId: 'group_guardian_30' },
      { level: 5, requirement: 60, title: 'Circle Champion V', points: 1500, badgeId: 'group_guardian_60' },
      { level: 6, requirement: 100, title: 'Community Hero VI', points: 3000, badgeId: 'group_guardian_100' },
      { level: 7, requirement: 250, title: 'Grand Guardian VII', points: 7500, badgeId: 'group_guardian_250' },
    ]
  },
  SUNNAH_DEVOTEE: {
    id: 'sunnah_devotee',
    title: 'Sunnah Champion',
    titleArabic: 'محيي السنة',
    icon: '🌿',
    category: 'sunnah',
    description: 'Observe voluntary Sunnah fasts (Mon/Thu, White Days)',
    unit: 'fasts',
    levels: [
      { level: 1, requirement: 2, title: 'Sunnah Seeker I', points: 50, badgeId: 'sunnah_devotee_2' },
      { level: 2, requirement: 8, title: 'Sunnah Champion II', points: 200, badgeId: 'sunnah_devotee' },
      { level: 3, requirement: 20, title: 'White Moon Luminary III', points: 500, badgeId: 'sunnah_devotee_20' },
      { level: 4, requirement: 50, title: 'Sunnah Pillar IV', points: 1200, badgeId: 'sunnah_devotee_50' },
      { level: 5, requirement: 100, title: 'Sunnah Reviver V', points: 2500, badgeId: 'sunnah_devotee_100' },
      { level: 6, requirement: 250, title: 'Noble Reviver VI', points: 6500, badgeId: 'sunnah_devotee_250' },
    ]
  },
  KNOWLEDGE_SEEKER: {
    id: 'knowledge_seeker',
    title: 'Seeker of Ilm',
    titleArabic: 'طالب العلم',
    icon: '📖',
    category: 'knowledge',
    description: 'Explore fasting treatises and recite Du\'as in the library',
    unit: 'reads',
    levels: [
      { level: 1, requirement: 1, title: 'Student of Knowledge I', points: 100, badgeId: 'knowledge_seeker' },
      { level: 2, requirement: 5, title: 'Knowledge Explorer II', points: 250, badgeId: 'knowledge_seeker_5' },
      { level: 3, requirement: 15, title: 'Treatise Scholar III', points: 600, badgeId: 'knowledge_seeker_15' },
      { level: 4, requirement: 30, title: 'Master of Sunnah IV', points: 1500, badgeId: 'knowledge_seeker_30' },
    ]
  }
}

/**
 * Standard badge list preserved for legacy code & direct lookups.
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
    description: 'Recorded voluntary Sunnah fasts (Mon/Thu or White Days)',
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

/**
 * Lifetime Barakah Tiers
 */
export const BARAKAH_TIERS = [
  { level: 1, name: 'Barakah Seeker', minPoints: 0, icon: '🌱' },
  { level: 2, name: 'Steadfast Riser', minPoints: 500, icon: '🌿' },
  { level: 3, name: 'Suhoor Guardian', minPoints: 1200, icon: '⭐' },
  { level: 4, name: 'Fajr Vanguard', minPoints: 2500, icon: '🌙' },
  { level: 5, name: 'Barakah Master', minPoints: 5000, icon: '👑' },
  { level: 6, name: 'Dawn Luminary', minPoints: 10000, icon: '✨' },
  { level: 7, name: 'Celestial Beacon', minPoints: 20000, icon: '💫' },
  { level: 8, name: 'Sunnah Champion', minPoints: 35000, icon: '🌟' },
  { level: 9, name: 'Barakah Legend', minPoints: 50000, icon: '🏆' },
  { level: 10, name: 'Eternal Dawn', minPoints: 100000, icon: '🌌' },
]

export const getBarakahLevel = (points = 0) => {
  const pts = Number(points) || 0
  let currentTier = BARAKAH_TIERS[0]
  for (const tier of BARAKAH_TIERS) {
    if (pts >= tier.minPoints) {
      currentTier = tier
    } else {
      break
    }
  }
  if (pts > 100000) {
    const extra = Math.floor((pts - 100000) / 25000)
    const level = 10 + extra
    return {
      level,
      name: `Barakah Luminary ${level}`,
      minPoints: 100000 + extra * 25000,
      icon: '🌌',
    }
  }
  return currentTier
}

/**
 * Universal calculation of user SP (Suhoor Points) and unlocked badges.
 * Scales for lifetime usage.
 */
export const calculateUserSPAndBadges = ({
  totalFastingDays = 0,
  earlyBirds = 0,
  membersBuzzed = 0,
  sunnahFasts = 0,
  knowledgeCount = 0,
}) => {
  let points = 0
  const badges = new Set()

  // Base activity points
  points += (Number(totalFastingDays) || 0) * 10
  points += (Number(earlyBirds) || 0) * 15
  points += (Number(membersBuzzed) || 0) * 5
  points += (Number(sunnahFasts) || 0) * 15
  points += (Number(knowledgeCount) || 0) * 5

  // Fasting levels
  for (const tier of BADGE_TRACKS.FASTING.levels) {
    if (totalFastingDays >= tier.requirement) {
      badges.add(tier.badgeId)
      points += tier.points
    }
  }

  // Early Bird levels
  for (const tier of BADGE_TRACKS.EARLY_BIRD.levels) {
    if (earlyBirds >= tier.requirement) {
      badges.add(tier.badgeId)
      points += tier.points
    }
  }

  // Group Guardian levels
  for (const tier of BADGE_TRACKS.GROUP_GUARDIAN.levels) {
    if (membersBuzzed >= tier.requirement) {
      badges.add(tier.badgeId)
      points += tier.points
    }
  }

  // Sunnah levels
  for (const tier of BADGE_TRACKS.SUNNAH_DEVOTEE.levels) {
    if (sunnahFasts >= tier.requirement) {
      badges.add(tier.badgeId)
      points += tier.points
    }
  }

  // Knowledge levels
  for (const tier of BADGE_TRACKS.KNOWLEDGE_SEEKER.levels) {
    if (knowledgeCount >= tier.requirement) {
      badges.add(tier.badgeId)
      points += tier.points
    }
  }

  return {
    points,
    badges: Array.from(badges),
  }
}

/** Canonical gamification_stats document body */
export const gamificationDoc = ({
  userId,
  points = 0,
  successfulWakeups = 0,
  totalFastingDays = 0,
  earlyBirds = 0,
  membersBuzzed = 0,
  sunnahFasts = 0,
  knowledgeCount = 0,
  badges = [],
}) => ({
  user_id: userId,
  points: Number(points) || 0,
  successful_wakeups: Number(successfulWakeups || totalFastingDays) || 0,
  total_fasting_days: Number(totalFastingDays || successfulWakeups) || 0,
  early_birds: Number(earlyBirds) || 0,
  members_buzzed: Number(membersBuzzed) || 0,
  sunnah_fasts: Number(sunnahFasts) || 0,
  knowledge_count: Number(knowledgeCount) || 0,
  badges: Array.isArray(badges) ? badges : [],
  updated_at: new Date().toISOString(),
})
