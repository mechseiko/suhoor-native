package com.mechseiko.suhoor.alarm

import android.content.Context

/**
 * A buzz can arrive twice: once over the live socket and once over FCM (the
 * server always pushes, because a socket entry can be stale). Both carry the
 * same `alarmId`, so recording what we already rang lets us ignore the second
 * delivery instead of ringing twice.
 */
object BuzzDedupe {

    private const val PREFS = "suhoor_buzz_dedupe"
    private const val WINDOW_MS = 5 * 60 * 1000L

    /** Returns true if this alarmId was already handled (and should be skipped). */
    @Synchronized
    fun isDuplicate(context: Context, alarmId: String?): Boolean {
        if (alarmId.isNullOrBlank()) return false
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val previous = prefs.getLong(alarmId, 0L)

        // Prune old ids so the file cannot grow forever.
        prefs.edit().apply {
            prefs.all.forEach { (key, value) ->
                if (value is Long && now - value > WINDOW_MS) remove(key)
            }
        }.apply()

        if (previous > 0 && now - previous < WINDOW_MS) return true

        prefs.edit().putLong(alarmId, now).apply()
        return false
    }
}
