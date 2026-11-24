package com.mechseiko.suhoor.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.mechseiko.suhoor.MainActivity
import java.util.Date

/**
 * Native Android Alarm Manager Module
 * Handles scheduling, updating, and cancelling alarms using Android's AlarmManager
 * Alarms persist across app closure, device lock, and reboot
 */
class AlarmManagerModule(private val context: Context) {

    companion object {
        private const val TAG = "AlarmManagerModule"
        private const val ALARM_REQUEST_CODE = 1001
        private const val SHOW_INTENT_REQUEST_CODE = 1002
        private const val PREFS_NAME = "suhoor_alarms"
        private const val KEY_ALARMS = "alarms_list"
    }

    private val alarmManager: AlarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    private val gson = Gson()
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Schedule a new alarm
     * @param alarmId Unique identifier for the alarm
     * @param triggerTime Time when alarm should trigger (timestamp in milliseconds)
     * @param userId User ID for logging purposes
     * @param groupId Group ID for logging purposes
     * @param alarmType Type of alarm (wake_up, remote_buzz)
     * @return true if alarm was scheduled successfully
     */
    fun scheduleAlarm(
        alarmId: String,
        triggerTime: Long,
        userId: String,
        groupId: String,
        alarmType: String = "wake_up",
        soundName: String = "",
        volume: Float = -1f
    ): Boolean {
        try {
            // Check if exact alarm permission is granted (Android 12+).
            // If it is not, we still schedule an inexact alarm below: an alarm
            // that fires a few minutes late is far better than no alarm at all.
            var exactAllowed = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                exactAllowed = alarmManager.canScheduleExactAlarms()
                if (!exactAllowed) {
                    Log.w(TAG, "Exact alarms not allowed — falling back to inexact alarm")
                }
            }

            // Create alarm data object
            val alarmData = AlarmData(
                id = alarmId,
                triggerTime = triggerTime,
                userId = userId,
                groupId = groupId,
                type = alarmType,
                createdAt = System.currentTimeMillis(),
                soundName = soundName,
                volume = volume
            )

            // Save alarm to persistent storage
            saveAlarm(alarmData)

            // Create intent for alarm receiver
            val intent = Intent(context, AlarmReceiver::class.java).apply {
                action = "com.mechseiko.suhoor.ALARM_TRIGGER"
                putExtra("alarm_id", alarmId)
                putExtra("alarm_data", gson.toJson(alarmData))
            }

            // Create pending intent
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val pendingIntent = PendingIntent.getBroadcast(
                context,
                alarmId.hashCode(),
                intent,
                flags
            )

            // Schedule the alarm.
            //
            // setAlarmClock() is the only AlarmManager API that the platform
            // and OEM power managers both treat as a user-visible alarm:
            //  - it is exempt from Doze batching and from the "not more than
            //    once every 9 minutes" throttle that applies to
            //    setExactAndAllowWhileIdle(), so a suhoor alarm is not silently
            //    deferred by a few minutes every night;
            //  - it pins a real alarm in the system UI (status-bar clock icon,
            //    "next alarm" in Quick Settings and Digital Wellbeing), which is
            //    how a user checks that the alarm is actually armed;
            //  - it is the alarm type that aggressive OEM power managers
            //    (Samsung sleeping apps, Xiaomi, Tecno/Infinix, Oppo) do not
            //    quietly drop;
            //  - it grants the "an exact alarm fired" exemption that lets the
            //    receiver start a foreground service from the background on
            //    Android 12+.
            //
            // When exact alarms are not permitted, or the platform refuses the
            // call, we still schedule something: an alarm that fires a little
            // late is far better than no alarm at all.
            var scheduled = false
            var mode = "inexact"

            if (exactAllowed && scheduleAlarmClock(triggerTime, pendingIntent)) {
                scheduled = true
                mode = "alarmClock"
            } else if (exactAllowed) {
                Log.w(TAG, "setAlarmClock refused — falling back to setExactAndAllowWhileIdle")
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        alarmManager.setExactAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            triggerTime,
                            pendingIntent
                        )
                    } else {
                        alarmManager.setExact(
                            AlarmManager.RTC_WAKEUP,
                            triggerTime,
                            pendingIntent
                        )
                    }
                    scheduled = true
                    mode = "exact-and-allow-while-idle"
                } catch (e: Exception) {
                    Log.e(TAG, "setExactAndAllowWhileIdle failed: ${e.message}")
                }
            }

            if (!scheduled) {
                // Exact alarms are not allowed (or every exact API was refused):
                // inexact, but still Doze-proof.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerTime,
                        pendingIntent
                    )
                } else {
                    alarmManager.set(
                        AlarmManager.RTC_WAKEUP,
                        triggerTime,
                        pendingIntent
                    )
                }
            }

            Log.d(TAG, "Alarm scheduled ($mode): $alarmId at ${Date(triggerTime)}")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Error scheduling alarm: $alarmId", e)
            return false
        }
    }

    /**
     * Update an existing alarm
     * @param alarmId ID of alarm to update
     * @param newTriggerTime New trigger time
     * @return true if alarm was updated successfully
     */
    fun updateAlarm(alarmId: String, newTriggerTime: Long): Boolean {
        try {
            // Cancel existing alarm
            cancelAlarm(alarmId)

            // Get alarm data
            val alarmData = getAlarm(alarmId) ?: return false

            // Update trigger time
            alarmData.triggerTime = newTriggerTime

            // Reschedule with new time
            return scheduleAlarm(
                alarmId = alarmId,
                triggerTime = newTriggerTime,
                userId = alarmData.userId,
                groupId = alarmData.groupId,
                alarmType = alarmData.type,
                soundName = alarmData.soundName,
                volume = alarmData.volume
            )

        } catch (e: Exception) {
            Log.e(TAG, "Error updating alarm: $alarmId", e)
            return false
        }
    }

    /**
     * Cancel an alarm
     * @param alarmId ID of alarm to cancel
     * @return true if alarm was cancelled successfully
     */
    fun cancelAlarm(alarmId: String): Boolean {
        try {
            val intent = Intent(context, AlarmReceiver::class.java).apply {
                action = "com.mechseiko.suhoor.ALARM_TRIGGER"
                putExtra("alarm_id", alarmId)
            }

            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val pendingIntent = PendingIntent.getBroadcast(
                context,
                alarmId.hashCode(),
                intent,
                flags
            )

            alarmManager.cancel(pendingIntent)

            // Remove from persistent storage
            removeAlarm(alarmId)

            // NOTE: deliberately does NOT stop AlarmForegroundService here.
            // This used to be called right after startAlarm() in AlarmReceiver,
            // which handed the service a PLAY then an immediate STOP and cut the
            // ringing sound. Only the PIN dismissal (stopAlarmService) stops it.

            Log.d(TAG, "Alarm cancelled: $alarmId")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Error cancelling alarm: $alarmId", e)
            return false
        }
    }

    /**
     * Check if an alarm is scheduled
     * @param alarmId ID of alarm to check
     * @return true if alarm is scheduled
     */
    fun isAlarmScheduled(alarmId: String): Boolean {
        return getAlarm(alarmId) != null
    }

    /**
     * Get all scheduled alarms
     * @return List of all alarm data
     */
    fun getAllAlarms(): List<AlarmData> {
        val alarmsJson = prefs.getString(KEY_ALARMS, null) ?: return emptyList()
        val type = object : TypeToken<List<AlarmData>>() {}.type
        return gson.fromJson(alarmsJson, type) ?: emptyList()
    }

    /**
     * Restore all alarms after device reboot
     * Called by BootReceiver
     */
    fun restoreAllAlarms() {
        val alarms = getAllAlarms()
        val now = System.currentTimeMillis()

        alarms.forEach { alarm ->
            if (alarm.triggerTime > now) {
                // Reschedule alarm if it's in the future
                scheduleAlarm(
                    alarmId = alarm.id,
                    triggerTime = alarm.triggerTime,
                    userId = alarm.userId,
                    groupId = alarm.groupId,
                    alarmType = alarm.type,
                    soundName = alarm.soundName,
                    volume = alarm.volume
                )
                Log.d(TAG, "Restored alarm: ${alarm.id}")
            } else {
                // Remove expired alarms
                removeAlarm(alarm.id)
                Log.d(TAG, "Removed expired alarm: ${alarm.id}")
            }
        }
    }

    /**
     * Cancel all alarms
     */
    fun cancelAllAlarms() {
        val alarms = getAllAlarms()
        alarms.forEach { alarm ->
            cancelAlarm(alarm.id)
        }
    }

    // Private helper methods

    /**
     * Hands the alarm to [AlarmManager.setAlarmClock].
     *
     * Returns false instead of throwing so the caller can fall back: the exact
     * alarm permission can be revoked between the canScheduleExactAlarms()
     * check above and this call, and some OEM builds refuse setAlarmClock()
     * outright when the "Alarms & reminders" toggle is off.
     */
    private fun scheduleAlarmClock(triggerTime: Long, operation: PendingIntent): Boolean {
        return try {
            alarmManager.setAlarmClock(
                // AlarmClockInfo is a nested class of AlarmManager, not a
                // top-level android.app type.
                AlarmManager.AlarmClockInfo(triggerTime, buildShowPendingIntent()),
                operation
            )
            true
        } catch (e: Exception) {
            Log.w(TAG, "setAlarmClock failed: ${e.message}")
            false
        }
    }

    /**
     * What the system shows when the user taps the alarm icon (the "next alarm"
     * entry in Quick Settings / the status bar). Opening the app is the only
     * useful target, so this never needs to know which alarm it belongs to.
     *
     * AlarmClockInfo requires a non-null show intent, and on API 34+ it has to
     * be an activity PendingIntent, so this must not be changed to a broadcast.
     */
    private fun buildShowPendingIntent(): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getActivity(context, SHOW_INTENT_REQUEST_CODE, intent, flags)
    }

    private fun saveAlarm(alarm: AlarmData) {
        val alarms = getAllAlarms().toMutableList()
        val existingIndex = alarms.indexOfFirst { it.id == alarm.id }

        if (existingIndex >= 0) {
            alarms[existingIndex] = alarm
        } else {
            alarms.add(alarm)
        }

        val alarmsJson = gson.toJson(alarms)
        prefs.edit().putString(KEY_ALARMS, alarmsJson).apply()
    }

    private fun getAlarm(alarmId: String): AlarmData? {
        return getAllAlarms().find { it.id == alarmId }
    }

    private fun removeAlarm(alarmId: String) {
        val alarms = getAllAlarms().toMutableList()
        alarms.removeIf { it.id == alarmId }
        val alarmsJson = gson.toJson(alarms)
        prefs.edit().putString(KEY_ALARMS, alarmsJson).apply()
    }
}

/**
 * Data class representing an alarm
 */
data class AlarmData(
    val id: String,
    var triggerTime: Long,
    val userId: String,
    val groupId: String,
    val type: String,
    val createdAt: Long,
    /** Raw resource name from utils/soundGenerator (e.g. "alarm_sound_pulse"). */
    val soundName: String = "",
    /** 0.0 - 1.0, or -1 to use full volume. */
    val volume: Float = -1f
) : java.io.Serializable
