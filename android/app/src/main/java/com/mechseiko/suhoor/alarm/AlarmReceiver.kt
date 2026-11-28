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
        const val NOTIFICATION_ID = AlarmChannels.NOTIFICATION_ID
        private const val CHANNEL_ID = AlarmChannels.ID
    }

    override fun onReceive(context: Context, intent: Intent) {
        // Nothing may escape onReceive: an exception here is an app crash at the
        // exact moment the user is meant to be woken up, and it happens whether
        // or not the process was already running.
        try {
            handleAlarm(context, intent)
        } catch (e: Throwable) {
            Log.e(TAG, "Unhandled error while delivering the alarm", e)
        }
    }

    private fun handleAlarm(context: Context, intent: Intent) {
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

        // Past suhoor's cutoff there is nothing useful left to do: no sound, no
        // screen, no notification. The alarm is still consumed and re-armed
        // below, so the next night is unaffected. This holds for a first alarm
        // and for a group buzz alike.
        if (AlarmCutoff.hasPassed(context)) {
            Log.d(TAG, "Alarm ${alarmData.id} suppressed: past tonight's cutoff")
        } else {
            // Start foreground service to play sound and vibrate continuously even when app is closed
            AlarmForegroundService.startAlarm(context, alarmData)

            // Show notification
            showNotification(context, alarmData)

            // Launch full-screen alarm activity
            launchAlarmActivity(context, alarmData)
        }

        // Remove alarm from storage after triggering
        val alarmManagerModule = AlarmManagerModule(context)
        alarmManagerModule.cancelAlarm(alarmId)

        // Keep the daily alarm alive without the app being opened.
        //
        // This used to require the id to be the literal "suhoor-daily-alarm" and
        // to chain "triggerTime + 24h". Both were wrong: any caller that
        // generated its own id silently got a one-shot alarm, and +24h drifts
        // because suhoor moves a little every day (and a timezone or DST change
        // moves the clock while the epoch stays put). Every wake-up alarm is now
        // re-armed at the next occurrence of its wall-clock time; buzzes are
        // one-shot by design.
        if (alarmData.type == "wake_up") {
            val nextTrigger = alarmManagerModule.nextOccurrenceOfDay(
                alarmData.triggerTime,
                System.currentTimeMillis()
            )
            if (nextTrigger != null && nextTrigger > System.currentTimeMillis()) {
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
            } else {
                Log.w(TAG, "Could not re-arm the daily alarm for $alarmId")
            }
        }
    }

    /**
     * Show notification for the alarm
     */
    private fun showNotification(context: Context, alarmData: AlarmData) {
        val notificationManager = NotificationManagerCompat.from(context)

        // One channel definition, shared with the foreground service.
        AlarmChannels.ensure(context)

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
     * Put the alarm screen up.
     *
     * The screen is started directly — that is the point. When Android lets it
     * through, the alarm takes over on its own with no notification involved:
     * that is the case while the app has a visible window, when "Display over
     * other apps" is granted, and on versions before the background-activity-
     * start restriction existed.
     *
     * When Android refuses, it refuses silently ("Background activity launch
     * blocked" in logcat) and the full-screen intent on the service
     * notification covers the locked-phone case. The start is therefore always
     * attempted — skipping it ourselves, as an earlier version did, threw away
     * every case where the OS would have said yes.
     */
    private fun launchAlarmActivity(context: Context, alarmData: AlarmData) {
        try {
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
        } catch (e: Exception) {
            // ActivityNotFoundException, SecurityException, or a vendor build
            // that throws instead of logging a blocked start. The alarm must
            // keep ringing, so this never propagates.
            Log.w(TAG, "Direct launch refused — relying on the full-screen intent", e)
        }
    }
}
