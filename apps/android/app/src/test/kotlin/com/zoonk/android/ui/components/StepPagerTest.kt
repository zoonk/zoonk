package com.zoonk.android.ui.components

import androidx.compose.material3.Text
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.width
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class StepPagerTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    @Test
    fun onAPhoneContinueFillsTheBarWithoutTheDots() {
        rule.setContent { ZoonkTheme { StepPagerActions(count = 3, index = 1, onIndexChange = {}) { Text("Done") } } }

        val bar = rule.onRoot().getBoundsInRoot()
        val next = rule.onNodeWithText("Continue").getBoundsInRoot()
        assertTrue("Continue is ${next.width} of the bar's ${bar.width}", next.width > bar.width / 2)
        rule.onNodeWithContentDescription("Step 2 of 3").assertDoesNotExist()
    }
}
