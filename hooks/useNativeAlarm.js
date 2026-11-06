import { NativeModules, Platform } from 'react-native'

const { AlarmBridge } = NativeModules

/**
 * Native Alarm Hook
 * Provides interface to native Android alarm engine
 * Alarms persist across app closure, device lock, and reboot
 */
export function useNativeAlarm() {
  if (Platform.OS !== 'android') {
    return {
      scheduleAlarm: async () => false,
      updateAlarm: async () => false,
      cancelAlarm: async () => false,
      isAlarmScheduled: async () => false,
      getAllAlarms: async () => [],
      cancelAllAlarms: async () => false,
      canScheduleExactAlarms: async () => true,
      canUseFullScreenIntent: async () => true,
      openFullScreenIntentSettings: async () => false,
      openExactAlarmSettings: async () => false,
      getFcmToken: async () => null,
      consumeAlarmTrigger: async () => null,
      triggerRemoteBuzz: async () => false,
      stopAlarmService: async () => true,
      isNativeAvailable: false,
    }
  }

  if (!AlarmBridge) {
    console.warn(
      'AlarmBridge module not found (Expo Go or development build not created)'
    )
    return {
      scheduleAlarm: async () => false,
      updateAlarm: async () => false,
      cancelAlarm: async () => false,
      isAlarmScheduled: async () => false,
      getAllAlarms: async () => [],
      cancelAllAlarms: async () => false,
      canScheduleExactAlarms: async () => false,
      canUseFullScreenIntent: async () => true,
      openFullScreenIntentSettings: async () => false,
      openExactAlarmSettings: async () => false,
      getFcmToken: async () => null,
      consumeAlarmTrigger: async () => null,
      triggerRemoteBuzz: async () => false,
      stopAlarmService: async () => false,
      isNativeAvailable: false,
    }
  }

  /**
   * Schedule a new alarm
   * @param {string} alarmId - Unique identifier for the alarm
   * @param {number} triggerTime - Time when alarm should trigger (timestamp in milliseconds)
   * @param {string} userId - User ID for logging purposes
   * @param {string} groupId - Group ID for logging purposes
   * @param {string} alarmType - Type of alarm (wake_up, remote_buzz)
   * @param {string} soundName - Raw resource name, e.g. "alarm_sound_pulse"
   * @param {number} volume - 0..1, or -1 for full volume
   * @returns {Promise<boolean>} - True if alarm was scheduled successfully
   */
  const scheduleAlarm = async (
    alarmId,
    triggerTime,
    userId,
    groupId,
    alarmType = 'wake_up',
    soundName = '',
    volume = -1
  ) => {
    try {
      return await AlarmBridge.scheduleAlarm(
        alarmId,
        triggerTime,
        userId,
        groupId,
        alarmType,
        soundName || '',
        typeof volume === 'number' ? volume : -1
      )
    } catch (error) {
      console.error('Error scheduling native alarm:', error)
      return false
    }
  }

  /**
   * Update an existing alarm
   * @param {string} alarmId - ID of alarm to update
   * @param {number} newTriggerTime - New trigger time
   * @returns {Promise<boolean>} - True if alarm was updated successfully
   */
  const updateAlarm = async (alarmId, newTriggerTime) => {
    try {
      return await AlarmBridge.updateAlarm(alarmId, newTriggerTime)
    } catch (error) {
      console.error('Error updating native alarm:', error)
      return false
    }
  }

  /**
   * Cancel an alarm
   * @param {string} alarmId - ID of alarm to cancel
   * @returns {Promise<boolean>} - True if alarm was cancelled successfully
   */
  const cancelAlarm = async alarmId => {
    try {
      return await AlarmBridge.cancelAlarm(alarmId)
    } catch (error) {
      console.error('Error cancelling native alarm:', error)
      return false
    }
  }

  /**
   * Check if an alarm is scheduled
   * @param {string} alarmId - ID of alarm to check
   * @returns {Promise<boolean>} - True if alarm is scheduled
   */
  const isAlarmScheduled = async alarmId => {
    try {
      return await AlarmBridge.isAlarmScheduled(alarmId)
    } catch (error) {
      console.error('Error checking native alarm status:', error)
      return false
    }
  }

  /**
   * Get all scheduled alarms
   * @returns {Promise<Array>} - List of all alarm data
   */
  const getAllAlarms = async () => {
    try {
      return await AlarmBridge.getAllAlarms()
    } catch (error) {
      console.error('Error getting native alarms:', error)
      return []
    }
  }

  /**
   * Cancel all alarms
   * @returns {Promise<boolean>} - True if all alarms were cancelled successfully
   */
  const cancelAllAlarms = async () => {
    try {
      return await AlarmBridge.cancelAllAlarms()
    } catch (error) {
      console.error('Error cancelling all native alarms:', error)
      return false
    }
  }

  /**
   * Check if exact alarm permission is granted (Android 12+)
   * @returns {Promise<boolean>} - True if permission is granted
   */
  const canScheduleExactAlarms = async () => {
    try {
      return await AlarmBridge.canScheduleExactAlarms()
    } catch (error) {
      console.error('Error checking exact alarm permission:', error)
      return false
    }
  }

  /**
   * Trigger a remote buzz alarm (for future Remote Buzz feature)
   * @param {string} alarmId - Unique identifier for the alarm
   * @param {string} userId - User ID being buzzed
   * @param {string} groupId - Group ID the buzz is from
   * @param {string} buzzerId - User ID who sent the buzz
   * @returns {Promise<boolean>} - True if remote buzz was triggered successfully
   */
  const triggerRemoteBuzz = async (alarmId, userId, groupId, buzzerId) => {
    try {
      return await AlarmBridge.triggerRemoteBuzz(
        alarmId,
        userId,
        groupId,
        buzzerId
      )
    } catch (error) {
      console.error('Error triggering remote buzz:', error)
      return false
    }
  }

  /** Android 14+: is the alarm allowed to take over the lock screen? */
  const canUseFullScreenIntent = async () => {
    try {
      if (!AlarmBridge.canUseFullScreenIntent) return true
      return await AlarmBridge.canUseFullScreenIntent()
    } catch (error) {
      console.error('Error checking full-screen intent permission:', error)
      return true
    }
  }

  const openFullScreenIntentSettings = async () => {
    try {
      if (AlarmBridge.openFullScreenIntentSettings) {
        return await AlarmBridge.openFullScreenIntentSettings()
      }
      return false
    } catch (error) {
      console.error('Error opening full-screen intent settings:', error)
      return false
    }
  }

  const openExactAlarmSettings = async () => {
    try {
      if (AlarmBridge.openExactAlarmSettings) {
        return await AlarmBridge.openExactAlarmSettings()
      }
      return false
    } catch (error) {
      console.error('Error opening exact alarm settings:', error)
      return false
    }
  }

  const getFcmToken = async () => {
    try {
      if (!AlarmBridge.getFcmToken) return null
      return await AlarmBridge.getFcmToken()
    } catch (error) {
      console.error('Error getting FCM token:', error)
      return null
    }
  }

  /** One-shot: the user opened the app from the alarm screen / notification. */
  const consumeAlarmTrigger = async () => {
    try {
      if (!AlarmBridge.consumeAlarmTrigger) return null
      return await AlarmBridge.consumeAlarmTrigger()
    } catch (error) {
      console.error('Error consuming alarm trigger:', error)
      return null
    }
  }

  return {
    scheduleAlarm,
    updateAlarm,
    cancelAlarm,
    isAlarmScheduled,
    getAllAlarms,
    cancelAllAlarms,
    canScheduleExactAlarms,
    canUseFullScreenIntent,
    openFullScreenIntentSettings,
    openExactAlarmSettings,
    getFcmToken,
    consumeAlarmTrigger,
    triggerRemoteBuzz,
    stopAlarmService: async () => {
      try {
        return await AlarmBridge.stopAlarmService();
      } catch (e) {
        return false;
      }
    },
    isNativeAvailable: true,
  }
}

export default useNativeAlarm
