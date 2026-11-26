package com.mechseiko.suhoor.alarm

import android.content.Context
import com.mechseiko.suhoor.R

/**
 * Resolves an alarm sound name to an R.raw id.
 *
 * Release builds run shrinkResources, which obfuscates res/raw file names —
 * resources.getIdentifier("alarm_sound_apex", "raw", pkg) returns 0 there, so
 * sound previews failed and the alarm service silently fell back to the
 * default track. Mapping the known names to R.raw fields directly is
 * compile-time safe and unaffected by obfuscation.
 */
object AlarmSounds {
    private const val DEFAULT_BOOST_MB = 500

    /**
     * How much louder each bundled tone plays, in millibels (100 mB = 1 dB).
     *
     * Thunder and Pulse were too gentle to wake someone and Chime was
     * borderline. The boost is applied at playback with LoudnessEnhancer rather
     * than by re-encoding the assets, so the same values apply to the settings
     * preview and to the ring — what the user auditions is what rings. Past
     * roughly +9 dB a phone speaker starts to clip into distortion, which is why
     * nothing goes above it.
     */
    fun boostMb(name: String?): Int = when {
        name == null -> DEFAULT_BOOST_MB
        name.contains("thunder", ignoreCase = true) -> 900
        name.contains("pulse", ignoreCase = true) -> 850
        name.contains("soft", ignoreCase = true) -> 600
        name.contains("apex", ignoreCase = true) -> 450
        name.contains("inferno", ignoreCase = true) -> 350
        else -> DEFAULT_BOOST_MB
    }

    fun resId(context: Context, name: String?): Int {
        return when (name?.trim()) {
            "alarm_sound_apex" -> R.raw.alarm_sound_apex
            "alarm_sound_soft" -> R.raw.alarm_sound_soft
            "alarm_sound_pulse" -> R.raw.alarm_sound_pulse
            "alarm_sound_inferno" -> R.raw.alarm_sound_inferno
            "alarm_sound_thunder" -> R.raw.alarm_sound_thunder
            "alarm_sound", null, "" -> R.raw.alarm_sound
            else -> {
                // Unknown name: runtime lookup still works in debug builds
                // where resources are not obfuscated; otherwise default.
                val id = context.resources.getIdentifier(name, "raw", context.packageName)
                if (id != 0) id else R.raw.alarm_sound
            }
        }
    }
}
