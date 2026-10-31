package com.zoonk.android.feature.testout

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.ChapterTestOutInput
import com.zoonk.api.models.ChapterTestOutRecord
import com.zoonk.api.models.ChapterTestOutResult
import com.zoonk.api.models.CreateChapterTestOutGeneration200Response
import com.zoonk.api.models.Generation
import com.zoonk.api.models.MistakePatternPracticeResultReached
import com.zoonk.api.models.SubmitChapterTestOut200Response
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.runBlocking
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.UUID

/**
 * Review screenshots of the test-out, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*TestOutScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TestOutScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private val questions =
        listOf(
            Question(
                "00000000-0000-4000-8000-000000000001",
                QuestionFormat.MultipleChoice,
                "Uma camiseta de R$80 está com 25% de desconto. Quanto você paga?",
                listOf("R$20", "R$55", "R$60", "R$64"),
            ),
            Question("00000000-0000-4000-8000-000000000002", QuestionFormat.MultipleChoice, "Q2", listOf("a", "b")),
            Question("00000000-0000-4000-8000-000000000003", QuestionFormat.MultipleChoice, "Q3", listOf("a", "b")),
        )

    private val page = TestOutPage("Test out: Porcentagem", "Porcentagem", lessonsLeft = 4)

    private fun viewModel(passed: Boolean = true): TestOutViewModel {
        val api =
            object : TestOutApi {
                override suspend fun testOut(
                    session: AuthenticatedSession,
                    key: TestOutKey,
                ) = TestOutRead.Ready(0.8, questions, TrueFalseWords.TrueFalse)

                override suspend fun writeQuestions(
                    session: AuthenticatedSession,
                    key: TestOutKey,
                ): CreateChapterTestOutGeneration200Response = error("Not used")

                override suspend fun submit(
                    session: AuthenticatedSession,
                    key: TestOutKey,
                    input: ChapterTestOutInput,
                ) = SubmitChapterTestOut200Response.ChapterTestOutResultValue(
                    ChapterTestOutResult(
                        ceremony = null,
                        reached = MistakePatternPracticeResultReached(energy = null, level = null),
                        changeId = UUID.randomUUID().takeIf { passed },
                        correct = if (passed) 3 else 1,
                        lessonsSkipped = if (passed) 4 else 0,
                        passed = passed,
                        total = 3,
                    ),
                )

                override suspend fun recorded(
                    session: AuthenticatedSession,
                    key: RecordKey,
                ): ChapterTestOutRecord = error("Not used")
            }
        val source =
            object : GenerationSource {
                override fun events(id: String) = emptyFlow<GenerationEvent>()

                override suspend fun status(id: String) = Generation.Status.RUNNING
            }
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val key = TestOutKey(UUID.randomUUID(), UUID.randomUUID())
        val drafts = DraftStore(File(folder, "drafts"), CoroutineScope(Dispatchers.Main.immediate))
        val store = TestOutStore(api, cache, drafts) { "UTC" }
        return TestOutViewModel(key, store, PlanStore(FakePlanApi(), cache), null, source, SavedStateHandle())
    }

    private fun write(name: String) {
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        File(folder, "$name.png").apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun intro(
        name: String,
        plusRequired: Boolean = false,
    ) {
        val viewModel = viewModel()
        rule.setContent {
            ZoonkTheme {
                val ui by viewModel.ui.collectAsStateWithLifecycle()
                TestOutPreparing(viewModel, ui, page.title, plusRequired, rememberAppNavigator())
            }
        }
        write(name)
    }

    private fun run(name: String) {
        val viewModel = viewModel()
        runBlocking { viewModel.testOut.load() }
        viewModel.begin(questions)
        rule.setContent {
            ZoonkTheme {
                val ui by viewModel.ui.collectAsStateWithLifecycle()
                TestOutQuestions(
                    TestOutRead.Ready(0.8, questions, TrueFalseWords.TrueFalse),
                    viewModel,
                    ui,
                    page,
                    AppContainer.preview(rule.activity),
                ) {}
            }
        }
        write(name)
    }

    private fun result(
        name: String,
        passed: Boolean = true,
    ) {
        val viewModel = viewModel(passed)
        viewModel.begin(questions)
        rule.waitForIdle()
        questions.forEach { viewModel.answer(questions, it, Answer.Choice(0)) }
        rule.setContent {
            ZoonkTheme {
                val ui by viewModel.ui.collectAsStateWithLifecycle()
                ui.outcome?.let { TestOutResult(it, ui, viewModel, AppContainer.preview(rule.activity)) {} }
            }
        }
        rule.mainClock.advanceTimeBy(10_000)
        write(name)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneIntro() = intro("phone-intro")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phonePlusRequired() = intro("phone-plus", plusRequired = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phonePlusRequiredLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        intro("phone-plus-font200", plusRequired = true)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneRun() = run("phone-run")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneRunLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        run("phone-run-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletRun() = run("tablet-run")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phonePassed() = result("phone-passed")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneNotPassed() = result("phone-not-passed", passed = false)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletPassed() = result("tablet-passed")
}
