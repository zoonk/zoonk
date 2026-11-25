package com.zoonk.android.feature.essay

import androidx.activity.ComponentActivity
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.feature.writing.WritingTaskName
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.runBlocking
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
 * Review screenshots of a written task, written only on demand:
 * `./gradlew :feature:exam:testDebugUnitTest --tests '*EssayScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 * The `-full` ones are as tall as their content, to read a whole result at once.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class EssayScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule(order = 2)
    val drafts = TemporaryFolder()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private val longAnswer = (ANSWER_TEXT + "\n\n").repeat(5).trim()

    private fun show(
        name: String,
        read: com.zoonk.api.models.Essay = essay(),
        dark: Boolean = false,
        fold: Boolean = false,
        prepare: suspend (EssayViewModel) -> Unit = {},
        screen: @Composable (EssayViewModel, EssayUi, com.zoonk.api.models.Essay) -> Unit,
    ) {
        val api = FakeEssayApi(read)
        val viewModel = essayViewModel(api, drafts.root)
        runBlocking { prepare(viewModel) }
        rule.waitForIdle()
        rule.setContent {
            ZoonkTheme(darkTheme = dark) {
                val ui by viewModel.ui.collectAsStateWithLifecycle()
                screen(viewModel, ui, read)
            }
        }
        rule.mainClock.advanceTimeBy(1_000)
        if (fold) rule.unfoldBook(folds)
        rule.waitForIdle()
        writeRender(File(folder, "$name.png"), rule.onRoot().captureRender().asAndroidBitmap())
    }

    private fun question(
        name: String,
        read: com.zoonk.api.models.Essay = essay(),
    ) = show(name, read) { viewModel, ui, essay -> WritingQuestionScreen(essay, ui, viewModel, rememberAppNavigator()) }

    private fun writing(
        name: String,
        text: String,
        fold: Boolean = false,
    ) = show(name, fold = fold, prepare = {
        it.startWriting()
        it.ui.value.field
            .setTextAndPlaceCursorAtEnd(text)
    }) { viewModel, ui, essay -> WriteScreen(essay, ui, viewModel, rememberAppNavigator()) }

    private fun result(
        name: String,
        grade: String,
        dark: Boolean = false,
        status: String = "active",
    ) = show(name, essay(graded = listOf(grade), status = status), dark) { viewModel, ui, essay ->
        ui.latest?.let { WritingResultScreen(essay, ui, it, false, 0, viewModel, rememberAppNavigator()) {} }
    }

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun question() = question("03-question")

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun questionWithADraft() = question("03-question-continue", essay(draft = "Half an answer."))

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun questionAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        question("03-question-font200")
    }

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun writing() = writing("04-writing", longAnswer)

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun writingPastTheLimit() = writing("04-writing-over-limit", (longAnswer + "\n\n").repeat(3))

    @Test
    @Config(qualifiers = "w320dp-h568dp-xhdpi")
    fun writingOnASmallPhone() = writing("04-writing-small", longAnswer)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun writingBesideTheQuestion() = writing("04-writing-expanded", longAnswer)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun writingOnABook() = writing("04-writing-book", longAnswer, fold = true)

    @Test
    @Config(qualifiers = "w390dp-h2400dp-xxhdpi")
    fun resultWithPoints() = result("05-result-scale-full", POINTS_RESULT)

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun resultWithPointsFirstScreen() = result("05-result-scale", POINTS_RESULT)

    @Test
    @Config(qualifiers = "w390dp-h2400dp-night-xxhdpi")
    fun resultWithPointsDark() = result("05b-result-scale-dark-full", POINTS_RESULT, dark = true)

    @Test
    @Config(qualifiers = "w390dp-h2400dp-xxhdpi")
    fun resultWithLevels() = result("06-result-levels-full", LEVELS_RESULT)

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun resultWithLevelsFirstScreen() = result("06-result-levels", LEVELS_RESULT)

    @Test
    @Config(qualifiers = "w390dp-h1600dp-xxhdpi")
    fun resultZeroed() = result("05-result-zeroed-full", ZEROED_RESULT)

    @Test
    @Config(qualifiers = "w390dp-h2400dp-xxhdpi")
    fun resultAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        result("06-result-levels-font200", LEVELS_RESULT)
    }

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun refused() =
        show("12-grades-used-up") { _, _, essay ->
            WritingRefused(
                com.zoonk.android.feature.writing
                    .writingTaskTitle(drill = false, task = null, fallback = null, lines = 30) to
                    essay.pacing.minutes.toInt(),
                busy = false,
                onContinue = {},
                onClose = {},
            )
        }

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun resultDone() = result("06-result-levels-done", DONE_RESULT)

    @Test
    @Config(qualifiers = "w390dp-h1600dp-xxhdpi")
    fun resultPastTheLimit() = result("05-result-over-limit-full", LIMIT_RESULT)

    @Test
    @Config(qualifiers = "w390dp-h1600dp-xxhdpi")
    fun resultZeroedWithItsKind() = result("05-result-zeroed-kind-full", ZEROED_KIND_RESULT)

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun taskRemoved() = show("13-task-removed") { _, _, _ -> WritingRemoved("Written answer", onClose = {}) }

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun questionFailed() =
        show("11b-question-failed") { _, _, _ -> WritingFailed("Written answer", drill = false, busy = false, onRetry = {}, onClose = {}) }

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun exerciseFailed() =
        show(
            "11c-drill-exercise-failed",
        ) { _, _, _ -> WritingFailed("Writing practice", drill = true, busy = false, onRetry = {}, onClose = {}) }

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun signUpRequired() = show("11d-sign-up-required") { _, _, _ -> WritingSignUp("Written answer", onCreateAccount = {}, onClose = {}) }

    @Test
    @Config(qualifiers = "w393dp-h851dp")
    fun reopenedBeforeStart() =
        show("03b-question-before-start") { _, _, _ ->
            WritingAvailable(
                header = "Written answer",
                drill = false,
                task = RefusedTask("A written question", 70, name = WritingTaskName(30, 1, 2, distinctLines = true)),
                busy = false,
                onWrite = {},
                onClose = {},
            )
        }

    @Test
    @Config(qualifiers = "w390dp-h844dp-xxhdpi")
    fun draftConflict() {
        rule.setContent { ZoonkTheme { DraftConflictDialog(onKeepThis = {}, onUseOther = {}) } }
        rule.waitForIdle()
        writeRender(File(folder, "04c-draft-conflict.png"), rule.onNode(isDialog()).captureRender().asAndroidBitmap())
    }
}
