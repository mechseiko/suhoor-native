package com.mechseiko.suhoor.alarm

/**
 * One-slot hand-off between the native alarm screens and the React Native app.
 *
 * When the user taps "Enter PIN" on [AlarmActivity] (or taps the alarm
 * notification), [MainActivity] stores the trigger here. JS reads it after mount
 * and on every resume, and clears it once the PIN overlay has been shown.
 *
 * The read is deliberately non-destructive. It used to clear on read, which
 * meant a single lost read — the effect being torn down between the call and
 * its result, a remount, a reload — destroyed the only pointer the app had to
 * the alarm that was still ringing. The alarm then rang with no dismiss screen
 * and no way to stop it. Clearing is now an explicit acknowledgement, so a
 * missed read costs nothing: the next resume sees the same trigger again.
 */
object AlarmTriggerBus {

    private var pendingAlarmId: String? = null
    private var pendingAlarmType: String? = null

    @Synchronized
    fun set(alarmId: String?, alarmType: String?) {
        pendingAlarmId = alarmId
        pendingAlarmType = alarmType
    }

    /** True while a trigger is waiting for JS to show the PIN overlay. */
    @Synchronized
    fun hasPending(): Boolean = pendingAlarmId != null || pendingAlarmType != null

    /** Reads the trigger without consuming it. */
    @Synchronized
    fun peek(): Pair<String?, String?>? {
        if (pendingAlarmId == null && pendingAlarmType == null) return null
        return pendingAlarmId to pendingAlarmType
    }

    /** Called by JS once the overlay is shown or the alarm is dismissed. */
    @Synchronized
    fun clear() {
        pendingAlarmId = null
        pendingAlarmType = null
    }
}
