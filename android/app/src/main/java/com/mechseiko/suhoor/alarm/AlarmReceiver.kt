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

        // Show notification
        showNotification(context, alarmData)

        // Launch full-screen alarm activity
        launchAlarmActivity(context, alarmData)

        // Remove alarm from storage after triggering
        val alarmManagerModule = AlarmManagerModule(context)
        alarmManagerModule.cancelAlarm(alarmId)
    }

    /**
     * Show notification for the alarm
     */
    private fun showNotification(context: Context, alarmData: AlarmData) {
        val notificationManager = NotificationManagerCompat.from(context)

        // Create notification channel for Android O+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = android.app.NotificationChannel(
                CHANNEL_ID,
                "Suhoor Alarm",
                android.app.NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for Suhoor alarms"
                enableVibration(true)
                enableLights(true)
                setShowBadge(true)
            }

            val systemNotificationManager = context.getSystemService(android.app.NotificationManager::class.java)
            systemNotificationManager?.createNotificationChannel(channel)
        }

        // Build notification
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle("It's time for suhoor")
            .setContentText("It's time for Suhoor! Wake up and check in")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(createFullScreenIntent(context, alarmData), true)
            .build()

        notificationManager.notify(NOTIFICATION_ID, notification)
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
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
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
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }

        // Add flags to wake device and show on lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NO_USER_ACTION)
        }

        context.startActivity(intent)
    }
}
