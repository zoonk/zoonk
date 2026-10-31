package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.model.ExplanationStepContent
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepBasis
import com.zoonk.android.feature.player.model.StepContent
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

private const val RECAP_TEXT = "Clouds are tiny droplets. Warm air keeps them up."
private const val BASIS = "Warm air keeps them up."

@RunWith(AndroidJUnit4::class)
class LessonRecapFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private val idea =
        LessonStep(
            "idea",
            null,
            StepContent.Explanation(ExplanationStepContent(text = RECAP_TEXT, title = "What holds a cloud up")),
            position = 0,
        )

    private fun restingOnIdea(step: LessonStep): LessonStep {
        val check = (step.content as StepContent.Check).content
        return step.copy(content = StepContent.Check(check.copy(basis = StepBasis(position = 0, quote = BASIS))), position = 1)
    }

    /** The recap's sentences that show highlighted. */
    private fun markedText(): List<String> {
        val text =
            rule
                .onNodeWithText(RECAP_TEXT)
                .fetchSemanticsNode()
                .config
                .getOrNull(SemanticsProperties.Text)
                .orEmpty()
        return text.flatMap { line ->
            line.spanStyles.filter { it.item.background != Color.Unspecified }.map { line.substring(it.start, it.end) }
        }
    }

    private fun openRecap() {
        rule.onNodeWithText("From the lesson").performScrollTo()
        harness.tap("From the lesson")
        rule.onNodeWithText(RECAP_TEXT).performScrollTo().assertIsDisplayed()
    }

    @Test
    fun aQuestionRecapsTheScreenItRestsOn() {
        harness.play(listOf(idea, restingOnIdea(checkStep("quiz")), summaryStep("end")))
        harness.tap("Next")

        rule.onNodeWithText("What holds a cloud up").assertIsDisplayed()
        openRecap()

        assertEquals(emptyList<String>(), markedText())
    }

    @Test
    fun aMissHighlightsTheSentenceTheQuestionRestsOn() {
        harness.play(listOf(idea, restingOnIdea(checkStep("quiz")), summaryStep("end")))
        harness.tap("Next")
        harness.tap("Wrong")
        harness.tap("Check")
        rule.onNodeWithText("Not quite").assertIsDisplayed()

        openRecap()

        assertEquals(listOf(BASIS), markedText())
    }
}
