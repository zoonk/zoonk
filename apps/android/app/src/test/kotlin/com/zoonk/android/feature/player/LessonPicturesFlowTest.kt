package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.PictureDescription
import com.zoonk.android.feature.player.model.StepContent
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LessonPicturesFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    @Test
    fun aQuestionShowsItsPicturesDescriptionWhileItsDrawnAndTakesAnswers() {
        harness.play(listOf(checkStep("quiz").drawing(), summaryStep("end")))

        rule.onNodeWithText("Drawing the picture…").assertIsDisplayed()
        rule.onNodeWithText(CLOUD).assertIsDisplayed()
        harness.tap("Right")
        harness.tap("Check")

        rule.onNodeWithText("Correct!").assertIsDisplayed()
    }

    @Test
    fun aGuessTakesItsPickWhileItsPictureIsDrawn() {
        harness.play(listOf(hookGuessStep("hook").drawing(), summaryStep("end")))

        rule.onNodeWithText("Yes").performScrollTo().performClick()
        harness.tap("See the answer")

        rule.onNodeWithText("Continue").assertIsDisplayed()
    }

    @Test
    fun aQuestionAboutNumberedPartsWaitsForItsPicture() {
        harness.play(listOf(checkStep("parts").drawing(parts = listOf("Cloud", "Hill")), summaryStep("end")))

        rule.onNodeWithText("Right").assertIsNotEnabled()
        rule.onNodeWithText("Check").assertIsNotEnabled()
    }

    @Test
    fun aLabeledDiagramWaitsForItsNumberedPicture() {
        val drawn = ActivityFixtures.step("labeledDiagram")
        harness.play(listOf(drawn.copy(image = null, imagePending = true), summaryStep("end")))
        rule.runOnIdle { harness.viewModel.select(LessonAnswer.Activity(checkNotNull(ActivityFixtures.rightAnswer("labeledDiagram")))) }

        rule.onNodeWithText("Check").assertIsNotEnabled()
        rule.onNodeWithText(checkNotNull(drawn.image).alt).performScrollTo().assertIsDisplayed()
    }

    @Test
    fun picturedOptionsShowTheirDescriptionsWhileTheyreDrawnAndTakeAPick() {
        harness.play(listOf(pictureCheckStep("arch").copy(imagePending = true), summaryStep("end")))

        rule.onNodeWithText("Drawing the picture…").assertDoesNotExist()
        rule.onNodeWithText("A doorway with a wrong arch").assertIsDisplayed()
        harness.tap("A doorway with a right arch")
        harness.tap("Check")

        rule.onNodeWithText("Right").performScrollTo().assertIsDisplayed()
    }
}

private const val CLOUD = "A cloud over a hill"

private fun LessonStep.drawing(parts: List<String>? = null): LessonStep {
    val picture = PictureDescription(alt = CLOUD, prompt = CLOUD, parts = parts)
    val pictured =
        when (val content = content) {
            is StepContent.Check -> StepContent.Check(content.content.copy(image = picture))
            is StepContent.Guess -> StepContent.Guess(content.content.copy(image = picture))
            else -> content
        }
    return copy(content = pictured, imagePending = true)
}
