package com.zoonk.android

import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
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
}
