package com.zoonk.android.feature.reminders

import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.edit
import com.google.firebase.FirebaseApp
import com.google.firebase.installations.FirebaseInstallations
import com.google.firebase.messaging.FirebaseMessaging
import com.zoonk.android.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlin.coroutines.cancellation.CancellationException

/**
 * Study reminders through Firebase Cloud Messaging, addressed by the installation's Firebase ID (the
 * token FCM's registration gives now). Nothing of Firebase runs until the learner turns push on.
 */
class FirebasePush(
    private val context: Context,
) : PushAddress {
    private val saved by lazy { context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE) }

    override val token: String?
        get() = saved.getString(TOKEN, null)

    override val label: String
        get() =
            Settings.Global.getString(context.contentResolver, Settings.Global.DEVICE_NAME)?.takeIf(String::isNotBlank)
                ?: Build.MODEL

    override suspend fun register(): String? {
        if (FirebaseApp.getApps(context).isEmpty()) return null
        keepChannel(create = true)
        return try {
            val messaging = FirebaseMessaging.getInstance()
            messaging.isAutoInitEnabled = true
            messaging.register().await()
            FirebaseInstallations
                .getInstance()
                .id
                .await()
                .also { withContext(Dispatchers.IO) { save(it) } }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            null
        }
    }

    /** Keeps [token] as this installation's; the one it replaced, when it changed. */
    fun save(token: String): String? {
        val previous = this.token
        if (previous == token) return null
        saved.edit(commit = true) { putString(TOKEN, token) }
        return previous
    }

    /**
     * When the app opens: delivered reminders go, since the learner is here, and the channel takes the
     * app's language again.
     */
    fun opened() {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.activeNotifications
            .filter { it.notification.channelId == CHANNEL }
            .forEach { manager.cancel(it.tag, it.id) }
        keepChannel(create = false)
    }

    private fun keepChannel(create: Boolean) {
        val manager = NotificationManagerCompat.from(context)
        if (!create && manager.getNotificationChannelCompat(CHANNEL) == null) return
        manager.createNotificationChannel(
            NotificationChannelCompat
                .Builder(CHANNEL, NotificationManagerCompat.IMPORTANCE_DEFAULT)
                .setName(context.getString(R.string.reminders_channel_name))
                .setDescription(context.getString(R.string.reminders_channel_description))
                .build(),
        )
    }

    companion object {
        /** The API's pushes name it (`android.notification.channel_id`). */
        const val CHANNEL = "study_reminders"

        private const val PREFERENCES = "push"
        private const val TOKEN = "token"
    }
}
