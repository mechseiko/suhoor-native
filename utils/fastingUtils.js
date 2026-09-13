/**
 * Get Hijri date information for a given Gregorian date
 * @param date 
 * @returns {{ day: number, month: number, year: number }}
 */
export const getHijriDate = (date) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });

    const parts = formatter.formatToParts(date);
    const hijri = {};
    parts.forEach((part) => {
      if (part.type !== 'literal') {
        hijri[part.type] = parseInt(part.value, 10);
      }
    });

    return {
      day: hijri.day || 1,
      month: hijri.month || 1,
      year: hijri.year || 1445,
    };
  } catch (error) {
    console.error('Error formatting Hijri date:', error);
    // Return a default date if formatting fails (e.g. environment compatibility issues)
    return { day: 1, month: 1, year: 1445 };
  }
};

/**
 * Check if the date is Monday or Thursday
 * @param date 
 * @returns {boolean}
 */
export const isMondayOrThursday = (date) => {
  const day = date.getDay();
  return day === 1 || day === 4;
};

/**
 * Check if the date is a "White Day" (13, 14, or 15 of Hijri month)
 * @param date 
 * @returns {boolean}
 */
export const isWhiteDay = (date) => {
  const hijri = getHijriDate(date);
  return hijri.day >= 13 && hijri.day <= 15;
};

/**
 * Check if the date is in Ramadan
 * @param date 
 * @returns {boolean}
 */
export const isRamadan = (date) => {
  const hijri = getHijriDate(date);
  return hijri.month === 9;
};

/**
 * Check if the date is in the first 9 days of Dhul-Hijjah
 * @param date 
 * @returns {boolean}
 */
export const isFirstNineDhulHijjah = (date) => {
  const hijri = getHijriDate(date);
  return hijri.month === 12 && hijri.day <= 9;
};

/**
 * Determine the target date for the fasting prompt
 * - If it's 8 AM or later (before midnight): target is tomorrow
 * - If it's midnight or later (before 8 AM): target is today
 * - Otherwise (between 8 AM and midnight): prompt is hidden (too late to set intention for today, too early for tomorrow)
 * @returns {Date|null}
 */
export const getTargetFastingDate = () => {
  const now = new Date();
  const hour = now.getHours();

  // 8 AM or later (before midnight): show prompt for tomorrow
  if (hour >= 8 && hour < 24) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return tomorrow;
  }
  
  // Midnight or later (before 8 AM): show prompt for today
  if (hour >= 0 && hour < 8) {
    return new Date(now);
  }

  // Between 8 AM and midnight: hide prompt
  return null;
};

/**
 * Which answer the daily prompt starts on, from the date and the user's
 * `fastingDefaults` toggles in Settings.
 *
 * Every ordinary day defaults to NO. A day only defaults to YES when it is one
 * of the four special kinds — Ramadan, a Sunnah day (Mon/Thu), a White Day
 * (13-15 Hijri), one of the first nine of Dhul-Hijjah — AND the matching switch
 * in Settings is on. Those four switches ARE the setting: an earlier version
 * also required a master `fastingDefaults.autoDefaultSpecialDays` flag that no
 * screen ever wrote, so turning "Sunnah days" on in Settings still left the
 * prompt saying it defaults to No.
 *
 * A date can qualify under more than one kind (a Monday inside Ramadan, a White
 * Day that is also a Thursday). Any single enabled match is enough, so
 * switching one kind off never suppresses another that is still on.
 *
 * @param date
 * @param preferences - the userProfile document
 * @returns {boolean}
 */
export const getDefaultIntention = (date, preferences = {}) => {
  const { fastingDefaults = {} } = preferences || {};

  // Each entry: does the date qualify, and is that kind enabled? Settings
  // defaults every switch to on, so an absent field reads as true here to match.
  const matches = [
    [isRamadan(date), fastingDefaults.ramadan ?? true],
    [isMondayOrThursday(date), fastingDefaults.sunnah ?? true],
    [isWhiteDay(date), fastingDefaults.whiteDays ?? true],
    [isFirstNineDhulHijjah(date), fastingDefaults.dhulHijjah ?? true],
  ];

  return matches.some(([isSpecialDay, enabled]) => isSpecialDay && enabled);
};

/**
 * Check-in date verification (the "prove you're awake" step).
 *
 * The pattern stays a fixed numeric MM DD YYYY instead of following the UI
 * language: the field is a number pad, the comparison is exact, and a
 * locale-ordered pattern would let the hint and the check drift apart per
 * language. UI copy interpolates WAKE_VERIFY_PATTERN into `alarm.formatHint`
 * and `alarm.verifyInstruction`, so the words around the pattern are translated
 * while the pattern itself is not.
 */
export const WAKE_VERIFY_PATTERN = 'MM DD YYYY';

/** Today's date rendered in WAKE_VERIFY_PATTERN — also used as the example hint. */
export const wakeVerifyDate = (date = new Date()) =>
  [
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getFullYear()),
  ].join(' ');

/** Digits only, so whichever separators the user types (or omits) still pass. */
export const matchesWakeVerifyDate = (input, date = new Date()) =>
  String(input).replace(/\D/g, '') === wakeVerifyDate(date).replace(/\D/g, '');
