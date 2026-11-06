package com.mechseiko.suhoor.push

import android.content.Intent
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.google.gson.Gson
import com.mechseiko.suhoor.alarm.AlarmData
import com.mechseiko.suhoor.alarm.AlarmReceiver
import com.mechseiko.suhoor.alarm.BuzzDedupe
import com.mechseiko.suhoor.alarm.MutedGroups

/**
 * Receives group "buzzes" while the app is closed or the socket is gone.
 *
 * The socket path only works while the JS bundle is alive. This service is the
 * fallback: a high-priority *data* message from the Suhoor backend wakes the
 * app process, and we replay it through the same AlarmReceiver the local alarm
 * uses, so the buzz gets the identical full-screen alarm + PIN dismissal.
 */
class SuhoorMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "SuhoorMessaging"
        const val PREFS = "suhoor_push"
        const val KEY_TOKEN = "fcm_token"
        private const val ACTION_ALARM_TRIGGER = "com.mechseiko.suhoor.ALARM_TRIGGER"
    }

    override fun onDeletedMessages() {
        super.onDeletedMessages()
        Log.w(TAG, "FCM dropped messages (quota)")
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_TOKEN, token).apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        Log.d(TAG, "FCM message: ${data["type"]}")

        if (data["type"] != "buzz") return

        val alarmId = data["alarmId"]
            ?: "buzz_${message.messageId ?: System.currentTimeMillis()}"
        val now = System.currentTimeMillis()

        // The user muted this group's wake-up buzzes: drop it entirely.
        if (MutedGroups.isMuted(this, data["groupId"])) {
            Log.d(TAG, "Buzz from muted group ignored: ${data["groupId"]}")
            return
        }

        // The socket may have delivered the same buzz already.
        if (BuzzDedupe.isDuplicate(this, alarmId)) {
            Log.d(TAG, "Duplicate buzz ignored: $alarmId")
            return
        }

        val alarmData = AlarmData(
            id = alarmId,
            triggerTime = now + 1000,
            userId = data["toUserId"].orEmpty(),
            groupId = data["groupId"].orEmpty(),
            type = "remote_buzz",
            createdAt = now,
            soundName = data["soundName"].orEmpty(),
            // Buzzes always ring at full volume; a friend is trying to wake you.
            volume = 1.0f
        )

        // Explicit broadcast: same receiver, same foreground service, same
        // full-screen alarm activity as a locally scheduled alarm.
        val intent = Intent(this, AlarmReceiver::class.java).apply {
            action = ACTION_ALARM_TRIGGER
            putExtra("alarm_id", alarmId)
            putExtra("alarm_data", Gson().toJson(alarmData))
        }
        sendBroadcast(intent)
    }
}
