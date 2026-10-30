package com.zoonk.android.feature.focustest

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
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
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.FocusTest
import com.zoonk.api.models.FocusTestGeneration
import com.zoonk.api.models.FocusTestInput
import com.zoonk.api.models.FocusTestResult
import com.zoonk.api.models.Generation
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.emptyFlow
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
import java.util.UUID

/**
 * Review screenshots of the focus test, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*FocusTestScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class FocusTestScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val drafts = TemporaryFolder()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private fun focusTest(written: Int): FocusTest {
        val areas = listOf("Matemática", "Ciências da Natureza", "Linguagens")
        val questions =
            (0 until written).map { index ->
                """{"itemId":"00000000-0000-4000-8000-00000000000$index","skillId":"00000000-0000-4000-8000-00000000000$index",
                "format":"multipleChoice","question":"Uma camiseta de R$80 está com 25% de desconto. Quanto você paga?",
                "options":["R$20","R$55","R$60","R$64"],"select":1,"context":null,"image":null,"visual":null,"area":"${areas[index / 2]}"}"""
            }
        return ApiJson.decodeFromString(
            FocusTest.serializer(),
            """{"areas":${areas.joinToString(",", "[", "]") { "\"$it\"" }},"needsItems":[],"questions":[${questions.joinToString(",")}],
            "questionsPerArea":2,"trueFalseLabels":"trueFalse"}""",
        )
    }

    private val result: FocusTestResult =
        ApiJson.decodeFromString(
            FocusTestResult.serializer(),
            """{"ceremony":null,"reached":{"energy":null,"level":null},"changeId":"00000000-0000-4000-8000-0000000000c1",
            "focusAreas":["Ciências da Natureza","Linguagens"],"areas":[
              {"answers":[true,true],"chosen":false,"correct":2,"label":"Matemática","name":"m","total":2},
              {"answers":[false,true],"chosen":true,"correct":1,"label":"Ciências da Natureza","name":"c","total":2},
              {"answers":[false,false],"chosen":true,"correct":0,"label":"Linguagens","name":"l","total":2}]}""",
        )

    private fun viewModel(
        written: Int,
        writing: Generation.Status,
    ): FocusTestViewModel {
        val api =
            object : FocusTestApi {
                override suspend fun focusTest(
                    session: AuthenticatedSession,
                    goalId: UUID,
                ) = focusTest(written)

                override suspend fun writeQuestions(
                    session: AuthenticatedSession,
                    goalId: UUID,
                ) = FocusTestGeneration("gen-1", FocusTestGeneration.Status.GENERATING)

                override suspend fun submit(
                    session: AuthenticatedSession,
                    goalId: UUID,
                    input: FocusTestInput,
                ) = result
            }
        val source =
            object : GenerationSource {
                override fun events(id: String) = emptyFlow<GenerationEvent>()

                override suspend fun status(id: String) = writing
            }
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        return FocusTestViewModel(
            UUID.randomUUID(),
            FocusTestStore(api, cache, DraftStore(drafts.root, CoroutineScope(SupervisorJob()))) { "UTC" },
            PlanStore(FakePlanApi(), cache),
            source,
            null,
            SavedStateHandle(),
        )
    }

    private fun write(name: String) {
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        File(folder, "$name.png").apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun show(
        name: String,
        written: Int = 6,
        answered: Int = 0,
        finished: Boolean = false,
        secondStep: Boolean = false,
        undo: Boolean = false,
        writing: Generation.Status = Generation.Status.RUNNING,
    ) {
        val viewModel = viewModel(written, writing)
        runBlocking { viewModel.test.refresh() }
        val read = (viewModel.test.state.value as LoadState.Loaded<*>).value as FocusTestRead
        viewModel.arrive(read)
        if (answered > 0 || finished) {
            viewModel.start(read)
            rule.waitForIdle()
            viewModel.ui.value.questions
                .take(if (finished) 6 else answered)
                .forEach { viewModel.answer(it, Answer.Choice(0)) }
        }
        rule.setContent {
            ZoonkTheme {
                val ui by viewModel.ui.collectAsStateWithLifecycle()
                val navigator = rememberAppNavigator()
                val outcome = ui.outcome
                when {
                    outcome != null -> FocusTestResult(outcome, ui, viewModel, AppContainer.preview(rule.activity), navigator)
                    ui.started -> FocusTestQuestions(read, ui, viewModel, AppContainer.preview(rule.activity), navigator) {}
                    else -> FocusTestIntro(read, ui, viewModel, navigator)
                }
            }
        }
        rule.mainClock.advanceTimeBy(10_000)
        if (secondStep) rule.onNodeWithText("Continue").performClick()
        if (undo) rule.onNodeWithText("Undo").performClick()
        write(name)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneIntro() = show("phone-intro")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneRun() = show("phone-run", answered = 1)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneWaiting() = show("phone-waiting", written = 2, answered = 2)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneWritingFailed() = show("phone-writing-failed", written = 2, answered = 2, writing = Generation.Status.FAILED)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletRun() = show("tablet-run", answered = 1)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneHowYouDid() = show("phone-how-you-did", finished = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneNewFocus() = show("phone-new-focus", finished = true, secondStep = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneHowYouDidLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        show("phone-how-you-did-font200", finished = true)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneNewFocusLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        show("phone-new-focus-font200", finished = true, secondStep = true)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneUndone() = show("phone-undone", finished = true, secondStep = true, undo = true)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletNewFocus() = show("tablet-new-focus", finished = true, secondStep = true)
}
