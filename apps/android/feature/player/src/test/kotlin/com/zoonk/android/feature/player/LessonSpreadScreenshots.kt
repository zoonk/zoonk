package com.zoonk.android.feature.player

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.feature.player.language.reading
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepImage
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review screenshots of a lesson's spread on an unfolded book foldable and of the one column it keeps
 * elsewhere, written only on demand:
 * `./gradlew :feature:player:testDebugUnitTest --tests '*LessonSpreadScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LessonSpreadScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule(order = 2)
    val tempFolder = TemporaryFolder()

    private val folder = System.getProperty("zoonk.shots").orEmpty()
    private val harness = LessonPlayerHarness(rule) { tempFolder.newFolder() }

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private fun capture(
        name: String,
        step: LessonStep,
        open: Boolean = true,
        layoutDirection: LayoutDirection? = null,
        then: () -> Unit = {},
    ) {
        harness.play(listOf(step, summaryStep("end")), pictures = loadingPictures(), layoutDirection = layoutDirection)
        if (open) {
            rule.waitForIdle()
            folds.overrideWindowLayoutInfo(
                TestWindowLayoutInfo(
                    listOf(
                        FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL),
                    ),
                ),
            )
        }
        then()
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        File(folder, "$name.png").apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun tap(text: String) =
        rule
            .onAllNodesWithText(text)
            .onFirst()
            .performClick()

    @Test
    @Config(qualifiers = BOOK)
    fun bookCheck() = capture("book-check", checkStep("quiz"))

    @Test
    @Config(qualifiers = BOOK)
    fun bookCheckFeedback() =
        capture("book-check-feedback", checkStep("quiz")) {
            tap("Wrong")
            tap("Check")
        }

    @Test
    @Config(qualifiers = "w852dp-h883dp-night-xhdpi")
    fun bookCheckDark() = capture("book-check-dark", checkStep("quiz"))

    @Test
    @Config(qualifiers = BOOK)
    fun bookCheckRightToLeft() = capture("book-check-rtl", checkStep("quiz"), layoutDirection = LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = BOOK)
    fun bookReadingWithPicture() = capture("book-reading-picture", picturedExplanation())

    @Test
    @Config(qualifiers = BOOK)
    fun bookTextOnly() = capture("book-text-only", explanationStep("idea"))

    @Test
    @Config(qualifiers = BOOK)
    fun bookWorkedExample() = capture("book-worked-example", workedExampleStep("worked"))

    @Test
    @Config(qualifiers = BOOK)
    fun bookTypedAnswer() = capture("book-typed", typedAnswerStep("typed"))

    @Test
    @Config(qualifiers = BOOK)
    fun bookWordBank() = capture("book-word-bank", reading("read")) { tap("Yo") }

    @Test
    @Config(qualifiers = BOOK)
    fun bookActivity() = capture("book-activity", activityStep("activity"))

    @Test
    @Config(qualifiers = BOOK)
    fun bookChallenge() = capture("book-challenge", challengeStep("challenge")) { tap("Start") }

    @Test
    @Config(qualifiers = BOOK, fontScale = 2f)
    fun bookAtTwiceTheFontSize() = capture("book-check-font200", checkStep("quiz"))

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun wideWindowWithoutAFold() = capture("wide-check", checkStep("quiz"), open = false)

    @Test
    @Config(qualifiers = PHONE)
    fun phoneCheck() = capture("phone-check", checkStep("quiz"), open = false)

    @Test
    @Config(qualifiers = PHONE)
    fun phoneReadingWithPicture() = capture("phone-reading-picture", picturedExplanation(), open = false)

    private fun picturedExplanation() =
        explanationStep("idea").copy(image = StepImage("cloud", "https://blob.zoonk.test/cloud.png", "A cloud over a hill", 1024, 1280))

    private companion object {
        const val BOOK = "w852dp-h883dp-xhdpi"
        const val PHONE = "w411dp-h891dp-xxhdpi"
    }
}
