package com.zoonk.android.feature.livecall

import android.content.ComponentName
import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.MainActivity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.Shadows.shadowOf

@RunWith(AndroidJUnit4::class)
class LiveCallServiceTest {
    @Test
    fun tappingTheCallNotificationOpensTheAppFromItsLauncherActivity() {
        val service =
            Robolectric
                .buildService(LiveCallService::class.java)
                .create()
                .startCommand(0, 1)
                .get()

        val tap = shadowOf(service).lastForegroundNotification.contentIntent
        val intent = shadowOf(tap).savedIntent

        assertTrue(tap.isActivity)
        assertEquals(ComponentName(service, MainActivity::class.java), intent.component)
        assertEquals(Intent.ACTION_MAIN, intent.action)
        assertEquals(setOf(Intent.CATEGORY_LAUNCHER), intent.categories)
        assertNull(intent.data)
        assertNull(intent.extras)
        assertEquals(0, intent.flags)
    }
}
