package com.mechseiko.suhoor.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Re-arms every persisted alarm after an event that silently cancels them.
 *
 * Each of these used to leave the app claiming the alarm was set while Android
 * had already thrown it away:
 *
 *  - BOOT_COMPLETED / QUICKBOOT_POWERON — a reboot clears AlarmManager.
 *  - MY_PACKAGE_REPLACED — every Play Store update clears it. This was the most
 *    common way a user lost the alarm without doing anything.
 *  - TIME_SET / TIMEZONE_CHANGED — the stored epoch is still "correct", but it
 *    no longer matches the local time the user chose.
 *  - SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED — granting exact alarms in
 *    Settings does not restore alarms the system cancelled when it was revoked.
 *
 * All of the work is delegated to [AlarmManagerModule.restoreAllAlarms], which
 * recomputes each alarm from its wall-clock time of day rather than adding 24
 * hours. Nothing may throw out of onReceive: a crash here is a missed suhoor.
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"

        private const val ACTION_QUICKBOOT_POWERON = "android.intent.action.QUICKBOOT_POWERON"
        private const val ACTION_HTC_QUICKBOOT_POWERON = "com.htc.intent.action.QUICKBOOT_POWERON"
        private const val ACTION_EXACT_ALARM_PERMISSION_CHANGED =
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED"

        private val HANDLED_ACTIONS = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            // Sent while the device is still locked. This is the one that
            // matters here: BOOT_COMPLETED waits for the first unlock, which can
            // be hours after the alarm time. The alarm list lives in
            // device-protected storage precisely so it can be read this early.
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            ACTION_QUICKBOOT_POWERON,
            ACTION_HTC_QUICKBOOT_POWERON,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED, // android.intent.action.TIME_SET
            Intent.ACTION_TIMEZONE_CHANGED,
            ACTION_EXACT_ALARM_PERMISSION_CHANGED
        )
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == null || action !in HANDLED_ACTIONS) {
            Log.d(TAG, "Ignoring unrelated broadcast: $action")
            return
        }

        Log.d(TAG, "Re-arming alarms after $action")
        try {
            AlarmManagerModule(context.applicationContext).restoreAllAlarms()
            Log.d(TAG, "Alarm restoration complete")
        } catch (e: Throwable) {
            Log.e(TAG, "Alarm restoration failed after $action", e)
        }
    }
}
