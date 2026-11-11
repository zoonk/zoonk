package com.zoonk.android.feature.reminders

import android.annotation.SuppressLint
import android.content.Intent
import com.google.firebase.messaging.FirebaseMessagingService
import com.zoonk.android.app.ContainerApplication
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Follows this installation's token. Reminders need nothing here: FCM shows them while the app is in
 * the background and hands them to [onMessageReceived] in the foreground, where none shows.
 * Registration by installation ID reports a new token through [onRegistered]; FCM never calls the
 * onNewToken lint asks for.
 */
@SuppressLint("MissingFirebaseInstanceTokenRefresh")
class ReminderMessagingService : FirebaseMessagingService() {
    override fun onRegistered(installationId: String) {
        val app = (application as ContainerApplication).container
        app.scope.launch { app.reminders.follow(installationId) }
    }
}

/** The goal a tapped reminder opens Today on: FCM puts the push's data (`type`, `goalId`) in the launch intent. */
fun Intent.reminderGoalId(): UUID? =
    getStringExtra("goalId")
        ?.takeIf { getStringExtra("type") == "study_reminder" }
        ?.let { runCatching { UUID.fromString(it) }.getOrNull() }
