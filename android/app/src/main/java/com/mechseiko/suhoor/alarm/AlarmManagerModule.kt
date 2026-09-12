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
     * @param alarmType Type of alarm (wake_up, recheck, remote_buzz)
     * @return true if alarm was scheduled successfully
     */
    fun scheduleAlarm(
        alarmId: String,
        triggerTime: Long,
        userId: String,
        groupId: String,
        alarmType: String = "wake_up"
    ): Boolean {
        try {
            // Check if exact alarm permission is granted (Android 12+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!alarmManager.canScheduleExactAlarms()) {
                    Log.e(TAG, "SCHEDULE_EXACT_ALARM permission not granted")
                    return false
                }
            }

            // Create alarm data object
            val alarmData = AlarmData(
                id = alarmId,
                triggerTime = triggerTime,
                userId = userId,
                groupId = groupId,
                type = alarmType,
                createdAt = System.currentTimeMillis()
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

            // Schedule exact alarm
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerTime,
                    pendingIntent
                )
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                alarmManager.setExact(
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

            // Start foreground service to keep alarm running in background
            AlarmForegroundService.startService(context, triggerTime, alarmId)

            Log.d(TAG, "Alarm scheduled: $alarmId at ${Date(triggerTime)}")
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
                alarmType = alarmData.type
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

            // Stop foreground service
            AlarmForegroundService.stopService(context)

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
                    alarmType = alarm.type
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
    val createdAt: Long
)
