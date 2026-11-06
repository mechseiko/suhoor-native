package com.mechseiko.suhoor

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.mechseiko.suhoor.alarm.AlarmTriggerBus

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    setupLockScreenFlags()
    publishAlarmTrigger()
  }

  override fun onNewIntent(intent: android.content.Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
    setupLockScreenFlags()
    publishAlarmTrigger()
  }

  /**
   * The alarm screen ("Enter PIN") and the alarm notification both open this
   * activity with `alarm_trigger`. Park it for JS to consume so AlarmOverlay
   * can request the PIN while the alarm is still ringing.
   */
  private fun publishAlarmTrigger() {
    if (intent?.getBooleanExtra("alarm_trigger", false) == true) {
      AlarmTriggerBus.set(
        intent?.getStringExtra("alarm_id"),
        intent?.getStringExtra("alarm_type")
      )
    }
  }

  private fun setupLockScreenFlags() {
    if (intent?.getBooleanExtra("alarm_trigger", false) == true) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        setShowWhenLocked(true)
        setTurnScreenOn(true)
      } else {
        @Suppress("DEPRECATION")
        window.addFlags(
          android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          android.view.WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
          android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )
      }
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return DefaultReactActivityDelegate(
      this,
      mainComponentName,
      fabricEnabled
    )
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
