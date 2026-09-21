package com.mechseiko.suhoor.alarm

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.ReactPackage

/**
 * React Native Bridge Module for Alarm Management
 * Provides thin bridge between React Native and native Android alarm engine
 * All alarm logic is handled by AlarmManagerModule in native layer
 */
class AlarmBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val alarmManagerModule = AlarmManagerModule(reactContext.applicationContext)

    override fun getName(): String {
        return "AlarmBridge"
    }

    @ReactMethod
    fun isBatteryOptimizationDisabled(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.resolve(true)
                return
            }
            val powerManager = reactApplicationContext.getSystemService(PowerManager::class.java)
            promise.resolve(powerManager?.isIgnoringBatteryOptimizations(reactApplicationContext.packageName) == true)
        } catch (e: Exception) {
            promise.reject("BATTERY_STATUS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openBatteryOptimizationSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:${reactApplicationContext.packageName}")
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("BATTERY_SETTINGS_ERROR", e.message, e)
        }
    }

    /**
     * Schedule a new alarm
     * @param alarmId Unique identifier for the alarm
     * @param triggerTime Time when alarm should trigger (timestamp in milliseconds)
     * @param userId User ID for logging purposes
     * @param groupId Group ID for logging purposes
     * @param alarmType Type of alarm (wake_up, recheck, remote_buzz)
     * @param promise Promise to resolve with success status
     */
    @ReactMethod
    fun scheduleAlarm(
        alarmId: String,
        triggerTime: Double,
        userId: String,
        groupId: String,
        alarmType: String,
        promise: Promise
    ) {
        try {
            val success = alarmManagerModule.scheduleAlarm(
                alarmId = alarmId,
                triggerTime = triggerTime.toLong(),
                userId = userId,
                groupId = groupId,
                alarmType = alarmType
            )

            if (success) {
                promise.resolve(true)
            } else {
                promise.reject("SCHEDULE_FAILED", "Failed to schedule alarm")
            }
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ERROR", e.message, e)
        }
    }

    /**
     * Update an existing alarm
     * @param alarmId ID of alarm to update
     * @param newTriggerTime New trigger time
     * @param promise Promise to resolve with success status
     */
    @ReactMethod
    fun updateAlarm(alarmId: String, newTriggerTime: Double, promise: Promise) {
        try {
            val success = alarmManagerModule.updateAlarm(
                alarmId = alarmId,
                newTriggerTime = newTriggerTime.toLong()
            )

            if (success) {
                promise.resolve(true)
            } else {
                promise.reject("UPDATE_FAILED", "Failed to update alarm")
            }
        } catch (e: Exception) {
            promise.reject("UPDATE_ERROR", e.message, e)
        }
    }

    /**
     * Cancel an alarm
     * @param alarmId ID of alarm to cancel
     * @param promise Promise to resolve with success status
     */
    @ReactMethod
    fun cancelAlarm(alarmId: String, promise: Promise) {
        try {
            val success = alarmManagerModule.cancelAlarm(alarmId)

            if (success) {
                promise.resolve(true)
            } else {
                promise.reject("CANCEL_FAILED", "Failed to cancel alarm")
            }
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }

    /**
     * Check if an alarm is scheduled
     * @param alarmId ID of alarm to check
     * @param promise Promise to resolve with boolean status
     */
    @ReactMethod
    fun isAlarmScheduled(alarmId: String, promise: Promise) {
        try {
            val isScheduled = alarmManagerModule.isAlarmScheduled(alarmId)
            promise.resolve(isScheduled)
        } catch (e: Exception) {
            promise.reject("CHECK_ERROR", e.message, e)
        }
    }

    /**
     * Get all scheduled alarms
     * @param promise Promise to resolve with list of alarms
     */
    @ReactMethod
    fun getAllAlarms(promise: Promise) {
        try {
            val alarms = alarmManagerModule.getAllAlarms()
            val alarmsArray = Arguments.createArray()

            alarms.forEach { alarm ->
                val alarmMap = Arguments.createMap().apply {
                    putString("id", alarm.id)
                    putDouble("triggerTime", alarm.triggerTime.toDouble())
                    putString("userId", alarm.userId)
                    putString("groupId", alarm.groupId)
                    putString("type", alarm.type)
                    putDouble("createdAt", alarm.createdAt.toDouble())
                }
                alarmsArray.pushMap(alarmMap)
            }

            promise.resolve(alarmsArray)
        } catch (e: Exception) {
            promise.reject("GET_ALARMS_ERROR", e.message, e)
        }
    }

    /**
     * Cancel all alarms
     * @param promise Promise to resolve with success status
     */
    @ReactMethod
    fun cancelAllAlarms(promise: Promise) {
        try {
            alarmManagerModule.cancelAllAlarms()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ALL_ERROR", e.message, e)
        }
    }

    /**
     * Check if exact alarm permission is granted (Android 12+)
     * @param promise Promise to resolve with permission status
     */
    @ReactMethod
    fun canScheduleExactAlarms(promise: Promise) {
        try {
            val alarmManager = reactApplicationContext.getSystemService(android.content.Context.ALARM_SERVICE) as android.app.AlarmManager
            val canSchedule = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                alarmManager.canScheduleExactAlarms()
            } else {
                true // Always true on Android < 12
            }
            promise.resolve(canSchedule)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", e.message, e)
        }
    }

    /**
     * Trigger a remote buzz alarm (for future Remote Buzz feature)
     * This will be called when FCM message is received
     * @param alarmId Unique identifier for the alarm
     * @param userId User ID being buzzed
     * @param groupId Group ID the buzz is from
     * @param buzzerId User ID who sent the buzz
     * @param promise Promise to resolve with success status
     */
    @ReactMethod
    fun triggerRemoteBuzz(
        alarmId: String,
        userId: String,
        groupId: String,
        buzzerId: String,
        promise: Promise
    ) {
        try {
            // Schedule immediate alarm for remote buzz
            val triggerTime = System.currentTimeMillis() + 1000 // 1 second from now

            val success = alarmManagerModule.scheduleAlarm(
                alarmId = alarmId,
                triggerTime = triggerTime,
                userId = userId,
                groupId = groupId,
                alarmType = "remote_buzz"
            )

            if (success) {
                promise.resolve(true)
            } else {
                promise.reject("REMOTE_BUZZ_FAILED", "Failed to trigger remote buzz")
            }
        } catch (e: Exception) {
            promise.reject("REMOTE_BUZZ_ERROR", e.message, e)
        }
    }

    companion object {
        const val NAME = "AlarmBridge"
    }
}

/**
 * Package for registering the module
 */
class AlarmBridgePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): MutableList<NativeModule> {
        return mutableListOf(AlarmBridgeModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): MutableList<ViewManager<*, *>> {
        return mutableListOf()
    }
}
