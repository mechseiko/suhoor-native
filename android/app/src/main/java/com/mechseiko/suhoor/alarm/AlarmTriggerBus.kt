package com.mechseiko.suhoor.alarm

/**
 * One-slot hand-off between the native alarm screens and the React Native app.
 *
 * When the user taps "Enter PIN" on [AlarmActivity] (or taps the alarm
 * notification), [MainActivity] stores the trigger here. JS calls
 * `AlarmBridge.consumeAlarmTrigger()` after mount / on resume and opens the
 * PIN overlay. A single slot is enough: only one alarm rings at a time, and
 * the value is consumed on read.
 */
object AlarmTriggerBus {

    private var pendingAlarmId: String? = null
    private var pendingAlarmType: String? = null

    @Synchronized
    fun set(alarmId: String?, alarmType: String?) {
        pendingAlarmId = alarmId
        pendingAlarmType = alarmType
    }

    /** Returns [alarmId, alarmType] once, then clears the slot. */
    @Synchronized
    fun consume(): Pair<String?, String?>? {
        if (pendingAlarmId == null && pendingAlarmType == null) return null
        val result = pendingAlarmId to pendingAlarmType
        pendingAlarmId = null
        pendingAlarmType = null
        return result
    }
}
