package com.mechseiko.suhoor.alarm

import android.app.KeyguardManager
import android.content.Context
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.mechseiko.suhoor.R
import java.util.Date

/**
 * Full-screen alarm activity
 * Shows when alarm triggers, wakes device, and provides dismiss/snooze options
 */
class AlarmActivity : AppCompatActivity() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var alarmData: AlarmData? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Set up full-screen flags to wake device and show on lock screen
        setupFullScreenFlags()

        setContentView(R.layout.alarm_activity)

        // Get alarm data from intent
        alarmData = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getSerializableExtra("alarm_data", AlarmData::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getSerializableExtra("alarm_data") as? AlarmData
        }

        // Initialize UI
        setupUI()

        // Acquire wake lock to keep device awake
        acquireWakeLock()

        // Start alarm sound and vibration
        startAlarmSound()
        startVibration()
    }

    override fun onDestroy() {
        super.onDestroy()
        stopAlarmSound()
        stopVibration()
        releaseWakeLock()
    }

    /**
     * Set up full-screen flags to wake device and show on lock screen
     */
    private fun setupFullScreenFlags() {
        // Turn screen on and show on lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }

        // Dismiss keyguard
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
        }

        // Keep screen on
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Set full screen
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )
    }

    /**
     * Set up UI elements
     */
    private fun setupUI() {
        val titleTextView = findViewById<TextView>(R.id.alarm_title)
        val timeTextView = findViewById<TextView>(R.id.alarm_time)
        val dismissButton = findViewById<Button>(R.id.dismiss_button)
        val snoozeButton = findViewById<Button>(R.id.snooze_button)

        titleTextView.text = when (alarmData?.type) {
            "wake_up" -> "WAKE UP! ⏰"
            "recheck" -> "Re-check Alarm ⏰"
            "remote_buzz" -> "Remote Buzz! 🔔"
            else -> "Alarm ⏰"
        }

        timeTextView.text = alarmData?.let { Date(it.triggerTime).toString() } ?: "Now"

        dismissButton.setOnClickListener {
            dismissAlarm()
        }

        snoozeButton.setOnClickListener {
            snoozeAlarm()
        }
    }

    /**
     * Acquire wake lock to keep device awake
     */
    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "Suhoor:AlarmWakeLock"
        ).apply {
            acquire(10 * 60 * 1000L) // 10 minutes
        }
    }

    /**
     * Release wake lock
     */
    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
            }
        }
        wakeLock = null
    }

    /**
     * Start alarm sound
     */
    private fun startAlarmSound() {
        try {
            mediaPlayer = MediaPlayer.create(this, R.raw.alarm_sound)
            mediaPlayer?.isLooping = true
            mediaPlayer?.start()
        } catch (e: Exception) {
            android.util.Log.e("AlarmActivity", "Error starting alarm sound", e)
        }
    }

    /**
     * Stop alarm sound
     */
    private fun stopAlarmSound() {
        mediaPlayer?.let {
            if (it.isPlaying) {
                it.stop()
            }
            it.release()
        }
        mediaPlayer = null
    }

    /**
     * Start vibration
     */
    private fun startVibration() {
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        // Vibrate pattern: 0ms delay, 500ms vibrate, 200ms pause, repeat
        val pattern = longArrayOf(0, 500, 200)
        vibrator?.vibrate(pattern, 0)
    }

    /**
     * Stop vibration
     */
    private fun stopVibration() {
        vibrator?.cancel()
        vibrator = null
    }

    /**
     * Dismiss the alarm
     */
    private fun dismissAlarm() {
        // Cancel notification
        val notificationManager = androidx.core.app.NotificationManagerCompat.from(this)
        notificationManager.cancel(AlarmReceiver.NOTIFICATION_ID)

        // Log wake-up time to Firestore (this would be done via React Native bridge)
        // For now, we'll just finish the activity
        finish()
    }

    /**
     * Snooze the alarm for 5 minutes
     */
    private fun snoozeAlarm() {
        alarmData?.let { data ->
            val snoozeTime = System.currentTimeMillis() + 5 * 60 * 1000 // 5 minutes

            val alarmManagerModule = AlarmManagerModule(this)
            alarmManagerModule.scheduleAlarm(
                alarmId = "${data.id}_snooze",
                triggerTime = snoozeTime,
                userId = data.userId,
                groupId = data.groupId,
                alarmType = "recheck"
            )
        }

        // Cancel current notification
        val notificationManager = androidx.core.app.NotificationManagerCompat.from(this)
        notificationManager.cancel(AlarmReceiver.NOTIFICATION_ID)

        finish()
    }
}
