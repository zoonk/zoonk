package com.zoonk.android.feature.checkpoint

import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.practice.studyFeedback
import com.zoonk.android.feature.questions.Answer
import com.zoonk.api.models.Checkpoint
import com.zoonk.api.models.StudyAnswerFeedback
import com.zoonk.api.models.StudyAnswerInput
import com.zoonk.api.models.StudyBlockCompletion
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class CheckpointViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
    private val sent = mutableListOf<StudyAnswerInput>()
    private var read: Checkpoint = checkpoint()
    private var answer: (StudyAnswerInput) -> StudyAnswerFeedback = { studyFeedback(isCorrect = true) }
    private var finishes = 0
    private var finish: suspend () -> StudyBlockCompletion = {
        finishes++
        throw ApiException(ApiError.Network)
    }

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private suspend fun TestScope.started(): CheckpointViewModel {
        val api =
            object : CheckpointApi {
                override suspend fun checkpoint(
                    session: AuthenticatedSession,
                    blockId: UUID,
                ) = read

                override suspend fun answer(
                    session: AuthenticatedSession,
                    checkpoint: Checkpoint,
                    input: StudyAnswerInput,
                ) = input.also(sent::add).let(answer)

                override suspend fun finish(
                    session: AuthenticatedSession,
                    checkpoint: Checkpoint,
                    timeZone: String,
                ) = finish()
            }
        val viewModel =
            CheckpointViewModel(
                read.blockId,
                CheckpointStore(api, AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))) { "UTC" },
            ) { 0L }
        viewModel.checkpoint.load()
        advanceUntilIdle()
        viewModel.begin((viewModel.checkpoint.state.value as LoadState.Loaded).value)
        return viewModel
    }

    private val CheckpointViewModel.state get() = requireNotNull(duel.value).state

    @Test
    fun aWonDuelAsksNoMoreAndFinishesOnce() =
        runTest(dispatcher) {
            val viewModel = started()

            viewModel.confirm(Answer.Choice(0))
            advanceUntilIdle()
            viewModel.next()
            viewModel.confirm(Answer.Choice(0))
            advanceUntilIdle()
            assertEquals(DuelDecision.Won, viewModel.state.score(requireNotNull(viewModel.duel.value).read).decision)

            viewModel.next()
            viewModel.next()
            advanceUntilIdle()

            assertEquals(listOf(Q1, Q2), sent.map { it.itemId.toString() })
            assertEquals(1, finishes)
            assertEquals(DuelError.Finish, viewModel.state.error)
        }

    @Test
    fun tryAgainSendsTheSameAnswer() =
        runTest(dispatcher) {
            answer = { throw ApiException(ApiError.Network) }
            val viewModel = started()

            viewModel.confirm(Answer.Choice(1))
            advanceUntilIdle()
            assertEquals(DuelError.Answer, viewModel.state.error)

            answer = { studyFeedback(isCorrect = false) }
            viewModel.retry()
            advanceUntilIdle()

            assertEquals(2, sent.size)
            assertEquals(sent[0].answer, sent[1].answer)
            assertEquals(false, viewModel.state.feedback?.isCorrect)
            assertNull(viewModel.state.error)
        }

    @Test
    fun leavingWhileTheDuelFinishesWaitsForTheSave() =
        runTest(dispatcher) {
            val saved = CompletableDeferred<Unit>()
            finish = {
                saved.await()
                throw ApiException(ApiError.Network)
            }
            val viewModel = started()

            viewModel.confirm(Answer.Choice(0))
            advanceUntilIdle()
            viewModel.next()
            viewModel.confirm(Answer.Choice(0))
            advanceUntilIdle()
            viewModel.next()
            runCurrent()
            viewModel.close()
            runCurrent()
            assertEquals(false, viewModel.closed.value)

            saved.complete(Unit)
            advanceUntilIdle()
            assertEquals(true, viewModel.closed.value)
        }
}
