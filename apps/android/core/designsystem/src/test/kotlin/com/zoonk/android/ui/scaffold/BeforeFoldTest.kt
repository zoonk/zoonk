package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** A Pixel Fold's inner display: a page beside the navigation rail, the fold down the window's middle. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w852dp-h883dp")
class BeforeFoldTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private fun show(
        content: @Composable () -> Unit = {
            BeforeFold { beforeFold -> Box(beforeFold.fillMaxWidth().height(56.dp).testTag(FIELD)) }
        },
    ) {
        rule.setContent {
            ZoonkTheme {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopEnd) {
                    Box(Modifier.width(772.dp)) { content() }
                }
            }
        }
    }

    private fun unfold() {
        folds.overrideWindowLayoutInfo(
            TestWindowLayoutInfo(
                listOf(FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)),
            ),
        )
        rule.waitForIdle()
    }

    private fun field(): DpRect = rule.onNodeWithTag(FIELD).getUnclippedBoundsInRoot()

    @Test
    fun anOpenBookKeepsTheFieldToThePageBeforeTheFold() {
        show()
        unfold()

        assertEquals(80f, field().left.value, 0.5f)
        assertEquals(426f, field().right.value, 0.5f)
    }

    @Test
    fun withoutAFoldTheFieldTakesThePage() {
        show()

        assertEquals(80f, field().left.value, 0.5f)
        assertEquals(852f, field().right.value, 0.5f)
    }

    @Test
    fun aStatusMessageCentersOnThePageBeforeTheFold() {
        show { LoadFailedMessage(onRetry = {}) }
        unfold()

        val title = rule.onNodeWithText("This page didn't load").getUnclippedBoundsInRoot()
        val retry = rule.onNodeWithText("Try again").getUnclippedBoundsInRoot()
        assertTrue("the title ends before the fold: $title", title.right <= 426.dp)
        assertTrue("Try again ends before the fold: $retry", retry.right <= 426.dp)
        assertEquals("centered on its page", 80f + 426f, (retry.left + retry.right).value, 1f)
    }

    private companion object {
        const val FIELD = "field"
    }
}
