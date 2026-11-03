package com.zoonk.android.feature.player

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import coil3.ImageLoader
import coil3.intercept.Interceptor
import coil3.request.ImageResult
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.language.reading
import com.zoonk.android.ui.components.PrivatePictures
import kotlinx.coroutines.awaitCancellation
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** An unfolded book foldable's spread: the screen on the page before the fold, the learner's turn on the page after it. */
@RunWith(AndroidJUnit4::class)
class LessonSpreadTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule(order = 2)
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    /** Opens the book flat, its fold down the middle of the window. */
    private fun unfold() {
        rule.waitForIdle()
        folds.overrideWindowLayoutInfo(
            TestWindowLayoutInfo(
                listOf(FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)),
            ),
        )
        rule.waitForIdle()
    }

    private fun described(description: String): DpRect = rule.onNodeWithContentDescription(description).getUnclippedBoundsInRoot()

    private fun assertAfterFold(
        what: String,
        bounds: DpRect,
    ) = assertTrue("$what starts after the fold: $bounds", bounds.left >= FOLD)

    /** A sentence half built isn't the player's answer yet, only the screen's own state: opening or closing the book keeps it. */
    @Test
    @Config(qualifiers = BOOK)
    fun wordsPlacedStayPlacedAsTheBookOpensAndCloses() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(reading("read"), summaryStep("end")), restoration = restoration)
        rule
            .onAllNodesWithText("gato.")
            .onFirst()
            .performClick()

        unfold()
        assertAfterFold("the placed word", described(PLACED))

        // Android recreates the screen as the book folds; window-testing tells the new one of no fold, so it's one column.
        restoration.emulateSavedInstanceStateRestore()
        assertTrue("the placed word is in the one column", described(PLACED).left < FOLD)

        unfold()
        assertAfterFold("the placed word", described(PLACED))
    }

    /** A chart the question asks about sits before the fold in a spread and in the one column otherwise: what the learner moved goes with it. */
    @Test
    @Config(qualifiers = BOOK)
    fun aMovedSliderStaysAsTheBookFoldsAndOpens() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(ActivityFixtures.step("formulaModel"), summaryStep("end")), restoration = restoration)
        unfold()
        val rate = rule.onNode(hasContentDescription("Rate per year") and SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress))
        rate.performScrollTo().requestFocus()
        repeat(2) { rate.performKeyInput { pressKey(Key.DirectionRight) } }
        val moved =
            SemanticsMatcher.expectValue(
                SemanticsProperties.StateDescription,
                rate.fetchSemanticsNode().config[SemanticsProperties.StateDescription],
            )

        restoration.emulateSavedInstanceStateRestore()
        rate.assert(moved)

        unfold()
        rate.assert(moved)
    }

    /** The cards sorted so far, the card in hand and what Undo takes back stay as the book opens, closes and opens again. */
    @Test
    @Config(qualifiers = BOOK)
    fun halfSortedCardsAndTheirUndoStayAsTheBookFoldsAndOpens() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(ActivityFixtures.step("categorize"), summaryStep("end")), restoration = restoration)
        rule.onNodeWithText("Same substance").performScrollTo().performClick()

        for (change in listOf(::unfold, restoration::emulateSavedInstanceStateRestore, ::unfold)) {
            change()
            rule.onNodeWithText("1 of 3 sorted").assertExists()
            rule.onNodeWithText("Rusting iron").assertExists()
        }

        rule.onNodeWithText("Undo").performScrollTo().performClick()
        rule.onNodeWithText("0 of 3 sorted").assertExists()
        rule.onNodeWithText("Melting ice").assertExists()
    }

    private companion object {
        /** A Galaxy Z Fold's inner display, whose fold runs down its middle: without one it's one column, as a narrower book. */
        const val BOOK = "w707dp-h823dp"
        val FOLD: Dp = 353.5.dp
        const val PLACED = "Position 1: gato."
    }
}

/** Pictures that stay loading, so each shows as the frame it fills. */
internal fun loadingPictures(): PrivatePictures {
    val loader =
        ImageLoader
            .Builder(ApplicationProvider.getApplicationContext<Context>())
            .components {
                add(
                    object : Interceptor {
                        override suspend fun intercept(chain: Interceptor.Chain): ImageResult = awaitCancellation()
                    },
                )
            }.build()
    return PrivatePictures(PrivateImages("https://api.zoonk.test/v1/".toHttpUrl(), loader), null)
}
