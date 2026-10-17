package com.mechseiko.suhoor.alarm

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
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
import com.google.gson.Gson
import com.mechseiko.suhoor.MainActivity
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
    private var audioFocusRequest: AudioFocusRequest? = null
    private val gson = Gson()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Set up full-screen flags to wake device and show on lock screen
        setupFullScreenFlags()

        setContentView(R.layout.alarm_activity)

        // Get alarm data from intent (now as JSON string)
        val alarmDataJson = intent.getStringExtra("alarm_data")
        alarmData = alarmDataJson?.let {
            try {
                gson.fromJson(it, AlarmData::class.java)
            } catch (e: Exception) {
                android.util.Log.e("AlarmActivity", "Error parsing alarm data", e)
                null
            }
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
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            keyguardManager?.requestDismissKeyguard(this, null)
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
        val enterPinButton = findViewById<Button>(R.id.enter_pin_button)
        val alarmRoot = findViewById<View>(R.id.alarm_root)

        titleTextView?.text = when (alarmData?.type) {
            "wake_up" -> "Wake Up, It's time for suhoor"
            "recheck" -> "You haven't checked in, check in now to stop being buzzed"
            "remote_buzz" -> "A member of your group is buzzing you"
            else -> "Alarm"
        }

        timeTextView?.text = alarmData?.let { Date(it.triggerTime).toString() } ?: "Now"

        enterPinButton?.setOnClickListener {
            openAppForPin()
        }

        alarmRoot?.setOnClickListener {
            openAppForPin()
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
            
            // Set audio stream type to alarm for maximum volume
            mediaPlayer?.setAudioStreamType(AudioManager.STREAM_ALARM)
            
            // Set volume to maximum
            val audioManager = getSystemService(AudioManager::class.java)
            val maxVolume = audioManager?.getStreamMaxVolume(AudioManager.STREAM_ALARM) ?: 1
            mediaPlayer?.setVolume(1.0f, 1.0f)
            
            // Request audio focus for alarm
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener({ })
                    .build()
                
                audioManager?.requestAudioFocus(audioFocusRequest!!)
            } else {
                @Suppress("DEPRECATION")
                audioManager?.requestAudioFocus(
                    { },
                    AudioManager.STREAM_ALARM,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
                )
            }
            
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
        
        // Abandon audio focus
        val audioManager = getSystemService(AudioManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let {
                audioManager?.abandonAudioFocusRequest(it)
            }
        } else {
            @Suppress("DEPRECATION")
            audioManager?.abandonAudioFocus({ })
        }
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
     * Stop native sound & vibration and open the React Native app (MainActivity)
     * where the user is required to enter their 4-digit PIN in AlarmOverlay to dismiss.
     */
    private fun openAppForPin() {
        stopAlarmSound()
        stopVibration()
        releaseWakeLock()

        val notificationManager = androidx.core.app.NotificationManagerCompat.from(this)
        notificationManager.cancel(AlarmReceiver.NOTIFICATION_ID)

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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            keyguardManager?.requestDismissKeyguard(this, object : KeyguardManager.KeyguardDismissCallback() {
                override fun onDismissSucceeded() {
                    startActivity(launchIntent)
                    finish()
                }
                override fun onDismissError() {
                    startActivity(launchIntent)
                    finish()
                }
                override fun onDismissCancelled() {
                    startActivity(launchIntent)
                    finish()
                }
            }) ?: run {
                startActivity(launchIntent)
                finish()
            }
        } else {
            startActivity(launchIntent)
            finish()
        }
    }
}
