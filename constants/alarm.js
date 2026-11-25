/**
 * The single native alarm id this app schedules.
 *
 * Kotlin no longer depends on it — AlarmReceiver re-arms any alarm whose type is
 * "wake_up", and re-derives the next occurrence from the alarm's wall-clock time
 * of day. This constant exists so that JS cancel/schedule/storage all name the
 * same alarm: three copies of the string literal is how a cancel ends up
 * cancelling nothing.
 *
 * Keep in sync with AlarmContext, which is the only place that arms it.
 */
export const DAILY_ALARM_ID = 'suhoor-daily-alarm'

/**
 * AsyncStorage keys for the armed alarm. AlarmContext and useAlarm.js used to
 * disagree about these (one wrote `suhoor_daily_alarm_time`, the other read
 * `suhoor_alarm_id`), so `useAlarm().cancelAlarm()` silently did nothing. One
 * module, one set of keys.
 */
export const ALARM_STORAGE = {
  /** ISO timestamp of the armed alarm. */
  alarmTime: 'suhoor_daily_alarm_time',
  /** Native alarm id that is armed. */
  alarmId: 'suhoor_alarm_id',
  /** Owner of the armed alarm, for re-arming. */
  userId: 'suhoor_alarm_user_id',
  /** Group the alarm belongs to, for re-arming. */
  groupId: 'suhoor_alarm_group_id',
}

export default { DAILY_ALARM_ID, ALARM_STORAGE }
