package com.zoonk.android.feature.placementtest

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.isRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.TestContext
import com.zoonk.android.data.TestRow
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.setup.PlacementDone
import com.zoonk.android.feature.onboarding.setup.PlacementQuestion
import com.zoonk.android.feature.onboarding.setup.PlacementWaiting
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.Select
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguageLevelTestOut
import com.zoonk.api.models.LanguageLevelTestResult
import com.zoonk.api.models.TrueFalseLabels
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.UUID

/**
 * Review screenshots of the tests taken from the plan, on phone and tablet, in light, dark and twice the font size, written only on demand:
 * `./gradlew :feature:onboarding:testDebugUnitTest --tests '*PlacementTestScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h891dp-xxhdpi")
class PlacementTestScreenshots(
    private val theme: String,
    private val device: String,
) {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() {
        assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())
        if (device == "tablet") RuntimeEnvironment.setQualifiers("w1280dp-h800dp-land-xhdpi")
    }

    @Test
    fun courseOfferOnboarding() =
        shoot("course-offer-onboarding") {
            TestOffer(
                title = "Where would you like to start?",
                sentence = "A test finds the lessons you can skip.",
                rows =
                    listOf(
                        firstLessonRow(),
                        OfferRow(TestRow.Quick, "Quick test", testFacts(12, 6).factsLine()),
                        OfferRow(TestRow.WholeCourse, "Full test", fullTestFacts(14, 85).factsLine()),
                    ),
                initial = TestRow.Quick,
                pressed = null,
                failed = false,
                onChoose = {},
                test = TEST,
            )
        }

    @Test
    fun courseOfferPlan() =
        shoot("course-offer-plan") {
            TestOffer(
                title = "Skip what you already know",
                sentence = "A test finds the lessons you can skip.",
                rows =
                    listOf(
                        OfferRow(TestRow.Quick, "Quick test", testFacts(12, 6).factsLine()),
                        OfferRow(TestRow.WholeCourse, "Full test", fullTestFacts(14, 85).factsLine()),
                    ),
                initial = TestRow.Quick,
                pressed = null,
                failed = false,
                onChoose = {},
                test = TEST,
                onNotNow = {},
            )
        }

    @Test
    fun courseOfferPlanOneTest() =
        shoot("course-offer-plan-one-test") {
            TestOffer(
                title = "Skip what you already know",
                sentence = "A test finds the lessons you can skip.",
                rows = listOf(OfferRow(TestRow.Quick, "Quick test", "")),
                initial = TestRow.Quick,
                pressed = null,
                failed = false,
                onChoose = {},
                test = TEST,
                chip = "Test what you know",
                facts = testFacts(12, 6),
                onNotNow = {},
            )
        }

    @Test
    fun languageOfferPlan() =
        shoot("language-offer-plan") {
            TestOffer(
                title = "Skip what you already know",
                sentence = "A test finds the lessons you can skip.",
                rows =
                    listOf(
                        OfferRow(TestRow.Quick, "Level test", testFacts(12, 6).factsLine()),
                        OfferRow(TestRow.TestOut, "Test out of B2", "Skip B2 if you already know it"),
                    ),
                initial = TestRow.TestOut,
                pressed = null,
                failed = false,
                onChoose = {},
                test = TEST,
                onNotNow = {},
            )
        }

    @Test
    fun continueBetweenParts() =
        shoot("course-continue-between-parts") {
            ContinueTest(listOf("Part 4 of 14", "About 1 hr 6 min left"), null, false, {}, "Not now", {})
        }

    @Test
    fun continueStopped() =
        shoot("course-continue-stopped") {
            ContinueTest(listOf("Part 5 of 14", "Question 4 of 12"), null, false, {}, "Not now", {})
        }

    @Test
    fun questionFullTest() =
        shoot("course-question-full") {
            Ask(QuestionFormat.Order, "Put a civil case's stages in order.", options = listOf("Complaint", "Answer", "Discovery", "Trial"))
        }

    @Test
    fun questionOrder() =
        shoot("question-order") {
            Ask(QuestionFormat.Order, "Put a civil case's stages in order.", options = listOf("Complaint", "Answer", "Discovery", "Trial"))
        }

    @Test
    fun questionMatch() =
        shoot("question-match") {
            Ask(
                QuestionFormat.MatchPairs,
                "Match each term to what it means.",
                left = listOf("Plaintiff", "Defendant", "Verdict", "Appeal"),
                right = listOf("The decision", "Who is sued", "Asking a higher court", "Who sues"),
            )
        }

    @Test
    fun questionSelectAll() =
        shoot("question-select-all") {
            Ask(
                QuestionFormat.MultipleChoice,
                "Which of these can end a contract?",
                options = listOf("Performance", "Breach", "Agreement", "A full moon", "Impossibility"),
                select = Select.All,
            )
        }

    @Test
    fun partOver() = shoot("part-over") { PlacementDone(pending = false, failed = false, onContinue = {}) }

    @Test
    fun partDone() =
        shoot("course-checkpoint", captureUndo = true, undone = "Part 3 of 14 done") {
            PartDone(3, 14, 2, heldUntilTomorrow = false, partsLeft = 11, minutesLeft = 66, null, false, {}, {}, undo())
        }

    @Test
    fun partDoneNothingSkipped() =
        shoot("course-checkpoint-none-skipped") {
            PartDone(3, 14, 0, heldUntilTomorrow = false, partsLeft = 1, minutesLeft = 6, null, false, {}, {}, undo = null)
        }

    @Test
    fun partStopped() =
        shoot("course-stopped") {
            PartStopped(5, 14, 4, lessonsSkipped = 1, action = "Done", onAction = {}, busy = false, undo = undo())
        }

    @Test
    fun resultQuick() =
        shoot("course-result-quick", captureUndo = true) {
            PlacementResult(
                lessonsSkipped = 5,
                nextLesson = "Loops with for",
                action = "Start lesson",
                onAction = {},
                undo = undo(),
                rest = partsLeftFacts(13, 78),
                onTestTheRest = {},
            )
        }

    @Test
    fun resultNothingSkipped() =
        shoot("course-result-none-skipped") {
            PlacementResult(lessonsSkipped = 0, nextLesson = "Loops with for", action = "Continue", onAction = {})
        }

    @Test
    fun resultHeldUntilTomorrow() =
        shoot("course-result-retake-tomorrow") {
            PlacementResult(lessonsSkipped = 0, nextLesson = null, action = "Done", onAction = {}, heldUntilTomorrow = true)
        }

    @Test
    fun levelResult() =
        shoot("level-result", captureUndo = true) {
            LevelResult(
                result = ApiJson.decodeFromString(LanguageLevelTestResult.serializer(), LEVEL_RESULT),
                targetLanguage = "it",
                testOutLevel = "B2",
                pressed = null,
                failed = false,
                action = "Start lesson",
                onAction = {},
                onTestOut = {},
                undo = undo(),
            )
        }

    @Test
    fun levelResultListeningNotTested() =
        shoot("language-result-listening-not-tested") {
            LevelResult(
                result = ApiJson.decodeFromString(LanguageLevelTestResult.serializer(), READING_ONLY),
                targetLanguage = "it",
                testOutLevel = null,
                pressed = null,
                failed = false,
                action = "Continue",
                onAction = {},
                onTestOut = {},
            )
        }

    @Test
    fun testOutResult() =
        shoot("test-out-result", captureUndo = true) {
            TestOutResult(ApiJson.decodeFromString(LanguageLevelTestOut.serializer(), TEST_OUT), onDone = {}, undo = undo())
        }

    @Test
    fun existingPlanWait() =
        shoot("wait-plan") {
            PlacementWaiting(
                run = GenerationRun(),
                onRetry = null,
                hold = rememberReadyHold(ready = false),
                pending = false,
                failed = false,
                onSkip = {},
                onboarding = false,
            )
        }

    @Test
    fun onboardingWait() =
        shoot("wait-onboarding") {
            PlacementWaiting(
                run = GenerationRun(),
                onRetry = null,
                hold = rememberReadyHold(ready = false),
                pending = false,
                failed = false,
                onSkip = {},
                onboarding = true,
            )
        }

    @Test
    fun failedWait() =
        shoot("wait-failed") {
            PlacementWaiting(
                run = GenerationRun(GenerationRun.Status.Failed, GenerationFailure.Generation),
                onRetry = {},
                hold = rememberReadyHold(ready = false),
                pending = false,
                failed = false,
                onSkip = {},
                onboarding = false,
            )
        }

    @Test
    fun testOutWithoutQuestions() =
        shoot("unavailable-b2") {
            val test = ApiJson.decodeFromString(LanguageLevelTestOut.serializer(), TEST_OUT)
            TestOutResult(test.copy(answered = 0, total = 0, result = null), onDone = {})
        }

    @Test
    fun levelResultAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        levelResult()
    }

    @Test
    fun offerAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        courseOfferOnboarding()
    }

    @Test
    fun questionAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        questionFullTest()
    }

    @Test
    fun checkpointAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        partDone()
    }

    @Test
    fun resultAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        resultQuick()
    }

    @Test
    fun continueAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        continueBetweenParts()
    }

    @Composable
    private fun ColumnScope.Ask(
        format: QuestionFormat,
        question: String,
        options: List<String>? = null,
        left: List<String>? = null,
        right: List<String>? = null,
        select: Select? = null,
    ) = PlacementQuestion(
        item = Question("item-1", format, question, options = options, select = select, left = left, right = right),
        subject = "Contract law",
        position = "Part 3 of 14 · Question 5 of 12",
        labels = TrueFalseLabels.TRUE_FALSE,
        pending = false,
        saveFailures = 0,
        onAnswer = { _, _ -> },
        onStop = {},
        canStop = true,
    )

    @Composable
    private fun undo(): PlacementUndoViewModel? {
        val plans =
            remember {
                val session = FakeSession(AuthenticatedSession("learner", "token", "local"))
                PlanStore(FakePlanApi(), AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)))
            }
        return rememberPlacementUndo(plans, UUID.fromString(GOAL_ID), UUID(0, 1))
    }

    private fun shoot(
        name: String,
        captureUndo: Boolean = false,
        undone: String = "No lessons skipped",
        content: @Composable ColumnScope.() -> Unit,
    ) {
        compose.setContent {
            ZoonkTheme(darkTheme = theme == "dark") {
                TaskScaffold(onClose = {}) { padding ->
                    Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) { SetupColumn(content = content) }
                }
            }
        }
        capture(name)
        if (captureUndo) {
            compose.onNodeWithText("Undo").performClick()
            compose.onNodeWithText(undone).assertExists()
            capture("$name-undo")
        }
    }

    private fun capture(name: String) {
        compose.waitForIdle()
        val bitmap =
            compose
                .onAllNodes(isRoot())
                .onLast()
                .captureRender()
                .asAndroidBitmap()
        val scale = if (RuntimeEnvironment.getFontScale() > 1f) "-2x" else ""
        val file = File(folder, "placement-test/$name-$device-$theme$scale.png").apply { parentFile?.mkdirs() }
        writeRender(file, bitmap)
        println("Screenshot ${file.path}")
    }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0}-{1}")
        fun screens() =
            listOf(
                arrayOf<Any>("light", "phone"),
                arrayOf<Any>("dark", "phone"),
                arrayOf<Any>("light", "tablet"),
                arrayOf<Any>("dark", "tablet"),
            )

        const val LEVEL_RESULT =
            """{"levels":[],"result":{"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","finishedAt":"2026-11-21T14:00:00Z",
             "lessonsSkipped":12,"levelsSkipped":["A1"],"ranges":{"reading":{"low":"B1","high":"B2"},"listening":{"low":"A2","high":"B1"}},
             "nextLesson":{"id":"1a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","title":"Ordering at a restaurant"}}}"""

        val TEST = TestContext(GOAL_ID, TestContext.Kind.Course, TestContext.Surface.Plan)

        const val READING_ONLY =
            """{"levels":[],"result":{"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","finishedAt":"2026-11-21T14:00:00Z","end":"audio_deferred",
             "lessonsSkipped":0,"levelsSkipped":[],"ranges":{"reading":{"low":"B1","high":"B2"}}}}"""

        const val TEST_OUT =
            """{"answered":12,"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","level":"B2","next":null,"preparing":false,"total":12,
             "result":{"finishedAt":"2026-11-21T14:00:00Z","lessonsSkipped":9,"topicsSkipped":[]}}"""
    }
}
