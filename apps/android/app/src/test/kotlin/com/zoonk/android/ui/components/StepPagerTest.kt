package com.zoonk.android.ui.components

import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.width
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

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

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun backSitsWithTheActionsLastLineWhenTheyWrap() {
        rule.setContent {
            CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density, fontScale = 2f)) {
                ZoonkTheme {
                    StepPagerActions(count = 2, index = 1, onIndexChange = {}) { main ->
                        OutlinedButton(onClick = {}) { Text("Skip the rewrite") }
                        Button(onClick = {}, modifier = main) { Text("Rewrite") }
                    }
                }
            }
        }

        val back = rule.onNodeWithContentDescription("Back").getBoundsInRoot()
        val skip = rule.onNodeWithText("Skip the rewrite").getBoundsInRoot()
        val rewrite = rule.onNodeWithText("Rewrite").getBoundsInRoot()
        assertTrue("The actions stayed on one line", rewrite.top >= skip.bottom)
        assertTrue("Back starts at ${back.top}, above the first line's end at ${skip.bottom}", back.top >= skip.bottom)
    }
}
