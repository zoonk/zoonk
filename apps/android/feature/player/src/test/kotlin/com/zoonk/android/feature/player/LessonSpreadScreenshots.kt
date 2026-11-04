package com.zoonk.android.feature.player

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.language.alphabet
import com.zoonk.android.feature.player.language.reading
import com.zoonk.android.feature.player.language.vocabulary
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepImage
import com.zoonk.android.feature.player.model.StepVisual
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.api.ApiJson
import kotlinx.serialization.decodeFromString
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
        withTutor: Boolean = false,
        then: () -> Unit = {},
    ) {
        harness.play(
            listOf(step, summaryStep("end")),
            pictures = loadingPictures(),
            layoutDirection = layoutDirection,
            withTutor = withTutor,
            withSpeech = true,
        )
        if (open) rule.unfoldBook(folds)
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
    @Config(qualifiers = BOOK)
    fun bookChartActivity() = capture("book-formula", ActivityFixtures.step("formulaModel"))

    @Test
    @Config(qualifiers = BOOK)
    fun bookChartActivityChecked() =
        capture("book-formula-checked", ActivityFixtures.step("formulaModel")) {
            rule.onNode(hasSetTextAction()).performTextInput("3869.68")
            tap("Check")
        }

    @Test
    @Config(qualifiers = BOOK)
    fun bookSortingActivity() = capture("book-categorize", ActivityFixtures.step("categorize"))

    @Test
    @Config(qualifiers = BOOK)
    fun bookReadingWithChart() = capture("book-reading-chart", explanationStep("idea", visual = chart()))

    @Test
    @Config(qualifiers = BOOK)
    fun bookCheckWithChart() = capture("book-check-chart", checkWithChart())

    @Test
    @Config(qualifiers = BOOK)
    fun bookSummary() = capture("book-summary", summaryStep("summary"))

    @Test
    @Config(qualifiers = BOOK)
    fun bookVocabulary() = capture("book-vocabulary", vocabulary("word", SOUND))

    @Test
    @Config(qualifiers = BOOK)
    fun bookLetter() = capture("book-letter", alphabet("letter", SOUND))

    @Test
    @Config(qualifiers = PHONE)
    fun phoneVocabulary() = capture("phone-vocabulary", vocabulary("word", SOUND), open = false)

    @Test
    @Config(qualifiers = PHONE)
    fun phoneLetter() = capture("phone-letter", alphabet("letter", SOUND), open = false)

    @Test
    @Config(qualifiers = BOOK, fontScale = 1.75f)
    fun bookTextOnlyAtLargeFont() = capture("book-text-only-font175", explanationStep("idea"))

    @Test
    @Config(qualifiers = BOOK, fontScale = 1.75f)
    fun bookChartActivityAtLargeFont() = capture("book-formula-font175", ActivityFixtures.step("formulaModel"))

    @Test
    @Config(qualifiers = BOOK)
    fun bookTextOnlyRightToLeft() = capture("book-text-only-rtl", explanationStep("idea"), layoutDirection = LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = BOOK)
    fun bookTextOnlyWithTheBuddy() = capture("book-text-only-buddy", explanationStep("idea"), withTutor = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookReadingWithPictureAndTheBuddy() = capture("book-reading-picture-buddy", picturedExplanation(), withTutor = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-night-xhdpi")
    fun bookTextOnlyWithTheBuddyDark() = capture("book-text-only-buddy-dark", explanationStep("idea"), withTutor = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookTextOnlyWithTheBuddyRightToLeft() =
        capture("book-text-only-buddy-rtl", explanationStep("idea"), layoutDirection = LayoutDirection.Rtl, withTutor = true)

    @Test
    @Config(qualifiers = BOOK, fontScale = 1.75f)
    fun bookTextOnlyWithTheBuddyAtLargeFont() = capture("book-text-only-buddy-font175", explanationStep("idea"), withTutor = true)

    @Test
    @Config(qualifiers = PHONE)
    fun phoneTextOnlyWithTheBuddy() = capture("phone-text-only-buddy", explanationStep("idea"), open = false, withTutor = true)

    @Test
    @Config(qualifiers = BOOK)
    fun bookWorkedExampleSteps() = capture("book-worked-example-steps", workedExampleStep("worked")) { tap("Show the next step") }

    @Test
    @Config(qualifiers = BOOK, fontScale = 2f)
    fun bookAtTwiceTheFontSize() = capture("book-check-font200", checkStep("quiz"))

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun wideWindowWithoutAFold() = capture("wide-check", checkStep("quiz"), open = false)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi", fontScale = 2f)
    fun wideWindowAtTwiceTheFontSize() = capture("wide-check-font200", checkStep("quiz"), open = false)

    @Test
    @Config(qualifiers = TABLET)
    fun tabletCheck() = capture("tablet-check", checkStep("quiz"), open = false)

    @Test
    @Config(qualifiers = TABLET)
    fun tabletChartActivity() = capture("tablet-formula", ActivityFixtures.step("formulaModel"), open = false)

    @Test
    @Config(qualifiers = TABLET)
    fun tabletVocabulary() = capture("tablet-vocabulary", vocabulary("word", SOUND), open = false)

    @Test
    @Config(qualifiers = TABLET)
    fun tabletTextOnlyWithTheBuddy() = capture("tablet-text-only-buddy", explanationStep("idea"), open = false, withTutor = true)

    @Test
    @Config(qualifiers = TABLET)
    fun tabletRightToLeft() = capture("tablet-check-rtl", checkStep("quiz"), open = false, layoutDirection = LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = TABLET, fontScale = 2f)
    fun tabletAtTwiceTheFontSize() = capture("tablet-check-font200", checkStep("quiz"), open = false)

    @Test
    @Config(qualifiers = TABLET_PORTRAIT)
    fun tabletPortraitCheck() = capture("tablet-portrait-check", checkStep("quiz"), open = false)

    @Test
    @Config(qualifiers = DESKTOP)
    fun desktopCheck() = capture("desktop-check", checkStep("quiz"), open = false)

    @Test
    @Config(qualifiers = PHONE)
    fun phoneCheck() = capture("phone-check", checkStep("quiz"), open = false)

    @Test
    @Config(qualifiers = PHONE)
    fun phoneReadingWithPicture() = capture("phone-reading-picture", picturedExplanation(), open = false)

    @Test
    @Config(qualifiers = GALAXY_FOLD)
    fun galaxyFoldProgress() = capture("galaxy-fold-progress", checkStep("quiz"))

    @Test
    @Config(qualifiers = GALAXY_FOLD)
    fun galaxyFoldProgressRightToLeft() = capture("galaxy-fold-progress-rtl", checkStep("quiz"), layoutDirection = LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = "w700dp-h840dp-xhdpi")
    fun mediumProgress() = capture("medium-progress", checkStep("quiz"), open = false)

    private fun chart(): StepVisual =
        ApiJson.decodeFromString<StepVisual>(
            """
            {"kind":"chart","chart":"bar","title":"Rain by month","categoryLabel":"Month","valueLabel":"Rain","unit":"mm",
             "axisStart":0,"categories":["Jan","Feb","Mar","Apr"],"series":[{"name":"2025","values":[120,90,60,30]}],"source":null}
            """.trimIndent(),
        )

    private fun checkWithChart(): LessonStep {
        val check = checkStep("quiz")
        val content = (check.content as StepContent.Check).content
        return check.copy(content = StepContent.Check(content.copy(visual = chart())))
    }

    private fun picturedExplanation() =
        explanationStep("idea").copy(image = StepImage("cloud", "https://blob.zoonk.test/cloud.png", "A cloud over a hill", 1024, 1280))

    private companion object {
        const val SOUND = "https://cdn.zoonk.test/sound.mp3"
        const val BOOK = "w852dp-h883dp-xhdpi"
        const val PHONE = "w411dp-h891dp-xxhdpi"
        const val GALAXY_FOLD = "w707dp-h823dp-xhdpi"

        /** A Pixel Tablet, which has no fold. */
        const val TABLET = "w1280dp-h800dp-land-xhdpi"
        const val TABLET_PORTRAIT = "w800dp-h1280dp-port-xhdpi"

        /** A desktop window, wider than two of the lesson's columns. */
        const val DESKTOP = "w1920dp-h1080dp-land-mdpi"
    }
}
