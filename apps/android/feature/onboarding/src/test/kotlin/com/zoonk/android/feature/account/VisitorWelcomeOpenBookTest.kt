package com.zoonk.android.feature.account

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** A Pixel Fold's inner display, its fold down the window's middle. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w852dp-h883dp")
class VisitorWelcomeOpenBookTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val sent = mutableListOf<String>()

    @Test
    fun anOpenBookFacesTheGoalBoxWithItsExamples() {
        rule.setContent {
            ZoonkTheme { VisitorWelcome(rememberAppNavigator(), PaddingValues(), isSending = false, error = null, onSend = { sent += it }) }
        }
        rule.onNode(hasSetTextAction()).performTextInput("pass the bar exam")
        folds.overrideWindowLayoutInfo(
            TestWindowLayoutInfo(
                listOf(FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)),
            ),
        )
        rule.waitForIdle()

        val box = rule.onNode(hasSetTextAction()).getUnclippedBoundsInRoot()
        val build = rule.onNodeWithText("Build my plan").getUnclippedBoundsInRoot()
        val examples = rule.onNodeWithText("Examples").getUnclippedBoundsInRoot()
        assertTrue("the box ends before the fold: $box", box.right.value <= FOLD)
        assertTrue("Build my plan ends before the fold: $build", build.right.value <= FOLD)
        assertTrue("the examples start after the fold: $examples", examples.left.value >= FOLD)
        rule.onNodeWithText("pass the bar exam").assertExists()
        assertEquals(emptyList<String>(), sent)
    }

    /** Tablets keep main's one column: only a book's fold faces the box with its examples. */
    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aTabletKeepsTheExamplesUnderTheBox() {
        rule.setContent {
            ZoonkTheme { VisitorWelcome(rememberAppNavigator(), PaddingValues(), isSending = false, error = null, onSend = { sent += it }) }
        }

        val box = rule.onNode(hasSetTextAction()).getUnclippedBoundsInRoot()
        val examples = rule.onNodeWithText("Examples").performScrollTo().getUnclippedBoundsInRoot()
        assertTrue("the examples sit under the box: $examples, $box", examples.top >= box.bottom && examples.left < box.right)
    }

    private companion object {
        const val FOLD = 426f
    }
}
