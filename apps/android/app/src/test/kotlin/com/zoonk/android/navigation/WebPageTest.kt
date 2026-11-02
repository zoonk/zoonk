package com.zoonk.android.navigation

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf
import org.robolectric.shadows.ShadowToast

@RunWith(AndroidJUnit4::class)
class WebPageTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aPageNoBrowserCanOpenSaysSoInsteadOfCrashing() {
        shadowOf(rule.activity.application).checkActivities(true)
        lateinit var navigator: AppNavigator
        rule.setContent { ZoonkTheme { navigator = rememberAppNavigator() } }

        val opened = runCatching { rule.runOnIdle { navigator.open(AppRoute.Privacy) } }

        assertTrue(opened.exceptionOrNull().toString(), opened.isSuccess)
        assertEquals("No app can open this page.", ShadowToast.getTextOfLatestToast())
    }
}
