package com.zoonk.android

import android.content.Intent
import android.net.Uri
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isSelected
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class MainActivityTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private fun link(url: String) = Intent(Intent.ACTION_VIEW, Uri.parse(url))

    @Test
    fun anAppLinkOpensOnLaunchAndWhileRunning() {
        val controller = Robolectric.buildActivity(MainActivity::class.java, link("https://zoonk.com/pt/start?goal=learn+piano")).setup()

        rule.onNodeWithText("learn piano").assertIsDisplayed()

        controller.newIntent(link("https://www.zoonk.com/plan-link/plan-2"))
        rule.onNodeWithText("learn piano").assertDoesNotExist()

        controller.get().onBackPressedDispatcher.onBackPressed()
        rule.onNodeWithText("learn piano").assertIsDisplayed()
    }

    @Test
    fun recreationDoesntOpenTheLaunchLinkAgain() {
        val controller = Robolectric.buildActivity(MainActivity::class.java, link("https://zoonk.com/start?goal=learn+piano")).setup()
        rule.onNodeWithText("learn piano").assertIsDisplayed()

        controller.get().onBackPressedDispatcher.onBackPressed()
        rule.onNode(hasText("Today") and isSelected()).assertIsDisplayed()

        controller.recreate()
        rule.onNode(hasText("Today") and isSelected()).assertIsDisplayed()
        rule.onNodeWithText("learn piano").assertDoesNotExist()
    }

    @Test
    fun aLinkTheAppHasNoPlaceForOpensToday() {
        Robolectric.buildActivity(MainActivity::class.java, link("https://zoonk.com/auth/apple?token=abc")).setup()

        rule.onNode(hasText("Today") and isSelected()).assertIsDisplayed()
    }
}
