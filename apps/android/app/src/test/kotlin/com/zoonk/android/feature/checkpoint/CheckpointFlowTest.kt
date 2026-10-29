package com.zoonk.android.feature.checkpoint

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.practice.studyFeedback
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Checkpoint
import com.zoonk.api.models.StudyAnswerInput
import com.zoonk.api.models.StudyBlockCompletion
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class CheckpointFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aWonResultCountsOnlyTheCheckpointsOwnBrainPower() {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val read = checkpoint()
        val viewModel =
            CheckpointViewModel(
                read.blockId,
                CheckpointStore(
                    object : CheckpointApi {
                        override suspend fun checkpoint(
                            session: AuthenticatedSession,
                            blockId: UUID,
                        ) = read

                        override suspend fun answer(
                            session: AuthenticatedSession,
                            checkpoint: Checkpoint,
                            input: StudyAnswerInput,
                        ) = error("Not used")

                        override suspend fun finish(
                            session: AuthenticatedSession,
                            checkpoint: Checkpoint,
                            timeZone: String,
                        ): StudyBlockCompletion = error("Not used")
                    },
                    cache,
                ) { "UTC" },
            )
        val duel = Duel(read.read(), DuelState.of(read).finished(wonCompletion()))

        rule.setContent { ZoonkTheme { DuelResult(duel, viewModel, AppContainer.preview(rule.activity)) } }

        rule.onNodeWithText("You beat the Trickster!").assertIsDisplayed()
        rule.onNodeWithText("+30").assertIsDisplayed()
    }

    @Test
    fun aWonDuelSaysSoAndAsksNoMore() {
        val sent = mutableListOf<StudyAnswerInput>()
        val api =
            object : CheckpointApi {
                override suspend fun checkpoint(
                    session: AuthenticatedSession,
                    blockId: UUID,
                ) = checkpoint()

                override suspend fun answer(
                    session: AuthenticatedSession,
                    checkpoint: Checkpoint,
                    input: StudyAnswerInput,
                ) = studyFeedback(isCorrect = true).also { sent += input }

                override suspend fun finish(
                    session: AuthenticatedSession,
                    checkpoint: Checkpoint,
                    timeZone: String,
                ): StudyBlockCompletion = error("Not used")
            }
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val viewModel = CheckpointViewModel(checkpoint().blockId, CheckpointStore(api, cache) { "UTC" })
        runBlocking { viewModel.checkpoint.load() }
        viewModel.begin((viewModel.checkpoint.state.value as LoadState.Loaded).value)

        rule.setContent {
            ZoonkTheme {
                val duel by viewModel.duel.collectAsStateWithLifecycle()
                duel?.let { DuelPlay(it, viewModel, AppContainer.preview(rule.activity)) }
            }
        }

        rule.onNodeWithText("Confirm").assertIsNotEnabled()
        repeat(2) { round ->
            rule.onNodeWithText("Mars", substring = true).performClick()
            rule.onNodeWithText("Confirm").performClick()
            rule.onNodeWithText("Correct!").assertIsDisplayed()
            if (round == 0) rule.onNodeWithText("Next").performClick()
        }

        rule.onNodeWithText("His shield is broken. You won!").assertIsDisplayed()
        rule.onNodeWithText("See how it went").assertIsDisplayed()
        assertEquals(2, sent.size)
    }
}
