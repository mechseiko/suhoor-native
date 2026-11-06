package com.mechseiko.suhoor.alarm

import android.content.Context

/**
 * Per-group "mute wake-up buzzes" preference.
 *
 * The toggle lives on the phone, not the group document: muting is a personal
 * choice, not an admin setting. It has to be readable from native code because a
 * buzz can arrive two ways — the live socket (handled in JS, which calls
 * triggerRemoteBuzz) and FCM (handled entirely in SuhoorMessagingService) — and
 * both must respect it.
 */
object MutedGroups {

    private const val PREFS = "suhoor_muted_groups"
    private const val KEY = "group_ids"

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    @Synchronized
    fun setMuted(context: Context, groupId: String, muted: Boolean) {
        if (groupId.isBlank()) return
        val current = prefs(context).getStringSet(KEY, emptySet())?.toMutableSet() ?: mutableSetOf()
        if (muted) current.add(groupId) else current.remove(groupId)
        prefs(context).edit().putStringSet(KEY, current).apply()
    }

    @Synchronized
    fun isMuted(context: Context, groupId: String?): Boolean {
        if (groupId.isNullOrBlank()) return false
        return prefs(context).getStringSet(KEY, emptySet())?.contains(groupId) == true
    }

    @Synchronized
    fun all(context: Context): List<String> =
        prefs(context).getStringSet(KEY, emptySet())?.toList() ?: emptyList()
}
