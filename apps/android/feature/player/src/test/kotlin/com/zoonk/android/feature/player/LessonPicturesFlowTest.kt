package com.zoonk.android.feature.player

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import coil3.ImageLoader
import coil3.intercept.Interceptor
import coil3.request.ErrorResult
import coil3.request.ImageResult
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.PictureDescription
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepImage
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.api.models.ScreenPicture
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import java.util.concurrent.ConcurrentLinkedQueue

@RunWith(AndroidJUnit4::class)
class LessonPicturesFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    @Test
    fun theNextScreensOptionPicturesLoadAhead() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val requested = ConcurrentLinkedQueue<String>()
        val loader =
            ImageLoader
                .Builder(context)
                .components {
                    add(
                        object : Interceptor {
                            override suspend fun intercept(chain: Interceptor.Chain): ImageResult {
                                requested += chain.request.data.toString()
                                return ErrorResult(null, chain.request, IllegalStateException("No pictures in tests"))
                            }
                        },
                    )
                }.build()
        val drawn = StepImage("arch", "https://blob.zoonk.test/arch.png", "A doorway with a right arch", 1024, 1280)
        val pictures = PrivatePictures(PrivateImages("https://api.zoonk.test/v1/".toHttpUrl(), loader), null)

        harness.play(
            listOf(explanationStep("idea"), pictureCheckStep("quiz").copy(optionPictures = mapOf("right" to drawn))),
            pictures = pictures,
        )

        rule.waitUntil { drawn.url in requested }
    }

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
    return copy(content = pictured, imagePending = true, picture = ScreenPicture(alt = CLOUD, required = parts != null))
}
