package com.zoonk.android.feature.player

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.PictureDescription
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.api.models.ScreenPicture
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review screenshots of pictures still being drawn, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*LessonPicturesScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LessonPicturesScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val tempFolder = TemporaryFolder()

    private val folder = System.getProperty("zoonk.shots").orEmpty()
    private val harness = LessonPlayerHarness(rule) { tempFolder.newFolder() }

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private fun capture(
        name: String,
        step: LessonStep,
    ) {
        harness.play(listOf(step, summaryStep("end")))
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        File(folder, "$name.png").apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneQuestion() = capture("pending-question-phone", questionDrawing())

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneQuestionDark() = capture("pending-question-phone-dark", questionDrawing())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneOptions() = capture("pending-options-phone", pictureCheckStep("arch").copy(imagePending = true))

    @Test
    @Config(qualifiers = "w411dp-h2400dp-xhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("pending-options-phone-font200", pictureCheckStep("arch").copy(imagePending = true))
    }

    @Test
    @Config(qualifiers = "w360dp-h780dp-xxhdpi")
    fun smallPhoneLongDescriptions() = capture("pending-options-small-phone-long", longDescriptions())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneLabeledDiagram() =
        capture("pending-diagram-phone", ActivityFixtures.step("labeledDiagram").copy(image = null, imagePending = true))

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletQuestion() = capture("pending-question-tablet", questionDrawing())
}

private fun questionDrawing(): LessonStep {
    val check = checkStep("quiz")
    val content = (check.content as StepContent.Check).content
    val picture =
        PictureDescription(
            alt = "A sweater's care tag: a tub with 30°, a crossed-out triangle, a square with a circle",
            prompt = "A care tag",
        )
    return check.copy(
        content = StepContent.Check(content.copy(image = picture)),
        imagePending = true,
        picture = ScreenPicture(picture.alt, required = false),
    )
}

private fun longDescriptions(): LessonStep {
    val check = pictureCheckStep("arch")
    val content = (check.content as StepContent.Check).content
    val options =
        content.options.map {
            it.copy(picture = it.picture?.copy(alt = "A tall doorway with a ${it.text.lowercase()} arch and thin columns on each side"))
        }
    return check.copy(content = StepContent.Check(content.copy(options = options)), imagePending = true)
}
