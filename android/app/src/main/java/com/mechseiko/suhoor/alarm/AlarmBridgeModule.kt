package com.mechseiko.suhoor.alarm

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
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
     * @param alarmType Type of alarm (wake_up, remote_buzz)
     * @param promise Promise to resolve with success status
     */
    @ReactMethod
    fun scheduleAlarm(
        alarmId: String,
        triggerTime: Double,
        userId: String,
        groupId: String,
        alarmType: String,
        soundName: String,
        volume: Double,
        promise: Promise
    ) {
        try {
            val success = alarmManagerModule.scheduleAlarm(
                alarmId = alarmId,
                triggerTime = triggerTime.toLong(),
                userId = userId,
                groupId = groupId,
                alarmType = alarmType,
                soundName = soundName,
                volume = volume.toFloat()
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
     * Is AlarmManager still holding this alarm?
     *
     * Different from [isAlarmScheduled], which only checks the persisted list:
     * that list survives a force-stop or an OEM cleanup, so it reports "armed"
     * for an alarm the system already dropped. Used by the JS self-heal on app
     * start.
     */
    @ReactMethod
    fun isAlarmArmed(alarmId: String, promise: Promise) {
        try {
            promise.resolve(alarmManagerModule.isAlarmArmed(alarmId))
        } catch (e: Exception) {
            promise.reject("ARMED_STATE_ERROR", e.message, e)
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
    /**
     * True while the foreground service is looping an alarm on the alarm
     * stream. AlarmOverlay uses it to decide whether it still needs to start a
     * ring: the service is the one that survives silent/DND, so the JS overlay
     * must not stop it and re-play on the media stream.
     */
    @ReactMethod
    fun isAlarmRinging(promise: Promise) {
        try {
            promise.resolve(AlarmForegroundService.isRunning)
        } catch (e: Exception) {
            promise.reject("ALARM_STATE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopAlarmService(promise: Promise) {
        try {
            AlarmForegroundService.stopService(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_SERVICE_ERROR", e.message, e)
        }
    }

    private var previewPlayer: MediaPlayer? = null
    private var previewFocusRequest: AudioFocusRequest? = null

    /**
     * Play a looping preview of a bundled alarm sound (settings picker).
     *
     * Deliberately mirrors AlarmForegroundService.startAlarmSound(): same
     * R.raw track, USAGE_ALARM audio attributes, alarm stream at full volume
     * and audio focus. The previous version relied on the deprecated
     * MediaPlayer.setAudioStreamType() after MediaPlayer.create(), which does
     * not re-route an already-prepared player: the preview played on the media
     * stream (silent whenever media volume is down, e.g. phone on vibrate)
     * while real alarms, which use the alarm stream, still rang.
     */
    @ReactMethod
    fun playSoundPreview(soundName: String, promise: Promise) {
        try {
            stopSoundPreviewInternal()

            val context = reactApplicationContext
            val resId = AlarmSounds.resId(context, soundName)
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            // The real alarm forces the alarm stream to its maximum, so a
            // preview at a lower level would not represent what the user hears.
            // Best-effort: a locked-down device must not turn this into a
            // failed preview.
            try {
                val maxAlarmVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
                if (audioManager.getStreamVolume(AudioManager.STREAM_ALARM) < maxAlarmVolume) {
                    audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxAlarmVolume, 0)
                }
            } catch (_: Exception) {}

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(attributes)
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener({ })
                    .build()
                previewFocusRequest = focusRequest
                audioManager.requestAudioFocus(focusRequest)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_ALARM,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
                )
            }

            // Attributes must be set before prepare(): after prepare the player
            // has already chosen its output stream.
            val afd = context.resources.openRawResourceFd(resId)
                ?: throw IllegalStateException("Sound $soundName cannot be streamed")

            val player = MediaPlayer()
            try {
                afd.use {
                    player.setDataSource(it.fileDescriptor, it.startOffset, it.length)
                }
                player.setAudioAttributes(attributes)
                player.isLooping = true
                player.setVolume(1.0f, 1.0f)
                player.prepare()
                player.start()
            } catch (e: Exception) {
                try { player.release() } catch (_: Exception) {}
                throw e
            }

            previewPlayer = player
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("AlarmBridge", "Sound preview failed for $soundName", e)
            stopSoundPreviewInternal()
            promise.reject("SOUND_PREVIEW_ERROR", e.message ?: "Could not play sound preview", e)
        }
    }

    @ReactMethod
    fun stopSoundPreview(promise: Promise) {
        try {
            stopSoundPreviewInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SOUND_PREVIEW_ERROR", e.message, e)
        }
    }

    private fun stopSoundPreviewInternal() {
        try {
            previewPlayer?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
        } catch (_: Exception) {}
        previewPlayer = null

        try {
            val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                previewFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
        } catch (_: Exception) {}
        previewFocusRequest = null
    }

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
            // A muted group must not be able to buzz this device at all.
            if (MutedGroups.isMuted(reactApplicationContext, groupId)) {
                Log.d("AlarmBridge", "Buzz from muted group ignored: $groupId")
                promise.resolve(true)
                return
            }

            // The server also pushes the same buzz over FCM. Whichever arrives
            // first rings; the other is dropped here.
            if (BuzzDedupe.isDuplicate(reactApplicationContext, alarmId)) {
                promise.resolve(true)
                return
            }

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

    /**
     * Android 14+ can revoke USE_FULL_SCREEN_INTENT. When it is off the alarm
     * notification degrades to a heads-up and never covers the lock screen.
     */
    @ReactMethod
    fun canUseFullScreenIntent(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                val nm = reactApplicationContext.getSystemService(android.app.NotificationManager::class.java)
                promise.resolve(nm?.canUseFullScreenIntent() == true)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("FSI_CHECK_ERROR", e.message, e)
        }
    }

    /**
     * Is "Display over other apps" available for launching the alarm screen?
     *
     * Android 10 (API 29) is where background activity starts were restricted,
     * so below it the permission buys nothing and the check reports true — the
     * onboarding step that requires it must not force a pointless permission on
     * Android 7-9. From 10 up it is a real app-op the user has to switch on.
     */
    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                promise.resolve(true) // no background-activity-start restriction yet
                return
            }
            promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
        } catch (e: Exception) {
            promise.reject("OVERLAY_STATUS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openOverlaySettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${reactApplicationContext.packageName}")
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OVERLAY_SETTINGS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openFullScreenIntentSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                    Uri.parse("package:${reactApplicationContext.packageName}")
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("FSI_SETTINGS_ERROR", e.message, e)
        }
    }

    /**
     * Android 12+ needs the "Alarms & reminders" special access for
     * setExactAndAllowWhileIdle. Without it scheduleAlarm() fails silently.
     */
    @ReactMethod
    fun openExactAlarmSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val intent = Intent(
                    Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:${reactApplicationContext.packageName}")
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("EXACT_ALARM_SETTINGS_ERROR", e.message, e)
        }
    }

    /** FCM registration token, used for background buzz delivery. */
    @ReactMethod
    fun getFcmToken(promise: Promise) {
        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().token
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        promise.resolve(task.result)
                    } else {
                        promise.reject("FCM_TOKEN_ERROR", task.exception?.message ?: "no token", task.exception)
                    }
                }
        } catch (e: Exception) {
            promise.reject("FCM_TOKEN_ERROR", e.message, e)
        }
    }

    /**
     * Fully restarts the app process.
     *
     * Needed after I18nManager.forceRTL(): the layout direction is read at
     * process start, so a JS reload is not enough. Without this, switching
     * Urdu -> English left the UI RTL until the user killed the app by hand.
     */
    @ReactMethod
    fun restartApp() {
        try {
            val context = reactApplicationContext
            val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            if (intent != null) {
                context.startActivity(intent)
            }
        } catch (e: Exception) {
            Log.e("AlarmBridge", "restartApp failed", e)
        }
        android.os.Process.killProcess(android.os.Process.myPid())
    }

    /** Mute/unmute wake-up buzzes coming from one group (stored natively). */
    @ReactMethod
    fun setMutedGroup(groupId: String, muted: Boolean, promise: Promise) {
        try {
            MutedGroups.setMuted(reactApplicationContext, groupId, muted)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("MUTE_ERROR", e.message, e)
        }
    }

    /** Muted group ids, so JS can restore its toggles from one source. */
    @ReactMethod
    fun getMutedGroups(promise: Promise) {
        try {
            val array = Arguments.createArray()
            MutedGroups.all(reactApplicationContext).forEach { array.pushString(it) }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("MUTE_LIST_ERROR", e.message, e)
        }
    }

    /**
     * Reads the pending native alarm trigger WITHOUT consuming it.
     *
     * Safe to call on every mount and every resume: it keeps returning the same
     * trigger until JS calls [clearAlarmTrigger], so a read that gets dropped
     * (effect teardown, remount, reload) cannot leave a ringing alarm with no
     * dismiss screen. Resolves null when nothing is pending.
     */
    @ReactMethod
    fun consumeAlarmTrigger(promise: Promise) {
        try {
            val trigger = AlarmTriggerBus.peek()
            if (trigger == null) {
                promise.resolve(null)
                return
            }
            val map = Arguments.createMap().apply {
                putString("alarmId", trigger.first)
                putString("alarmType", trigger.second)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("ALARM_TRIGGER_ERROR", e.message, e)
        }
    }

    /** Acknowledges the trigger once the PIN overlay has been shown. */
    @ReactMethod
    fun clearAlarmTrigger(promise: Promise) {
        try {
            AlarmTriggerBus.clear()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ALARM_TRIGGER_ERROR", e.message, e)
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
