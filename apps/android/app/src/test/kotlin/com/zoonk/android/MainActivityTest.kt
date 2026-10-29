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
import com.zoonk.android.navigation.AppRoute
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
        val controller = Robolectric.buildActivity(MainActivity::class.java, link("https://zoonk.com/pt/plan-link/plan-1")).setup()

        rule.onNodeWithText(AppRoute.PlanLink("plan-1").toString()).assertIsDisplayed()

        controller.newIntent(link("https://www.zoonk.com/plan-link/plan-2"))
        rule.onNodeWithText(AppRoute.PlanLink("plan-2").toString()).assertIsDisplayed()

        controller.get().onBackPressedDispatcher.onBackPressed()
        rule.onNodeWithText(AppRoute.PlanLink("plan-1").toString()).assertIsDisplayed()
    }

    @Test
    fun recreationDoesntOpenTheLaunchLinkAgain() {
        val controller = Robolectric.buildActivity(MainActivity::class.java, link("https://zoonk.com/plan-link/plan-1")).setup()
        rule.onNodeWithText(AppRoute.PlanLink("plan-1").toString()).assertIsDisplayed()

        controller.get().onBackPressedDispatcher.onBackPressed()
        rule.onNode(hasText("Today") and isSelected()).assertIsDisplayed()

        controller.recreate()
        rule.onNode(hasText("Today") and isSelected()).assertIsDisplayed()
        rule.onNodeWithText(AppRoute.PlanLink("plan-1").toString()).assertDoesNotExist()
    }

    @Test
    fun aLinkTheAppHasNoPlaceForOpensToday() {
        Robolectric.buildActivity(MainActivity::class.java, link("https://zoonk.com/auth/apple?token=abc")).setup()

        rule.onNode(hasText("Today") and isSelected()).assertIsDisplayed()
    }
}
