package com.mechseiko.suhoor.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * BroadcastReceiver that handles device boot events
 * Restores all scheduled alarms after device reboot
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || 
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            
            Log.d(TAG, "Device booted, restoring alarms")
            
            // Restore all alarms
            val alarmManagerModule = AlarmManagerModule(context)
            alarmManagerModule.restoreAllAlarms()
            
            Log.d(TAG, "Alarm restoration complete")
        }
    }
}
