package com.mechseiko.suhoor.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.gson.Gson
import com.mechseiko.suhoor.MainActivity
import com.mechseiko.suhoor.R

class AlarmForegroundService : Service() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var audioFocusRequest: AudioFocusRequest? = null

    companion object {
        private const val TAG = "AlarmForegroundService"
        private const val CHANNEL_ID = AlarmChannels.ID
        private const val NOTIFICATION_ID = 2001
        const val ACTION_PLAY_ALARM = "com.mechseiko.suhoor.PLAY_ALARM"
        const val ACTION_STOP_ALARM = "com.mechseiko.suhoor.STOP_ALARM"
        const val EXTRA_ALARM_DATA = "alarm_data"

        /** True while the service is ringing. Read by AlarmActivity so the two
         *  never play the same loop on top of each other. */
        @Volatile
        var isRunning: Boolean = false

        fun startAlarm(context: Context, alarmData: AlarmData) {
            val gson = Gson()
            val intent = Intent(context, AlarmForegroundService::class.java).apply {
                action = ACTION_PLAY_ALARM
                putExtra(EXTRA_ALARM_DATA, gson.toJson(alarmData))
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            // Nothing to stop. Calling startService() from the background just to
            // deliver a STOP action throws on Android 8+.
            if (!isRunning) return
            try {
                val intent = Intent(context, AlarmForegroundService::class.java).apply {
                    action = ACTION_STOP_ALARM
                }
                context.startService(intent)
            } catch (e: Exception) {
                Log.w(TAG, "stopService failed, stopping directly", e)
                context.stopService(Intent(context, AlarmForegroundService::class.java))
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY_ALARM -> {
                val alarmDataJson = intent.getStringExtra(EXTRA_ALARM_DATA)
                val alarmData = try {
                    if (alarmDataJson != null) Gson().fromJson(alarmDataJson, AlarmData::class.java) else null
                } catch (e: Exception) {
                    null
                }
                isRunning = true
                acquireWakeLock()
                startForegroundAlarmNotification(alarmData)
                startAlarmSound(alarmData)
                startVibration()
            }
            ACTION_STOP_ALARM -> {
                stopAlarmSound()
                stopVibration()
                releaseWakeLock()
                stopForeground(true)
                isRunning = false
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "Suhoor:AlarmServiceWakeLock"
            ).apply {
                acquire(15 * 60 * 1000L) // 15 mins max
            }
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        wakeLock = null
    }

    private fun startForegroundAlarmNotification(alarmData: AlarmData?) {
        createNotificationChannel()

        val fullScreenIntent = Intent(this, AlarmActivity::class.java).apply {
            putExtra("alarm_id", alarmData?.id ?: "suhoor_alarm")
            putExtra("alarm_data", if (alarmData != null) Gson().toJson(alarmData) else "")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val pFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            (alarmData?.id ?: "alarm").hashCode(),
            fullScreenIntent,
            pFlags
        )

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("alarm_trigger", true)
            putExtra("alarm_id", alarmData?.id)
            putExtra("alarm_type", alarmData?.type)
        } ?: Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("alarm_trigger", true)
            putExtra("alarm_id", alarmData?.id)
            putExtra("alarm_type", alarmData?.type)
        }
        val contentPendingIntent = PendingIntent.getActivity(
            this,
            ((alarmData?.id ?: "alarm") + "_content").hashCode(),
            launchIntent,
            pFlags
        )

        val title = if (alarmData?.type == "remote_buzz") {
            getString(R.string.alarm_buzz_notification_title)
        } else {
            getString(R.string.alarm_notification_title)
        }
        val message = if (alarmData?.type == "remote_buzz") {
            getString(R.string.alarm_buzz_notification_text)
        } else {
            getString(R.string.alarm_notification_text)
        }

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(contentPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        // Shared definition: importance, USAGE_ALARM sound, lock-screen
        // visibility and the Do Not Disturb bypass all live in AlarmChannels.
        AlarmChannels.ensure(this)
    }

    private fun startAlarmSound(alarmData: AlarmData?) {
        if (mediaPlayer != null) return
        try {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

            // Force STREAM_ALARM to its maximum so the alarm is loud even when
            // the user left the alarm slider low.
            //
            // In its own try/catch on purpose: setStreamVolume throws
            // SecurityException on some builds when the change would trip a Do
            // Not Disturb restriction, and this used to be inside the same try
            // as everything below — a refused volume change silently killed the
            // whole ring.
            try {
                val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
                if (audioManager.getStreamVolume(AudioManager.STREAM_ALARM) < maxVolume) {
                    audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVolume, 0)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Could not raise the alarm stream volume: ${e.message}")
            }

            // Request audio focus on the STREAM_ALARM channel
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setLegacyStreamType(AudioManager.STREAM_ALARM)
                            .build()
                    )
                    .setAcceptsDelayedFocusGain(false)
                    .build()
                audioFocusRequest = focusRequest
                audioManager.requestAudioFocus(focusRequest)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN)
            }

            // Play whatever the user picked in Settings -> Alarm sound.
            // AlarmSounds maps known names to R.raw fields directly because
            // shrinkResources obfuscates raw names and getIdentifier() fails.
            val requested = alarmData?.soundName ?: ""
            val track = AlarmSounds.resId(this, requested)

            // Alarms persisted by an older build deserialize volume as 0 with no
            // soundName. Only trust volume when we wrote it alongside a sound.
            val explicitVolume =
                if (alarmData != null && !alarmData.soundName.isNullOrBlank()) alarmData.volume else -1f
            val volume =
                if (explicitVolume >= 0f) explicitVolume.coerceIn(0f, 1f) else 1.0f
            if (volume <= 0.001f) {
                // The user turned "Audible alarms" off. Honor it, but say so
                // loudly in the log: a silent alarm is almost always a mistake.
                Log.w(TAG, "Playing the alarm at volume 0 — audible alarms are disabled in preferences")
            }

            // MediaPlayer.create() returns null (no exception) when the file
            // cannot be decoded, which silently produced a silent alarm. Fall
            // back to the system alarm ringtone, the only guaranteed sound.
            var player = MediaPlayer.create(this, track)
            if (player == null) {
                Log.w(TAG, "Could not decode res/raw sound '$requested' — falling back to the system alarm ringtone")
                player = createSystemAlarmRingtonePlayer()
            }
            if (player == null) {
                Log.e(TAG, "No alarm audio could be prepared; the alarm will vibrate only")
                return
            }

            mediaPlayer = player.apply {
                isLooping = true
                try {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setLegacyStreamType(AudioManager.STREAM_ALARM)
                            .build()
                    )
                } catch (e: Exception) {
                    Log.w(TAG, "Could not set alarm audio attributes: ${e.message}")
                }
                setVolume(volume, volume)
                start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting alarm sound in foreground service", e)
        }
    }

    /**
     * Last-resort audio: the device's own alarm ringtone.
     *
     * A phone that cannot decode the bundled asset still has to wake the user,
     * and every Android build ships a default alarm tone.
     */
    private fun createSystemAlarmRingtonePlayer(): MediaPlayer? {
        return try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                ?: return null
            MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@AlarmForegroundService, uri)
                isLooping = true
                prepare()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Could not prepare the system alarm ringtone", e)
            null
        }
    }

    private fun stopAlarmSound() {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping media player", e)
        }
        mediaPlayer = null

        // Abandon audio focus
        try {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
                audioFocusRequest = null
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error abandoning audio focus", e)
        }
    }

    private fun startVibration() {
        if (vibrator != null) return
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            val pattern = longArrayOf(0, 800, 400, 800)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting vibration in foreground service", e)
        }
    }

    private fun stopVibration() {
        try {
            vibrator?.cancel()
        } catch (e: Exception) {}
        vibrator = null
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        stopAlarmSound()
        stopVibration()
        releaseWakeLock()
    }
}
