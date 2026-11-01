package com.zoonk.android.feature.practice

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.practice.block.Runner
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class RunSpreadTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private fun show(
        vararg questions: JsonObject = arrayOf(planet(), star()),
        restoration: StateRestorationTester? = null,
    ) {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val viewModel =
            practiceViewModel(
                cache,
                blockDetail(questions.toList()),
            ) { studyFeedback(isCorrect = true, explanation = "Mars orbits the Sun.") }
        val read = viewModel.started()
        val content: @Composable () -> Unit = {
            ZoonkTheme {
                val run by viewModel.state.collectAsStateWithLifecycle()
                run?.let { Runner(read, it, viewModel, AppContainer.preview(rule.activity), rememberAppNavigator(), onClose = {}) }
            }
        }

        if (restoration == null) rule.setContent(content) else restoration.setContent(content)
    }

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

    private fun text(
        text: String,
        substring: Boolean = false,
    ): DpRect = rule.onNodeWithText(text, substring = substring, useUnmergedTree = true).getUnclippedBoundsInRoot()

    private fun assertAfterFold(
        what: String,
        bounds: DpRect,
    ) = assertTrue("$what starts after the fold: $bounds", bounds.left >= FOLD)

    /** A pick isn't sent until Check: opening or closing the book, which recreates the screen, keeps it, passage and all. */
    @Test
    @Config(qualifiers = BOOK)
    fun aPickStaysPickedAsTheBookOpensAndCloses() {
        val restoration = StateRestorationTester(rule)
        show(planet("set" to PASSAGE), star(), restoration = restoration)
        rule.onNodeWithText("Mars", substring = true).performClick()

        unfold()
        assertAfterFold("the pick", text("Mars"))
        rule.onNodeWithText("Mars", substring = true).assertIsSelected()

        // Android recreates the screen as the book folds; window-testing tells the new one of no fold.
        restoration.emulateSavedInstanceStateRestore()
        rule.waitForIdle()
        assertTrue("the pick is in the one column", text("Mars").left < FOLD)
        rule.onNodeWithText("Mars", substring = true).assertIsSelected()

        unfold()
        assertAfterFold("the pick", text("Mars"))
        rule.onNodeWithText("Mars", substring = true).assertIsSelected()
        rule.onNodeWithText("Check").assertIsEnabled()
    }

    /** Text typed and not yet sent shows again as the book opens and closes, passage and all, so Check never sends hidden words. */
    @Test
    @Config(qualifiers = BOOK)
    fun typedTextStaysAsTheBookOpensAndCloses() {
        val restoration = StateRestorationTester(rule)
        show(sodium(), star(), restoration = restoration)
        rule.onNode(hasSetTextAction()).performTextInput("Na")

        unfold()
        rule.onNode(hasSetTextAction()).assertTextContains("Na")
        assertAfterFold("the answer box", rule.onNode(hasSetTextAction()).getUnclippedBoundsInRoot())

        restoration.emulateSavedInstanceStateRestore()
        rule.waitForIdle()
        rule.onNode(hasSetTextAction()).assertTextContains("Na")

        unfold()
        rule.onNode(hasSetTextAction()).assertTextContains("Na")
        rule.onNodeWithText("Check").assertIsEnabled()
    }

    private fun planet(vararg fields: Pair<String, Any?>) =
        blockQuestion(FIRST, "question" to "Which is a planet?", "options" to strings("Mars", "Moon"), *fields)

    private fun star() = blockQuestion(SECOND, "question" to "Which is a star?", "options" to strings("Sun", "Venus"), "set" to PASSAGE)

    private fun sodium() =
        blockQuestion(FIRST, "format" to "typed", "question" to "What's the symbol for sodium?", "options" to null, "set" to PASSAGE)

    private companion object {
        const val FIRST = "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
        const val SECOND = "4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"

        /** A Pixel 10 Pro Fold's inner display, whose fold runs down its middle. */
        const val BOOK = "w852dp-h883dp"
        val FOLD: Dp = 426.dp
    }
}
