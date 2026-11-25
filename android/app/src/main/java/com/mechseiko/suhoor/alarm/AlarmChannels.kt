package com.mechseiko.suhoor.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.util.Log
import com.mechseiko.suhoor.R

/**
 * The one notification channel the alarm uses, created in one place.
 *
 * Three problems this fixes:
 *
 * 1. **Channel settings are frozen at first creation.** Android keeps the sound,
 *    importance and every other property of a channel forever after the first
 *    `createNotificationChannel` call with that id — later calls are ignored
 *    except for the name and description. Any install that ever created
 *    `suhoor_alarm_channel` with a different sound still has that sound, and no
 *    amount of code fixes it under the same id. The id therefore changes to
 *    `_v2`, and the legacy channel is deleted so it disappears from Settings.
 *
 * 2. **Do Not Disturb.** A channel with `USAGE_ALARM` sound survives "Priority
 *    only" but is silenced by "Total silence". `setBypassDnd(true)` is the only
 *    way to ring through it, and it needs the notification-policy access the app
 *    already declares (ACCESS_NOTIFICATION_POLICY).
 *
 * 3. **Duplication.** Both the receiver and the foreground service created the
 *    channel with slightly different code; only one of them could be right.
 */
object AlarmChannels {

    private const val TAG = "AlarmChannels"

    /** New id on purpose — see (1) above. Never reuse an old channel id. */
    const val ID = "suhoor_alarm_channel_v2"

    /** Superseded by [ID]; deleted on first run so users do not see two. */
    private const val LEGACY_ID = "suhoor_alarm_channel"

    /**
     * Notification id shared by the foreground service and the receiver.
     *
     * One id on purpose: the receiver posts over the service's ongoing
     * notification, so the user sees a single alarm entry rather than two. Two
     * constants that drift apart is what produced the duplicate in the first
     * place.
     */
    const val NOTIFICATION_ID = 2001

    /**
     * Creates the channel if needed. Safe to call on every alarm, from any
     * thread: Android treats repeat calls as no-ops.
     */
    fun ensure(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = context.getSystemService(NotificationManager::class.java) ?: run {
            Log.w(TAG, "No NotificationManager; alarm channel not created")
            return
        }

        try {
            manager.deleteNotificationChannel(LEGACY_ID)
        } catch (e: Exception) {
            Log.w(TAG, "Could not delete the legacy alarm channel: ${e.message}")
        }

        try {
            val channel = NotificationChannel(ID, "Suhoor Alarm", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Suhoor alarm: rings and shows the PIN screen"
                enableVibration(true)
                enableLights(true)
                setShowBadge(true)
                setSound(alarmSoundUri(context), alarmAudioAttributes())
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                try {
                    setBypassDnd(true)
                } catch (e: SecurityException) {
                    // No notification-policy access on this device: the alarm
                    // still rings in "Priority only", just not in "Total silence".
                    Log.w(TAG, "Could not enable Do Not Disturb bypass: ${e.message}")
                }
            }
            manager.createNotificationChannel(channel)
        } catch (e: Exception) {
            Log.e(TAG, "Could not create the alarm channel", e)
        }
    }

    /** `res/raw` sound the channel points at, used for the one-shot notification. */
    fun alarmSoundUri(context: Context): Uri =
        Uri.parse("android.resource://" + context.packageName + "/" + R.raw.alarm_sound)

    /** USAGE_ALARM is what makes the OS treat this as an alarm and not media. */
    fun alarmAudioAttributes(): AudioAttributes = AudioAttributes.Builder()
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .setUsage(AudioAttributes.USAGE_ALARM)
        .build()
}
