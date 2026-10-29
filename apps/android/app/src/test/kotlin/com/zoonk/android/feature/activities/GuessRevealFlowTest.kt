package com.zoonk.android.feature.activities

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.text.AnnotatedString
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GuessRevealFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private fun play(
        fixture: String,
        isCorrect: Boolean,
    ) = harness.play(listOf(ActivityFixtures.step(fixture))) {
        grade = { _, _ -> checkResult(isCorrect, expected = ActivityFixtures.expected(fixture)) }
    }

    private val slider = hasContentDescription("Your guess") and SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress)

    @Test
    fun theComputedValueShowsNextToTheGuessWithItsWorkings() {
        play("guessReveal", isCorrect = true)

        rule.onNode(slider).assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "No guess yet"))
        rule.onNode(slider).performSemanticsAction(SemanticsActions.SetProgress) { it(120f) }
        rule.onNode(slider).assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "140\u00A0days"))
        rule
            .onNode(
                hasSetTextAction(),
            ).assert(
                SemanticsMatcher.expectValue(
                    SemanticsProperties.EditableText,
                    androidx.compose.ui.text
                        .AnnotatedString("140"),
                ),
            )

        harness.tap("Check")

        rule.onNodeWithText("Your guess is close to the real value.").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("minutes").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("A billion seconds is about 32 years.").performScrollTo().assertIsDisplayed()
        rule.onNode(hasContentDescription("The real value is 11.6\u00A0days.", substring = true)).assertExists()
    }

    @Test
    fun aFarGuessSaysHowFar() {
        play("guessReveal.cited", isCorrect = false)

        rule.onNode(hasSetTextAction()).performTextInput("3")
        harness.tap("Check")

        rule.onNodeWithText("Your guess is about 4.7 times too small.").performScrollTo().assertIsDisplayed()
    }
}
