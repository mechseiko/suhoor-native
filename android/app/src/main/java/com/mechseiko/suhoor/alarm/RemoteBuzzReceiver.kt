package com.mechseiko.suhoor.alarm

import android.content.Intent
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.google.gson.Gson

/**
 * Firebase Cloud Messaging Service for Remote Buzz
 * Receives FCM messages from other users to trigger wake-up alarms
 * This allows remote buzz to work even when the React Native runtime is not active
 */
class RemoteBuzzReceiver : FirebaseMessagingService() {

    companion object {
        private const val TAG = "RemoteBuzzReceiver"
        private const val ACTION_REMOTE_BUZZ = "com.mechseiko.suhoor.REMOTE_BUZZ"
    }

    private val gson = Gson()

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "FCM message received")

        // Check if this is a remote buzz message
        val data = remoteMessage.data
        val messageType = data["type"]

        if (messageType == "remote_buzz") {
            handleRemoteBuzz(data)
        }
    }

    /**
     * Handle remote buzz message
     * Triggers alarm without requiring React Native runtime
     */
    private fun handleRemoteBuzz(data: Map<String, String>) {
        try {
            val userId = data["userId"] ?: return
            val groupId = data["groupId"] ?: return
            val buzzerId = data["buzzerId"] ?: return
            val buzzerName = data["buzzerName"] ?: "Someone"

            Log.d(TAG, "Remote buzz from $buzzerName to user $userId")

            // Generate unique alarm ID for this buzz
            val alarmId = "remote_buzz_${userId}_${groupId}_${System.currentTimeMillis()}"

            // Trigger immediate alarm using AlarmManagerModule
            val alarmManagerModule = AlarmManagerModule(applicationContext)
            val triggerTime = System.currentTimeMillis() + 1000 // 1 second from now

            val success = alarmManagerModule.scheduleAlarm(
                alarmId = alarmId,
                triggerTime = triggerTime,
                userId = userId,
                groupId = groupId,
                alarmType = "remote_buzz"
            )

            if (success) {
                Log.d(TAG, "Remote buzz alarm triggered successfully")
            } else {
                Log.e(TAG, "Failed to trigger remote buzz alarm")
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error handling remote buzz", e)
        }
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "FCM token refreshed: $token")
        // Send new token to Firestore via React Native when app is next opened
        // This will be handled by the React Native layer
    }
}
