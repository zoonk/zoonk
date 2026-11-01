package com.zoonk.android.ui.scaffold

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotFocused
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.width
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class PageWithSupportingPaneTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    /** A page [width] wide at the window's end, where the shell lays a page beside its navigation; the whole window when unspecified. */
    private fun show(width: Dp = Dp.Unspecified) {
        rule.setContent {
            ZoonkTheme {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopEnd) {
                    PageWithSupportingPane(
                        supportingPane = { Box(Modifier.fillMaxSize().testTag(ASIDE)) { Text("Aside beside") } },
                        modifier = if (width == Dp.Unspecified) Modifier.fillMaxSize() else Modifier.width(width),
                    ) { beside ->
                        Box(Modifier.fillMaxSize().testTag(PAGE)) { Text(if (beside) "Page" else "Page with its aside below") }
                    }
                }
            }
        }
    }

    /** A fold down the middle of the window, as a book foldable's when it's open; horizontal when held on its side. */
    private fun fold(
        state: FoldingFeature.State,
        orientation: FoldingFeature.Orientation = FoldingFeature.Orientation.VERTICAL,
    ) {
        rule.waitForIdle()
        folds.overrideWindowLayoutInfo(
            TestWindowLayoutInfo(listOf(FoldingFeature(rule.activity, state = state, orientation = orientation))),
        )
        rule.waitForIdle()
    }

    private fun bounds(tag: String): DpRect = rule.onNodeWithTag(tag).getUnclippedBoundsInRoot()

    private fun assertPageOnEachSide(fold: Dp) {
        rule.onNodeWithText("Page").assertIsDisplayed()
        rule.onNodeWithText("Aside beside").assertIsDisplayed()
        assertTrue("the page ends at the fold: ${bounds(PAGE)}", bounds(PAGE).right <= fold)
        assertTrue("the aside starts at the fold: ${bounds(ASIDE)}", bounds(ASIDE).left >= fold)
    }

    private fun assertOnePage(width: Dp) {
        rule.onNodeWithText("Page with its aside below").assertIsDisplayed()
        rule.onNodeWithText("Aside beside").assertDoesNotExist()
        assertEquals(width.value, bounds(PAGE).width.value, 0.5f)
    }

    @Test
    @Config(qualifiers = "w448dp-h997dp")
    fun aTallPhoneShowsOnePageWithItsAsideInIt() {
        show()

        assertOnePage(448.dp)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aWideWindowShowsTheAsideBeside() {
        show()

        rule.onNodeWithText("Page").assertIsDisplayed()
        rule.onNodeWithText("Aside beside").assertIsDisplayed()
    }

    /** At twice the text, Material's 360dp aside is too narrow for it. */
    @Test
    @Config(qualifiers = "w1280dp-h800dp-land", fontScale = 2f)
    fun aWideWindowAtTwiceTheTextKeepsOneColumn() {
        show()

        assertOnePage(1280.dp)
    }

    @Test
    @Config(qualifiers = "w800dp-h1280dp")
    fun aTabletInPortraitKeepsOneColumn() {
        show(width = 720.dp)

        assertOnePage(720.dp)
    }

    /** An unfolded book foldable beside the navigation rail: the page and its aside meet at the fold, flat or folded. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun anOpenBookShowsAPageOnEachSideOfItsFold() {
        show(width = 772.dp)

        fold(FoldingFeature.State.FLAT)
        assertPageOnEachSide(fold = 426.dp)
        val flat = bounds(PAGE) to bounds(ASIDE)

        fold(FoldingFeature.State.HALF_OPENED)
        assertPageOnEachSide(fold = 426.dp)
        assertEquals("folding leaves both pages where they were", flat, bounds(PAGE) to bounds(ASIDE))
    }

    /** A Galaxy Z Fold's inner display is a medium window, still a phone's width on each side. */
    @Test
    @Config(qualifiers = "w707dp-h823dp")
    fun aNarrowerBookSplitsAtItsFoldToo() {
        show(width = 627.dp)

        fold(FoldingFeature.State.FLAT)

        assertPageOnEachSide(fold = 353.5.dp)
    }

    @Test
    @Config(qualifiers = "w707dp-h823dp", fontScale = 1.3f)
    fun largeTextKeepsOneColumnWhereAPageWouldBeTooNarrowForIt() {
        show(width = 627.dp)

        fold(FoldingFeature.State.FLAT)

        assertOnePage(627.dp)
    }

    /** A page a drawer leaves narrow has no room for a page on each side; folding it must not squeeze it beside the fold. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun aPageWithNoRoomToSplitKeepsItsWidthWhenTheBookFolds() {
        show(width = 492.dp)

        fold(FoldingFeature.State.HALF_OPENED)

        assertOnePage(492.dp)
    }

    /** Held on its side and half folded, the fold runs across the page: the panes stay side by side above and below it. */
    @Test
    @Config(qualifiers = "w883dp-h852dp-land")
    fun aTabletopKeepsThePanesTheWindowHasRoomFor() {
        show()

        fold(FoldingFeature.State.HALF_OPENED, FoldingFeature.Orientation.HORIZONTAL)

        rule.onNodeWithText("Page").assertIsDisplayed()
        rule.onNodeWithText("Aside beside").assertIsDisplayed()
    }

    /** Predictive back shrinks the page it leaves to 70%: that page keeps its panes while it shrinks. */
    @Test
    @Config(qualifiers = "w707dp-h823dp")
    fun aShrinkingPageKeepsItsPanes() {
        var scale by mutableFloatStateOf(1f)
        rule.setContent {
            ZoonkTheme {
                Box(
                    Modifier.fillMaxSize().graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                    },
                    contentAlignment = Alignment.TopEnd,
                ) {
                    PageWithSupportingPane(supportingPane = { Text("Aside beside") }, modifier = Modifier.width(627.dp)) { beside ->
                        Text(if (beside) "Page" else "Page with its aside below")
                    }
                }
            }
        }
        fold(FoldingFeature.State.FLAT)
        rule.onNodeWithText("Aside beside").assertIsDisplayed()

        scale = 0.7f
        rule.waitForIdle()

        rule.onNodeWithText("Page").assertIsDisplayed()
        rule.onNodeWithText("Aside beside").assertIsDisplayed()
    }

    @Test
    fun aTextFieldWaitsForATap() {
        InstrumentationRegistry.getInstrumentation().setInTouchMode(true)
        rule.setContent {
            ZoonkTheme {
                PageWithSupportingPane(supportingPane = {}) {
                    var text by remember { mutableStateOf("") }
                    TextField(text, { text = it })
                }
            }
        }

        rule.onNode(hasSetTextAction()).assertIsNotFocused()
        rule.onNode(hasSetTextAction()).performClick()
        rule.onNode(hasSetTextAction()).assertIsFocused()
    }

    private companion object {
        const val PAGE = "page"
        const val ASIDE = "aside"
    }
}
