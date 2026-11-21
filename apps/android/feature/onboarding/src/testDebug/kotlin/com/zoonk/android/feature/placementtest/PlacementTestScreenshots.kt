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
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.setup.PlacementQuestion
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.Select
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguageLevelTestOut
import com.zoonk.api.models.LanguageLevelTestResult
import com.zoonk.api.models.PlacementLength
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
    fun chooseLearn() = shoot("choose-learn") { LengthChoice(wholeCourseMinutes = 40, pressed = null, failed = false, onStart = {}) }

    @Test
    fun chooseOnboarding() =
        shoot("choose-onboarding") {
            LengthChoice(wholeCourseMinutes = 40, pressed = null, failed = false, onStart = {}, onSkip = {})
        }

    @Test
    fun chooseLanguage() =
        shoot("choose-language") {
            LengthChoice(
                wholeCourseMinutes = 60,
                pressed = null,
                failed = false,
                onStart = {},
                testOutLevel = "B2",
                initial = TestChoice.TestOut,
            )
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
    fun betweenParts() =
        shoot("between-parts") {
            BetweenParts(
                lessonsSkipped = 6,
                minutesLeft = 25,
                pressed = null,
                failed = false,
                onFinishForToday = {},
                onKeepGoing = {},
                undo = undo(),
            )
        }

    @Test
    fun betweenOnboardingParts() =
        shoot("between-onboarding-parts") {
            BetweenParts(
                lessonsSkipped = 6,
                minutesLeft = 25,
                pressed = null,
                failed = false,
                onFinishForToday = {},
                onKeepGoing = {},
                undo = undo(),
                inSetup = true,
            )
        }

    @Test
    fun resultQuick() =
        shoot("result-quick") {
            PlacementResult(PlacementLength.QUICK, lessonsSkipped = 1, nextTopic = "Contracts", onDone = {}, undo = undo())
        }

    @Test
    fun resultNothingSkipped() =
        shoot(
            "result-nothing-skipped",
        ) { PlacementResult(PlacementLength.WHOLE_COURSE, lessonsSkipped = 0, nextTopic = "Torts", onDone = {}) }

    @Test
    fun levelResult() =
        shoot("level-result") {
            LevelResult(
                result = ApiJson.decodeFromString(LanguageLevelTestResult.serializer(), LEVEL_RESULT),
                walks = false,
                targetLanguage = "it",
                testOutLevel = "B2",
                pressed = null,
                failed = false,
                onDone = {},
                onWalkTopics = {},
                onTestOut = {},
                undo = undo(),
            )
        }

    @Test
    fun testOutResult() =
        shoot("test-out-result") {
            TestOutResult(ApiJson.decodeFromString(LanguageLevelTestOut.serializer(), TEST_OUT), onDone = {}, undo = undo())
        }

    @Test
    fun levelResultAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        levelResult()
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
        eyebrow = "Contract law · Part 1",
        labels = TrueFalseLabels.TRUE_FALSE,
        pending = false,
        saveFailures = 0,
        onAnswer = { _, _ -> },
        onStop = {},
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
        content: @Composable ColumnScope.() -> Unit,
    ) {
        compose.setContent {
            ZoonkTheme(darkTheme = theme == "dark") {
                TaskScaffold(onClose = {}) { padding ->
                    Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) { SetupColumn(content = content) }
                }
            }
        }
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
             "lessonsSkipped":12,"levelsSkipped":["A1"],"ranges":{"reading":{"low":"B1","high":"B2"},"listening":{"low":"A2","high":"B1"}}}}"""

        const val TEST_OUT =
            """{"answered":12,"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","level":"B2","next":null,"preparing":false,"total":12,
             "result":{"finishedAt":"2026-11-21T14:00:00Z","lessonsSkipped":9,"topicsSkipped":[]}}"""
    }
}
