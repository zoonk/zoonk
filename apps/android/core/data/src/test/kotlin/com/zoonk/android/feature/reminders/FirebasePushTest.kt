package com.zoonk.android.feature.reminders

import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FirebasePushTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val manager = NotificationManagerCompat.from(context)

    private fun post(
        channel: String,
        tag: String,
    ) {
        manager.createNotificationChannel(NotificationChannelCompat.Builder(channel, NotificationManagerCompat.IMPORTANCE_DEFAULT).build())
        val notification =
            NotificationCompat
                .Builder(context, channel)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .build()
        context.getSystemService(NotificationManager::class.java).notify(tag, 0, notification)
    }

    @Test
    fun openingTheAppClearsDeliveredRemindersAndNothingElse() {
        post(FirebasePush.CHANNEL, tag = "study-reminder")
        post("live_call", tag = "call")

        FirebasePush(context).opened()

        val left = context.getSystemService(NotificationManager::class.java).activeNotifications.map { it.tag }
        assertEquals(listOf("call"), left)
    }
}
