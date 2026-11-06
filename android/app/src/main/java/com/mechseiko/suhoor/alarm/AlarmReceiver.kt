package com.mechseiko.suhoor.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.gson.Gson
import com.mechseiko.suhoor.R
import java.util.Date

/**
 * BroadcastReceiver that handles alarm triggers
 * Receives intents from AlarmManager when an alarm fires
 */
class AlarmReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "AlarmReceiver"
        const val NOTIFICATION_ID = 2001
        private const val CHANNEL_ID = "suhoor_alarm_channel"
    }

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "Alarm received")

        val alarmId = intent.getStringExtra("alarm_id")
        val alarmDataJson = intent.getStringExtra("alarm_data")

        if (alarmId == null || alarmDataJson == null) {
            Log.e(TAG, "Invalid alarm data received")
            return
        }

        val gson = Gson()
        val alarmData = try {
            gson.fromJson(alarmDataJson, AlarmData::class.java)
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing alarm data", e)
            return
        }

        Log.d(TAG, "Alarm triggered: ${alarmData.id} type: ${alarmData.type}")

        // Start foreground service to play sound and vibrate continuously even when app is closed
        AlarmForegroundService.startAlarm(context, alarmData)

        // Show notification
        showNotification(context, alarmData)

        // Launch full-screen alarm activity
        launchAlarmActivity(context, alarmData)

        // Remove alarm from storage after triggering
        val alarmManagerModule = AlarmManagerModule(context)
        alarmManagerModule.cancelAlarm(alarmId)

        // Keep the daily alarm alive without the app being opened: re-arm the
        // same alarm for 24h later. The app replaces it with the exact API time
        // the next time it schedules (cancel + reschedule of the same id), so
        // this is only the safety net that prevents "one morning rings, then
        // silence". Buzzes never chain.
        if (alarmId == "suhoor-daily-alarm" && alarmData.type == "wake_up") {
            val nextTrigger = alarmData.triggerTime + 24L * 60L * 60L * 1000L
            if (nextTrigger > System.currentTimeMillis()) {
                alarmManagerModule.scheduleAlarm(
                    alarmId = alarmId,
                    triggerTime = nextTrigger,
                    userId = alarmData.userId,
                    groupId = alarmData.groupId,
                    alarmType = alarmData.type,
                    soundName = alarmData.soundName,
                    volume = alarmData.volume
                )
                Log.d(TAG, "Re-armed daily alarm for ${Date(nextTrigger)}")
            }
        }
    }

    /**
     * Show notification for the alarm
     */
    private fun showNotification(context: Context, alarmData: AlarmData) {
        val notificationManager = NotificationManagerCompat.from(context)

        // Create notification channel for Android O+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val soundUri = android.net.Uri.parse("android.resource://" + context.packageName + "/" + R.raw.alarm_sound)
            val audioAttributes = android.media.AudioAttributes.Builder()
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(android.media.AudioAttributes.USAGE_ALARM)
                .build()

            val channel = android.app.NotificationChannel(
                CHANNEL_ID,
                "Suhoor Alarm",
                android.app.NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for Suhoor alarms"
                enableVibration(true)
                enableLights(true)
                setShowBadge(true)
                setSound(soundUri, audioAttributes)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }

            val systemNotificationManager = context.getSystemService(android.app.NotificationManager::class.java)
            systemNotificationManager?.createNotificationChannel(channel)
        }

        // Build notification
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(
                if (alarmData.type == "remote_buzz") {
                    context.getString(R.string.alarm_buzz_notification_title)
                } else {
                    context.getString(R.string.alarm_notification_title)
                }
            )
            .setContentText(
                if (alarmData.type == "remote_buzz") {
                    context.getString(R.string.alarm_buzz_notification_text)
                } else {
                    context.getString(R.string.alarm_notification_text)
                }
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(createMainActivityPendingIntent(context, alarmData))
            .setFullScreenIntent(createFullScreenIntent(context, alarmData), true)
            .build()

        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    /**
     * Create intent to open React Native app (MainActivity) to enter PIN
     */
    private fun createMainActivityPendingIntent(context: Context, alarmData: AlarmData): android.app.PendingIntent {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("alarm_trigger", true)
            putExtra("alarm_id", alarmData.id)
            putExtra("alarm_type", alarmData.type)
        } ?: Intent(context, com.mechseiko.suhoor.MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("alarm_trigger", true)
            putExtra("alarm_id", alarmData.id)
            putExtra("alarm_type", alarmData.type)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        } else {
            android.app.PendingIntent.FLAG_UPDATE_CURRENT
        }

        return android.app.PendingIntent.getActivity(
            context,
            (alarmData.id + "_rn").hashCode(),
            launchIntent,
            flags
        )
    }

    /**
     * Create full-screen intent for the alarm
     */
    private fun createFullScreenIntent(context: Context, alarmData: AlarmData): android.app.PendingIntent {
        val gson = Gson()
        val alarmDataJson = gson.toJson(alarmData)
        
        val intent = Intent(context, AlarmActivity::class.java).apply {
            putExtra("alarm_id", alarmData.id)
            putExtra("alarm_data", alarmDataJson)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        } else {
            android.app.PendingIntent.FLAG_UPDATE_CURRENT
        }

        return android.app.PendingIntent.getActivity(
            context,
            alarmData.id.hashCode(),
            intent,
            flags
        )
    }

    /**
     * Launch the full-screen alarm activity
     */
    private fun launchAlarmActivity(context: Context, alarmData: AlarmData) {
        val gson = Gson()
        val alarmDataJson = gson.toJson(alarmData)
        
        val intent = Intent(context, AlarmActivity::class.java).apply {
            putExtra("alarm_id", alarmData.id)
            putExtra("alarm_data", alarmDataJson)
            // No CLEAR_TASK: it tore down the React Native task as a side effect.
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }

        // Add flags to wake device and show on lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NO_USER_ACTION)
        }

        context.startActivity(intent)
    }
}
