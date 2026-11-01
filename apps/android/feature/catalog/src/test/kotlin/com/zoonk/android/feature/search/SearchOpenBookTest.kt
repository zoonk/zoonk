package com.zoonk.android.feature.search

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.width
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** Search on an unfolded book foldable keeps to the page before the fold, as it reads with what's above it. */
@RunWith(AndroidJUnit4::class)
class SearchOpenBookTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    /** A page [width] wide at the window's end, where the shell lays it beside an unfolded book's navigation rail. */
    private fun show(
        width: Dp = Dp.Unspecified,
        content: @Composable (AppContainer, AppNavigator) -> Unit,
    ) {
        rule.setContent {
            ZoonkTheme {
                val context = LocalContext.current
                val app = remember { AppContainer.preview(context) }
                val navigator = rememberAppNavigator()

                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopEnd) {
                    Box(if (width == Dp.Unspecified) Modifier.fillMaxSize() else Modifier.width(width)) { content(app, navigator) }
                }
            }
        }
    }

    private fun unfold() {
        rule.waitForIdle()
        folds.overrideWindowLayoutInfo(
            TestWindowLayoutInfo(
                listOf(FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)),
            ),
        )
        rule.waitForIdle()
    }

    private fun field(): DpRect = rule.onAllNodes(hasSetTextAction()).onLast().getUnclippedBoundsInRoot()

    /** Where [node] shows in the window: a docked panel is a popup, whose root starts where it opens. */
    private fun onScreen(node: SemanticsNodeInteraction): DpRect {
        val semantics = node.fetchSemanticsNode()
        val density = semantics.layoutInfo.density.density
        val start = semantics.positionOnScreen.x / density
        return DpRect(start.dp, 0.dp, (start + semantics.size.width / density).dp, 0.dp)
    }

    private fun search(words: String) {
        rule.onAllNodes(hasSetTextAction()).onLast().performTextInput(words)
        rule.mainClock.advanceTimeBy(500)
    }

    private fun assertBeforeFold(
        what: String,
        bounds: DpRect,
    ) = assertTrue("$what ends before the fold: $bounds", bounds.right <= FOLD)

    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun aTabRootsSearchKeepsToThePageBeforeTheFold() {
        show(BOOK_PAGE) { app, navigator -> Column { TabSearchBar(app, navigator) } }
        unfold()

        assertBeforeFold("the bar", field())

        rule.onNodeWithText("Search or ask…").performClick()
        search("explore")

        assertBeforeFold("the field", onScreen(rule.onAllNodes(hasSetTextAction()).onLast()))
        assertBeforeFold("a result", onScreen(rule.onNodeWithText("Explore courses")))
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun searchOverAPageKeepsToThePageBeforeTheFold() {
        lateinit var opened: AppSearch
        show(BOOK_PAGE) { app, navigator -> SearchHost(app, navigator, signedIn = true) { opened = checkNotNull(LocalAppSearch.current) } }

        rule.runOnIdle { opened.open() }
        unfold()
        search("explore")

        assertBeforeFold("the field", field())
        assertTrue("the field fills the page before the fold: ${field()}", field().width > FOLD - 40.dp)
        assertBeforeFold("a result", rule.onNodeWithText("Explore courses").getUnclippedBoundsInRoot())
    }

    /** A window too short for the docked panel, such as half of an open book in split screen, keeps the bar off the fold too. */
    @Test
    @Config(qualifiers = "w852dp-h400dp")
    fun aShortWindowsBarEndsBeforeTheFold() {
        show(BOOK_PAGE) { app, navigator -> Column { TabSearchBar(app, navigator) } }
        unfold()

        assertBeforeFold("the bar", field())
    }

    /** A Galaxy Z Fold's medium window spreads search's results too. */
    @Test
    @Config(qualifiers = "w707dp-h823dp")
    fun aNarrowerBooksSearchSpreadsToo() {
        lateinit var opened: AppSearch
        show { app, navigator -> SearchHost(app, navigator, signedIn = true) { opened = checkNotNull(LocalAppSearch.current) } }

        rule.runOnIdle { opened.open() }
        unfold()
        search("explore")

        val match = rule.onNodeWithText("Explore courses").getUnclippedBoundsInRoot()
        val ask = rule.onNodeWithText("“explore”", substring = true).getUnclippedBoundsInRoot()
        assertTrue("the learner's match ends before the fold: $match", match.right <= 353.5.dp)
        assertTrue("a way to ask starts after the fold: $ask", ask.left >= 353.dp)
    }

    /** As on the open iPhone Duo: the learner's own matches face the ways to ask. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun aQuerysMatchesFaceTheWaysToAskAcrossTheFold() {
        lateinit var opened: AppSearch
        show { app, navigator -> SearchHost(app, navigator, signedIn = true) { opened = checkNotNull(LocalAppSearch.current) } }

        rule.runOnIdle { opened.open() }
        unfold()
        search("explore")

        assertBeforeFold("the learner's match", rule.onNodeWithText("Explore courses").getUnclippedBoundsInRoot())
        val ask = rule.onNodeWithText("“explore”", substring = true).getUnclippedBoundsInRoot()
        assertTrue("a way to ask starts after the fold: $ask", ask.left >= FOLD)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun searchOverAPageFillsAPhone() {
        lateinit var opened: AppSearch
        show { app, navigator -> SearchHost(app, navigator, signedIn = true) { opened = checkNotNull(LocalAppSearch.current) } }

        rule.runOnIdle { opened.open() }
        search("explore")

        assertTrue("the field spans the window: ${field()}", field().width >= 411.dp)
        assertTrue("so do the results", rule.onNodeWithText("Explore courses").getUnclippedBoundsInRoot().width >= 411.dp)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aTabletKeepsMaterialsDockedBar() {
        show { app, navigator -> Column { TabSearchBar(app, navigator) } }

        assertTrue("the bar keeps Material's docked width: ${field()}", field().width >= 360.dp)
    }

    private companion object {
        /** A Pixel Fold's 852dp window less the 80dp rail. */
        val BOOK_PAGE = 772.dp
        val FOLD = 426.dp
    }
}
