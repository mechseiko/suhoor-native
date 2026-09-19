package com.mechseiko.suhoor.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.mechseiko.suhoor.MainActivity

class AlarmForegroundService : Service() {

    companion object {
        private const val CHANNEL_ID = "alarm_foreground_channel"
        private const val NOTIFICATION_ID = 1001
        const val ACTION_START_ALARM = "com.mechseiko.suhoor.START_ALARM"
        const val ACTION_STOP_ALARM = "com.mechseiko.suhoor.STOP_ALARM"
        const val EXTRA_ALARM_TIME = "alarm_time"
        const val EXTRA_ALARM_ID = "alarm_id"

        fun startService(context: Context, alarmTime: Long, alarmId: String) {
            val intent = Intent(context, AlarmForegroundService::class.java).apply {
                action = ACTION_START_ALARM
                putExtra(EXTRA_ALARM_TIME, alarmTime)
                putExtra(EXTRA_ALARM_ID, alarmId)
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, AlarmForegroundService::class.java).apply {
                action = ACTION_STOP_ALARM
            }
            context.startService(intent)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_ALARM -> {
                val alarmTime = intent.getLongExtra(EXTRA_ALARM_TIME, System.currentTimeMillis())
                val alarmId = intent.getStringExtra(EXTRA_ALARM_ID) ?: ""
                startForegroundNotification(alarmTime, alarmId)
            }
            ACTION_STOP_ALARM -> {
                stopForeground(true)
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun startForegroundNotification(alarmTime: Long, alarmId: String) {
        createNotificationChannel()

        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Your suhoor alarm is active")
            .setContentText("Alarm scheduled for ${formatTime(alarmTime)}")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Alarm Foreground Service",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Keeps alarm running in background"
                setShowBadge(false)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun formatTime(timestamp: Long): String {
        val date = java.util.Date(timestamp)
        val format = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
        return format.format(date)
    }
}
