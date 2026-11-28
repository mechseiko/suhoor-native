package com.mechseiko.suhoor.alarm

import android.content.Context
import android.util.Log

/**
 * The hard stop for the night: 15 minutes before suhoor ends.
 *
 * An alarm that nobody dismissed — the user slept through it, or the buzz came
 * from a friend at an awkward moment — must not keep ringing past the point
 * where it is still useful. Suhoor ending is that point, minus a quarter of an
 * hour so there is still time to eat.
 *
 * The cutoff is computed in the app, because that is where the fasting-times API
 * lives, and stored here in device-protected preferences. Native components read
 * it directly, so the stop works with the app closed, before the first unlock,
 * and for a buzz that arrived over FCM with no JS running.
 *
 * A cutoff of 0 means "not known", and everything falls back to the previous
 * behaviour: the alarm rings until it is dismissed.
 */
object AlarmCutoff {

    private const val TAG = "AlarmCutoff"
    private const val PREFS = "suhoor_alarm_cutoff"
    private const val KEY_CUTOFF_MS = "cutoff_ms"

    private fun prefs(context: Context) =
        context.applicationContext
            .createDeviceProtectedStorageContext()
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Stores tonight's cutoff (epoch ms), or 0 to clear it. */
    fun set(context: Context, cutoffMs: Long) {
        try {
            prefs(context).edit().putLong(KEY_CUTOFF_MS, cutoffMs.coerceAtLeast(0L)).apply()
            Log.d(TAG, "Cutoff set to $cutoffMs")
        } catch (e: Exception) {
            Log.w(TAG, "Could not store the cutoff: ${e.message}")
        }
    }

    /** Tonight's cutoff (epoch ms), or 0 when unknown. */
    fun get(context: Context): Long {
        return try {
            prefs(context).getLong(KEY_CUTOFF_MS, 0L)
        } catch (e: Exception) {
            Log.w(TAG, "Could not read the cutoff: ${e.message}")
            0L
        }
    }

    /** True when a cutoff is known and has already passed. */
    fun hasPassed(context: Context, now: Long = System.currentTimeMillis()): Boolean {
        val cutoff = get(context)
        return cutoff > 0L && now >= cutoff
    }

    /**
     * True when the cutoff is still in the future *and* close enough to be
     * tonight's. A stale value from a previous night is ignored, so a cutoff is
     * never enforced 20 hours later.
     */
    fun isActiveTonight(context: Context, now: Long = System.currentTimeMillis()): Boolean {
        val cutoff = get(context)
        if (cutoff <= 0L) return false
        val twelveHours = 12L * 60L * 60L * 1000L
        return cutoff > now && cutoff - now <= twelveHours
    }

    /** Milliseconds until the cutoff, or -1 when there is nothing to wait for. */
    fun remainingMs(context: Context, now: Long = System.currentTimeMillis()): Long {
        if (!isActiveTonight(context, now)) return -1L
        return get(context) - now
    }
}
