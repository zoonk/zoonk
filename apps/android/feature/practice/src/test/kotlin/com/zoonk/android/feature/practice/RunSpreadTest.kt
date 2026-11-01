package com.zoonk.android.feature.practice

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
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
import com.zoonk.android.feature.pattern.PatternContent
import com.zoonk.android.feature.pattern.pattern
import com.zoonk.android.feature.pattern.patternViewModel
import com.zoonk.android.feature.practice.block.Runner
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** An unfolded book foldable's spread in a practice run: the question on the page before the fold, the learner's turn on the page after it. */
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

    private fun assertBeforeFold(
        what: String,
        bounds: DpRect,
    ) = assertTrue("$what ends before the fold: $bounds", bounds.right <= FOLD)

    private fun assertAfterFold(
        what: String,
        bounds: DpRect,
    ) = assertTrue("$what starts after the fold: $bounds", bounds.left >= FOLD)

    @Test
    @Config(qualifiers = BOOK)
    fun anOpenBookAsksBeforeTheFoldAndTakesTheAnswerAndItsFeedbackAfterIt() {
        show()
        unfold()

        assertBeforeFold("the question", text("Which is a planet?"))
        assertAfterFold("an option", text("Mars"))

        rule.onNodeWithText("Mars", substring = true).performClick()
        rule.onNodeWithText("Check").performClick()
        rule.waitForIdle()

        assertAfterFold("the verdict", text("Correct!"))
        assertAfterFold("the explanation", text("Mars orbits the Sun."))
        assertBeforeFold("the question", text("Which is a planet?"))
    }

    @Test
    @Config(qualifiers = BOOK)
    fun anOpenBookReadsASetsPassageBeforeTheFoldNotInTheAside() {
        show(planet("set" to PASSAGE), star())
        unfold()

        assertBeforeFold("the passage", text("Recife grew", substring = true))
        assertBeforeFold("the question", text("Which is a planet?"))
        assertAfterFold("an option", text("Mars"))
    }

    @Test
    @Config(qualifiers = BOOK)
    fun anOpenBookShowsAStatementBeforeTheFoldAndItsAnswersAfterIt() {
        show(statement(), star())
        unfold()

        assertBeforeFold("the statement", text("Mars is a planet."))
        assertAfterFold("True", text("True"))

        rule.onNodeWithText("True", substring = true).performClick()
        rule.onNodeWithText("Check").assertIsEnabled()
    }

    @Test
    @Config(qualifiers = TABLET)
    fun aTabletKeepsASetsPassageInTheAsideBesideOneColumn() {
        show(planet("set" to PASSAGE), star())

        val question = text("Which is a planet?")
        val option = text("Mars")
        val passage = text("Recife grew", substring = true)
        assertTrue("the options sit under the question: $question, $option", option.top > question.bottom)
        assertTrue("the passage sits beside the options: $option, $passage", passage.left > option.right)
    }

    @Test
    @Config(qualifiers = PHONE)
    fun aPhoneKeepsThePassageQuestionAndOptionsInOneColumn() {
        show(planet("set" to PASSAGE), star())

        val passage = text("Recife grew", substring = true)
        val question = text("Which is a planet?")
        val option = text("Mars")
        assertTrue("the question sits under the passage: $passage, $question", question.top > passage.bottom)
        assertTrue("the options sit under the question: $question, $option", option.top > question.bottom)
        assertEquals("the column's margin", 16f, question.left.value, 0.5f)
    }

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

    /** A drill's rule leads the page before the fold with its sentence, so it needs no sheet; the choices take the page after it. */
    @Test
    @Config(qualifiers = BOOK)
    fun anOpenBookReadsAPatternsRuleAndSentenceBeforeTheFold() {
        val viewModel = patternViewModel().also { it.begin(pattern()) }
        rule.setContent {
            ZoonkTheme {
                val drill by viewModel.state.collectAsStateWithLifecycle()
                drill?.let { PatternContent(it, viewModel, AppContainer.preview(rule.activity)) }
            }
        }
        rule.onNodeWithText("Practice this", substring = true).performClick()
        unfold()

        assertBeforeFold("the rule", text("“Agree” is a verb, so it needs no “am”."))
        assertBeforeFold("the sentence", text("I ___ with your plan."))
        assertAfterFold("a choice", text("am agree"))
        rule.onNodeWithText("See the rule").assertDoesNotExist()
    }

    /** Folding or unfolding recreates the screen: a learner who scrolled down to the options stays there. */
    @Test
    @Config(qualifiers = SHORT_PHONE)
    fun theScrollStaysWhereTheLearnerLeftItWhenTheScreenIsRecreated() {
        val restoration = StateRestorationTester(rule)
        show(planet("set" to PASSAGE), star(), restoration = restoration)
        rule.onNodeWithText("Moon", substring = true).performScrollTo()
        val scrolled = text("Which is a planet?").top

        restoration.emulateSavedInstanceStateRestore()
        rule.waitForIdle()

        assertEquals("the question stays scrolled", scrolled.value, text("Which is a planet?").top.value, 0.5f)
    }

    @Test
    @Config(qualifiers = SHORT_PHONE)
    fun theNextQuestionStartsAtItsTop() {
        show(planet("set" to PASSAGE), star())
        val top = text("Recife grew", substring = true).top
        rule.onNodeWithText("Mars", substring = true).performScrollTo().performClick()
        rule.onNodeWithText("Check").performClick()
        rule.onNodeWithText("Continue").performClick()
        rule.waitForIdle()

        assertEquals("the passage starts the next question", top.value, text("Recife grew", substring = true).top.value, 0.5f)
    }

    /** Text twice as large leaves a page too narrow for it, so the run keeps one column, on the page before the fold. */
    @Test
    @Config(qualifiers = BOOK, fontScale = 2f)
    fun largeTextKeepsOneColumnBeforeAnOpenBooksFold() {
        show()
        unfold()

        assertBeforeFold("the question", text("Which is a planet?"))
        assertBeforeFold("an option's row", rule.onNodeWithText("Mars", substring = true).getUnclippedBoundsInRoot())
    }

    /** The question moves between the one column and the page before the fold, and the reading place goes with it. */
    @Test
    @Config(qualifiers = BOOK)
    fun theReadingPlaceFollowsTheQuestionAsTheBookOpensAndCloses() {
        val stem = (1..60).joinToString("\n") { "Clause $it about the night sky." } + "\nWhich is a planet?"
        show(planet("context" to "A note on the sky.", "question" to stem))
        rule.onNodeWithText("Moon", substring = true, useUnmergedTree = true).performScrollTo()
        rule.onNodeWithText("A note on the sky.", useUnmergedTree = true).assertIsNotDisplayed()

        unfold()
        rule.onNodeWithText("A note on the sky.", useUnmergedTree = true).assertIsNotDisplayed()

        folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(emptyList()))
        rule.waitForIdle()
        rule.onNodeWithText("A note on the sky.", useUnmergedTree = true).assertIsNotDisplayed()
    }

    private fun planet(vararg fields: Pair<String, Any?>) =
        blockQuestion(FIRST, "question" to "Which is a planet?", "options" to strings("Mars", "Moon"), *fields)

    private fun star() = blockQuestion(SECOND, "question" to "Which is a star?", "options" to strings("Sun", "Venus"), "set" to PASSAGE)

    private fun sodium() =
        blockQuestion(FIRST, "format" to "typed", "question" to "What's the symbol for sodium?", "options" to null, "set" to PASSAGE)

    private fun statement() = blockQuestion(FIRST, "format" to "trueFalse", "question" to "Mars is a planet.", "options" to null)

    private companion object {
        const val FIRST = "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
        const val SECOND = "4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"

        /** A Pixel 10 Pro Fold's inner display, whose fold runs down its middle. */
        const val BOOK = "w852dp-h883dp"
        const val PHONE = "w411dp-h891dp"
        const val TABLET = "w1280dp-h800dp-land"

        /** A phone so short a question with its passage scrolls. */
        const val SHORT_PHONE = "w411dp-h400dp"
        val FOLD: Dp = 426.dp
    }
}
