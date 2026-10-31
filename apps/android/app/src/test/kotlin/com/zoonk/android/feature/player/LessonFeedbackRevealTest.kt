package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.pressKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.model.CheckOption
import com.zoonk.android.feature.player.model.CheckStepContent
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LessonFeedbackRevealTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    @OptIn(ExperimentalTestApi::class)
    @Test
    @Config(qualifiers = "w1280dp-h1000dp-land-xhdpi")
    fun showsTheVerdictOnATabletWithoutScrollingTheQuestionAway() {
        harness.play(listOf(ActivityFixtures.step("unitCircle"))) {
            grade = { _, _ -> checkResult(true, expected = ActivityFixtures.expected("unitCircle")) }
        }
        rule.onNodeWithContentDescription("Point on the circle").run {
            performSemanticsAction(SemanticsActions.RequestFocus)
            repeat(6) { performKeyInput { pressKey(Key.DirectionRight) } }
        }
        harness.tap("Check")
        rule.waitForIdle()

        val view = scroller().boundsInRoot
        val question =
            rule
                .onNodeWithText("Turn the wheel to 30°.")
                .fetchSemanticsNode()
                .positionInRoot.y
        val verdict = rule.onNodeWithText("Correct!").fetchSemanticsNode().let { it.positionInRoot.y + it.size.height }

        assertTrue("question at $question, view $view", question >= view.top)
        assertTrue("verdict ends at $verdict, view $view", verdict <= view.bottom)
    }

    @Test
    @Config(qualifiers = "w1024dp-h420dp-land-mdpi")
    fun keepsAQuestionWithNoBadgeInViewWhenItsVerdictFitsButTheReasonRunsOn() {
        val reason = List(6) { "Where the cloud is densest, the electron is most likely to be." }.joinToString(" ")
        val options =
            listOf(
                CheckOption(id = "right", isCorrect = true, reason = reason, text = "Right"),
                CheckOption(id = "wrong", isCorrect = false, reason = "That's the trap.", text = "Wrong"),
            )
        val step =
            LessonStep("quiz", null, StepContent.Check(CheckStepContent(basis = null, options = options, question = "Question quiz?")))
        harness.play(listOf(step)) { grade = { _, _ -> checkResult(true) } }
        harness.tap("Right")
        harness.tap("Check")
        rule.waitForIdle()

        val view = scroller().boundsInRoot
        val question =
            rule
                .onNodeWithText("Question quiz?")
                .fetchSemanticsNode()
                .positionInRoot.y
        val verdict = rule.onNodeWithText("Correct!").fetchSemanticsNode().let { it.positionInRoot.y + it.size.height }

        assertTrue("question at $question, view $view", question >= view.top)
        assertTrue("verdict ends at $verdict, view $view", verdict <= view.bottom)
    }

    private fun scroller() =
        rule
            .onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange))
            .fetchSemanticsNodes()
            .maxBy { it.boundsInRoot.height }
}
