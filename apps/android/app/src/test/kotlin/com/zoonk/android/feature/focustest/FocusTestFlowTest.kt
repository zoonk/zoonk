package com.zoonk.android.feature.focustest

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
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
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class FocusTestFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val drafts = TemporaryFolder()

    private var writes = 0
    private var refuseRewrites = false

    private val focusTest: FocusTest =
        ApiJson.decodeFromString(
            FocusTest.serializer(),
            """{"areas":["Math","History"],"needsItems":[],"questionsPerArea":1,"trueFalseLabels":"trueFalse","questions":[
              {"itemId":"00000000-0000-4000-8000-000000000001","skillId":"00000000-0000-4000-8000-000000000001",
              "format":"multipleChoice","question":"2 + 2?","options":["4","5"],"select":1,"context":null,"image":null,
              "visual":null,"area":"Math"}]}""",
        )

    private fun viewModel(): FocusTestViewModel {
        val api =
            object : FocusTestApi {
                override suspend fun focusTest(
                    session: AuthenticatedSession,
                    goalId: UUID,
                ) = focusTest

                override suspend fun writeQuestions(
                    session: AuthenticatedSession,
                    goalId: UUID,
                ): FocusTestGeneration {
                    if (refuseRewrites && writes > 0) throw ApiException(ApiError.Unavailable, "SLOW_DOWN", 429)
                    return FocusTestGeneration("gen-$writes", FocusTestGeneration.Status.GENERATING).also { writes++ }
                }

                override suspend fun submit(
                    session: AuthenticatedSession,
                    goalId: UUID,
                    input: FocusTestInput,
                ): FocusTestResult = error("Not sent here")
            }
        val failing =
            object : GenerationSource {
                override fun events(id: String) = emptyFlow<GenerationEvent>()

                override suspend fun status(id: String) = Generation.Status.FAILED
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
            failing,
            null,
            SavedStateHandle(),
        )
    }

    @Test
    fun writingThatFailsCanBeTriedAgainOrFinishedWithTheAnswersGiven() {
        val viewModel = viewModel()
        runBlocking { viewModel.test.refresh() }
        val read = (viewModel.test.state.value as LoadState.Loaded<*>).value as FocusTestRead
        viewModel.arrive(read)
        viewModel.start(read)
        rule.waitForIdle()
        viewModel.answer(read.questions.single(), Answer.DontKnow)
        rule.setContent {
            ZoonkTheme {
                val ui by viewModel.ui.collectAsStateWithLifecycle()
                FocusTestQuestions(read, ui, viewModel, AppContainer.preview(rule.activity), rememberAppNavigator()) {}
            }
        }

        rule.onNodeWithText("Finish with these answers").assertIsEnabled()
        rule.onNodeWithText("Try again").performClick()
        rule.waitForIdle()

        assertEquals(2, writes)
    }

    @Test
    fun aLimitHitWhileWritingSaysSoAndLetsTheAnswersGivenFinish() {
        refuseRewrites = true
        val viewModel = viewModel()
        runBlocking { viewModel.test.refresh() }
        val read = (viewModel.test.state.value as LoadState.Loaded<*>).value as FocusTestRead
        viewModel.arrive(read)
        viewModel.start(read)
        rule.waitForIdle()
        viewModel.answer(read.questions.single(), Answer.DontKnow)
        rule.setContent {
            ZoonkTheme {
                val ui by viewModel.ui.collectAsStateWithLifecycle()
                FocusTestQuestions(read, ui, viewModel, AppContainer.preview(rule.activity), rememberAppNavigator()) {}
            }
        }

        rule.onNodeWithText("Try again").performClick()
        rule.waitForIdle()

        rule.onNodeWithText("Take a short break, then try again.").assertExists()
        rule.onNodeWithText("Finish with these answers").assertIsEnabled()
    }
}
