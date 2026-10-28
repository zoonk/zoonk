package com.zoonk.android

import android.content.Intent
import android.net.Uri
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.zoonk.android.navigation.AppRoute
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ZoonkAppTest {
    @get:Rule val rule = createEmptyComposeRule()

    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    private fun tab(labelResource: Int) = rule.onNode(hasText(context.getString(labelResource)) and hasClickAction())

    @Test
    fun theTabsOpenTheirPages() {
        ActivityScenario.launch(MainActivity::class.java).use {
            listOf(R.string.navigation_plan, R.string.navigation_buddy, R.string.navigation_today).forEach { label ->
                tab(label).performClick()
                tab(label).assertIsSelected()
            }
        }
    }

    @Test
    fun aSharedPlanLinkOpensInTheApp() {
        val link =
            Intent(Intent.ACTION_VIEW, Uri.parse("https://www.zoonk.com/pt/plan-link/plan-1"))
                .setPackage(context.packageName)

        ActivityScenario.launch<MainActivity>(link).use {
            rule.onNodeWithText(AppRoute.PlanLink("plan-1").toString()).assertIsDisplayed()
        }
    }
}
