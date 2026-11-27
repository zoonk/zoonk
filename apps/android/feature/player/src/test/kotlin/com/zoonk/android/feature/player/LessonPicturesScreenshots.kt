package com.zoonk.android.feature.player

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.isSelectable
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import coil3.ImageLoader
import coil3.asImage
import coil3.decode.DataSource
import coil3.intercept.Interceptor
import coil3.request.ImageResult
import coil3.request.SuccessResult
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.PictureDescription
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepImage
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.api.models.ScreenPicture
import okhttp3.HttpUrl.Companion.toHttpUrl
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
 * `./gradlew :feature:player:testDebugUnitTest --tests '*LessonPicturesScreenshots*' --rerun -Pzoonk.shots=<folder>`.
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
        save(name)
    }

    private fun save(name: String) {
        val bitmap = rule.onRoot().captureRender().asAndroidBitmap()
        writeRender(File(folder, "$name.png"), bitmap)
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

    private fun pickPicture(
        name: String,
        check: Boolean = false,
    ) {
        harness.play(listOf(drawnPictureCheck(), summaryStep("end")), pictures = drawnPictures())
        rule.waitForIdle()
        rule.onAllNodes(isSelectable()).onFirst().performClick()
        if (check) rule.onNodeWithText("Check").performClick()
        rule.waitForIdle()
        save(name)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phonePicturePicked() = pickPicture("picture-picked-phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phonePicturePickedDark() = pickPicture("picture-picked-phone-dark")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi-qwerty")
    fun phonePicturePickedWithAKeyboard() = pickPicture("picture-picked-phone-keyboard")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phonePictureChecked() = pickPicture("picture-checked-phone", check = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneLabeledDiagram() =
        capture("pending-diagram-phone", ActivityFixtures.step("labeledDiagram").copy(image = null, imagePending = true))

    @Test
    @Config(qualifiers = "w411dp-h2400dp-xhdpi")
    fun phoneQuestionAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("pending-question-phone-font200", questionDrawing())
        rule.onAllNodes(hasScrollAction()).onLast().performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, 1000f) }
        rule.waitForIdle()
        save("pending-question-phone-font200-scrolled")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-night-xhdpi")
    fun tabletQuestionDark() = capture("pending-question-tablet-dark", questionDrawing())

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletQuestion() = capture("pending-question-tablet", questionDrawing())

    @Test
    @Config(qualifiers = "w1138dp-h712dp-land-xhdpi")
    fun smallerTabletQuestion() = capture("pending-question-smaller-tablet", questionDrawing())

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-340dpi")
    fun fractionalDensityTabletQuestion() = capture("pending-question-tablet-fractional-density", questionDrawing())
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

private fun drawnPictureCheck(): LessonStep {
    val check = pictureCheckStep("arch")
    val pictures =
        (check.content as StepContent.Check).content.options.associate {
            it.id to StepImage(it.id, "https://blob.zoonk.test/${it.id}.png", "A doorway with a ${it.text.lowercase()} arch", 1024, 1024)
        }
    return check.copy(optionPictures = pictures)
}

/** Every picture comes back drawn: a light sky over a darker ground, so a mark over it shows against both. */
private fun drawnPictures(): PrivatePictures {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val bitmap =
        Bitmap.createBitmap(256, 256, Bitmap.Config.ARGB_8888).apply {
            val canvas = Canvas(this)
            canvas.drawColor(0xFFBFD9F2.toInt())
            canvas.drawRect(0f, 160f, 256f, 256f, Paint().apply { color = 0xFF5B7F3A.toInt() })
            canvas.drawRect(88f, 72f, 168f, 200f, Paint().apply { color = 0xFF8C5A3C.toInt() })
        }
    val loader =
        ImageLoader
            .Builder(context)
            .components {
                add(
                    object : Interceptor {
                        override suspend fun intercept(chain: Interceptor.Chain): ImageResult =
                            SuccessResult(bitmap.asImage(), chain.request, DataSource.MEMORY)
                    },
                )
            }.build()
    return PrivatePictures(PrivateImages("https://api.zoonk.test/v1/".toHttpUrl(), loader), null)
}
