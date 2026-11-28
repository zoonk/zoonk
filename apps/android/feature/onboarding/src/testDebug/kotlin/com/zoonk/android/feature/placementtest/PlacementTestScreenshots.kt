package com.zoonk.android.feature.placementtest

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.test.onNodeWithContentDescription
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
import com.zoonk.android.feature.onboarding.placementResultOf
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
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguageLevelTestOut
import com.zoonk.api.models.LanguageLevelTestResult
import com.zoonk.api.models.PlacementResultCourse
import com.zoonk.api.models.PlacementResultCourseChaptersInner
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
                cards = listOf(testCard(TestRow.Quick, "Test", 8, 4), firstLessonCard("Why companies sell shares")),
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
                cards = listOf(testCard(TestRow.Quick, "Test", 8, 4)),
                initial = TestRow.Quick,
                pressed = null,
                failed = false,
                onChoose = {},
                test = TEST,
                onNotNow = {},
            )
        }

    @Test
    fun languageOfferPlan() =
        shoot("language-offer-plan") {
            TestOffer(
                title = "Skip what you already know",
                sentence = "A test finds the lessons you can skip.",
                cards =
                    listOf(
                        testCard(TestRow.Quick, "Level test", 12, 6),
                        OfferCard(TestRow.TestOut, "Test out of B2", LearnKind.Mock, line = "Skip B2 if you already know it"),
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
    fun question() =
        shoot("course-question", sitting = asking(answered = 1)) {
            Ask(
                QuestionFormat.MultipleChoice,
                "What's the main difference?",
                options =
                    listOf(
                        "A share pays a fixed amount every month",
                        "A share makes you a part-owner, with no guaranteed return",
                        "A share is a loan the company pays back with interest",
                    ),
            )
        }

    /** A topic too long for the bar's one line. */
    @Test
    fun questionLongTopic() =
        shoot(
            "course-question-long-topic",
            sitting = asking(answered = 2, title = "Constitutional limits on the taxing power of states and municipalities"),
        ) {
            Ask(QuestionFormat.Order, "Put a civil case's stages in order.", options = listOf("Complaint", "Answer", "Discovery", "Trial"))
        }

    @Test
    fun questionMatch() =
        shoot("question-match", sitting = asking(answered = 4)) {
            Ask(
                QuestionFormat.MatchPairs,
                "Match each term to what it means.",
                left = listOf("Share", "Dividend", "Dilution", "Buyback"),
                right =
                    listOf(
                        "Profit paid out to owners",
                        "The company buying its own shares",
                        "A slice of the company",
                        "Your stake shrinking as shares are added",
                    ),
            )
        }

    @Test
    fun questionSelectAll() =
        shoot("question-select-all", sitting = asking(answered = 4)) {
            Ask(
                QuestionFormat.MultipleChoice,
                "Which of these can shrink your share of a company?",
                options =
                    listOf(
                        "The company issues new shares",
                        "Employees turn stock options into shares",
                        "The share price falls",
                        "Bonds convert into shares",
                    ),
                select = Select.All,
            )
        }

    /** The language test's bar: its reading, listening and check drawn apart. */
    @Test
    fun languageQuestion() =
        shoot("language-question", sitting = asking(answered = 5, title = "Listening", total = 12, groups = listOf(4, 4, 4))) {
            Ask(QuestionFormat.MultipleChoice, "Qual é a principal mensagem de Dan?", options = listOf("Vai chegar amanhã", "Vai cancelar"))
        }

    /** ✕ once stopping gives a result: the two ways out. */
    @Test
    fun waysOut() =
        shoot("course-ways-out", sitting = asking(answered = 1, stop = TestStop {}), waysOut = true) {
            Ask(
                QuestionFormat.MultipleChoice,
                "What's the main difference?",
                options = listOf("A loan", "Part ownership", "A fixed payment"),
            )
        }

    /** The Focus test's ways out carry its hint for a learner who hasn't studied most of it yet. */
    @Test
    fun waysOutWithHint() =
        shoot(
            "focus-ways-out-hint",
            sitting =
                asking(
                    answered = 6,
                    title = "Administrative law",
                    stop = TestStop("Haven't studied most of this yet? That's fine. You can stop here and start learning.") {},
                ),
            waysOut = true,
        ) {
            Ask(QuestionFormat.MultipleChoice, "Which act can a public agent revoke?", options = listOf("Its own", "A court's", "None"))
        }

    @Test
    fun over() = shoot("course-over", sitting = Sitting()) { PlacementDone(pending = false, failed = false, onContinue = {}) }

    @Test
    fun result() =
        shoot("course-result", captureUndo = true, sitting = Sitting()) {
            PlacementResult(result = placementResultOf().phase(), action = "Start lesson", onAction = {}, undo = undo())
        }

    /** The Plan's row opens the last result, with Done and a quiet way to take the test again. */
    @Test
    fun planSavedResult() =
        shoot("course-plan-saved-result", captureUndo = true, sitting = Sitting()) {
            PlacementResult(result = placementResultOf().phase(), action = "Done", onAction = {}, undo = undo(), onRetake = {})
        }

    @Test
    fun resultNothingSkipped() =
        shoot("course-result-none-skipped", sitting = Sitting()) {
            val course =
                PlacementResultCourse(
                    lessons = 9,
                    chapters =
                        listOf(
                            PlacementResultCourseChaptersInner(done = 0, lessons = 3, skipped = 0, start = true),
                            PlacementResultCourseChaptersInner(done = 0, lessons = 3, skipped = 0, start = false),
                            PlacementResultCourseChaptersInner(done = 0, lessons = 3, skipped = 0, start = false),
                        ),
                )
            PlacementResult(
                result = placementResultOf(lessonsSkipped = 0, chapter = "How trading works", course = course, changeId = null).phase(),
                action = "Start lesson",
                onAction = {},
            )
        }

    /** A course with several areas: the skips aren't one run, and the start sits before chapters with skipped lessons. */
    @Test
    fun resultAreasInterleaved() =
        shoot("course-result-areas", sitting = Sitting()) {
            val course =
                PlacementResultCourse(
                    lessons = 14,
                    chapters =
                        listOf(
                            PlacementResultCourseChaptersInner(done = 0, lessons = 3, skipped = 3, start = false),
                            PlacementResultCourseChaptersInner(done = 0, lessons = 3, skipped = 0, start = true),
                            PlacementResultCourseChaptersInner(done = 0, lessons = 2, skipped = 2, start = false),
                            PlacementResultCourseChaptersInner(done = 0, lessons = 3, skipped = 1, start = false),
                            PlacementResultCourseChaptersInner(done = 0, lessons = 3, skipped = 0, start = false),
                        ),
                )
            PlacementResult(
                result = placementResultOf(lessonsSkipped = 6, course = course).phase(),
                action = "Start lesson",
                onAction = {},
                undo = undo(),
            )
        }

    /**
     * A learner who studied the first chapters before taking the test from the plan: those lessons fill the line too, so
     * nothing reads as a gap before the start.
     */
    @Test
    fun resultStudiedBeforeTheStart() =
        shoot("course-result-studied-before-start", sitting = Sitting()) {
            val course =
                PlacementResultCourse(
                    lessons = 12,
                    chapters =
                        listOf(
                            PlacementResultCourseChaptersInner(done = 3, lessons = 3, skipped = 0, start = false),
                            PlacementResultCourseChaptersInner(done = 2, lessons = 3, skipped = 1, start = false),
                            PlacementResultCourseChaptersInner(done = 0, lessons = 3, skipped = 1, start = true),
                            PlacementResultCourseChaptersInner(done = 0, lessons = 3, skipped = 0, start = false),
                        ),
                )
            PlacementResult(result = placementResultOf(lessonsSkipped = 2, course = course).phase(), action = "Start lesson", onAction = {})
        }

    /** A saved result opened after more study: lessons studied past the start fill their chapters as well. */
    @Test
    fun resultStudiedAfterTheResult() =
        shoot("course-result-studied-after", sitting = Sitting()) {
            val course =
                PlacementResultCourse(
                    lessons = 12,
                    chapters =
                        listOf(
                            PlacementResultCourseChaptersInner(done = 0, lessons = 3, skipped = 3, start = false),
                            PlacementResultCourseChaptersInner(done = 2, lessons = 3, skipped = 0, start = true),
                            PlacementResultCourseChaptersInner(done = 3, lessons = 3, skipped = 0, start = false),
                            PlacementResultCourseChaptersInner(done = 1, lessons = 3, skipped = 0, start = false),
                        ),
                )
            PlacementResult(result = placementResultOf(lessonsSkipped = 3, course = course).phase(), action = "Done", onAction = {})
        }

    /** A result from before the plan existed: where the learner starts, and the way on. */
    @Test
    fun resultWithoutCourse() =
        shoot("course-result-without-course", sitting = Sitting()) {
            PlacementResult(result = placementResultOf(course = null, changeId = null).phase(), action = "Continue", onAction = {})
        }

    @Test
    fun resultHeldUntilTomorrow() =
        shoot("course-result-retake-tomorrow", sitting = Sitting()) {
            val held = placementResultOf(lessonsSkipped = 0, changeId = null).phase().copy(heldUntilTomorrow = true, chapter = null)
            PlacementResult(result = held, action = "Done", onAction = {})
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

    /** The plan's first lesson isn't written yet: no lesson to name, so no "Up next" and the way out is Done. */
    @Test
    fun levelResultWithoutNextLesson() =
        shoot("level-result-no-next-lesson") {
            LevelResult(
                result = ApiJson.decodeFromString(LanguageLevelTestResult.serializer(), LEVEL_RESULT.replace(NEXT_LESSON, "null")),
                targetLanguage = "it",
                testOutLevel = null,
                pressed = null,
                failed = false,
                action = "Done",
                onAction = {},
                onTestOut = {},
            )
        }

    /** A stop saved without a name (older plans) is called what the Plan calls it. */
    @Test
    fun resultUnnamedStop() =
        shoot("course-result-unnamed-stop", sitting = Sitting()) {
            PlacementResult(result = placementResultOf(chapter = null).phase(), action = "Start lesson", onAction = {})
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
        question()
    }

    @Test
    fun resultAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        result()
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
        labels = TrueFalseLabels.TRUE_FALSE,
        pending = false,
        saveFailures = 0,
        onAnswer = { _, _ -> },
    )

    private fun asking(
        answered: Long,
        title: String = "When ownership is diluted",
        total: Long = 8,
        groups: List<Int> = emptyList(),
        stop: TestStop? = null,
    ) = asking(TEST, title, answered, total, groups, stop)

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
        sitting: Sitting? = null,
        waysOut: Boolean = false,
        content: @Composable ColumnScope.() -> Unit,
    ) {
        compose.setContent {
            ZoonkTheme(darkTheme = theme == "dark") {
                val open = rememberWaysOut()
                TaskScaffold(onClose = { closeTest(sitting, open) {} }, title = { TestTitle(sitting) }) { padding ->
                    Column(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
                        TestSegments(sitting)
                        Box(Modifier.weight(1f)) { SetupColumn(content = content) }
                    }
                }
                TestWaysOut(sitting, open) {}
            }
        }
        if (waysOut) compose.onNodeWithContentDescription("Leave").performClick()
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

        const val NEXT_LESSON = """{"id":"1a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","title":"Ordering at a restaurant"}"""

        const val LEVEL_RESULT =
            """{"levels":[],"result":{"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","finishedAt":"2026-11-21T14:00:00Z",
             "lessonsSkipped":12,"levelsSkipped":["A1"],"ranges":{"reading":{"low":"B1","high":"B2"},"listening":{"low":"A2","high":"B1"}},
             "nextLesson":$NEXT_LESSON}}"""

        val TEST = TestContext(GOAL_ID, TestContext.Kind.Course, TestContext.Surface.Plan)

        const val READING_ONLY =
            """{"levels":[],"result":{"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","finishedAt":"2026-11-21T14:00:00Z","end":"audio_deferred",
             "lessonsSkipped":0,"levelsSkipped":[],"ranges":{"reading":{"low":"B1","high":"B2"}}}}"""

        const val TEST_OUT =
            """{"answered":12,"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","level":"B2","next":null,"preparing":false,"total":12,
             "result":{"finishedAt":"2026-11-21T14:00:00Z","lessonsSkipped":9,"topicsSkipped":[]}}"""
    }
}
