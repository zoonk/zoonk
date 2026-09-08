package com.zoonk.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.zoonk.android.app.ZoonkApp
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ZoonkAppTest {
    @get:Rule val composeRule = createComposeRule()

    @Test
    fun primaryNavigationOpensEveryDestination() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val destinations =
            listOf(
                R.string.navigation_home to R.string.placeholder_home,
                R.string.navigation_new to R.string.placeholder_new_course,
                R.string.navigation_courses to R.string.placeholder_courses,
                R.string.navigation_progress to R.string.placeholder_progress,
            )

        composeRule.setContent {
            ZoonkTheme(dynamicColor = false) {
                ZoonkApp()
            }
        }

        destinations.forEach { (labelResource, placeholderResource) ->
            val label = context.getString(labelResource)
            composeRule.onNode(hasText(label) and hasClickAction()).performClick()
            composeRule.onNodeWithText(context.getString(placeholderResource)).assertIsDisplayed()
        }
    }
}
