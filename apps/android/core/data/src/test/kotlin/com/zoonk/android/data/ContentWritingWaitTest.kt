package com.zoonk.android.data

import com.zoonk.api.models.Generation
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class ContentWritingWaitTest {
    private var sent = 0
    private val sessions = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))

    private fun TestScope.wait(runs: GenerationSource = WritingRuns()) =
        writingWaits(runs, sessions).create(
            GenerationKind.ConversationCall,
            CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler)),
        )

    @Test
    fun anAnswerWithoutARunGoesOn() =
        runTest {
            assertEquals(ContentWritingWait.Answer.Proceed, wait().answered(null) { sent++ })
        }

    @Test
    fun aRunIsFollowedThenTheRequestIsSentAgainOnceWritten() =
        runTest {
            val wait = wait()

            assertEquals(ContentWritingWait.Answer.Waiting, wait.answered("run-1") { sent++ })
            assertEquals("run-1", wait.generationId.value)
            assertEquals(0, sent)

            runCurrent()
            assertEquals(1, sent)
            assertEquals(ContentWritingWait.Answer.Proceed, wait.answered(null) { sent++ })
            assertNull(wait.generationId.value)
        }

    @Test
    fun aRunRightAfterAWrittenOneFailsRatherThanWaitingAgain() =
        runTest {
            val wait = wait()
            wait.answered("run-1") { sent++ }
            runCurrent()

            assertEquals(ContentWritingWait.Answer.Failed, wait.answered("run-2") { sent++ })
            assertNull(wait.generationId.value)
            runCurrent()
            assertEquals(1, sent)
        }

    @Test
    fun aFailedRunIsTriedAgainOnceBySendingTheRequestWithTheWaitStillShowing() =
        runTest {
            val wait = wait(WritingRuns(finishes = false))
            wait.answered("run-1") { sent++ }
            runCurrent()
            assertEquals(GenerationFailure.Generation, wait.run.value.failure)

            wait.retry()
            wait.retry()
            assertEquals(1, sent)
            assertEquals("run-1", wait.generationId.value)
            assertEquals(ContentWritingWait.Answer.Waiting, wait.answered("run-2") { sent++ })
        }

    @Test
    fun aRunWrittenAfterAnotherLearnerSignedInIsNeverSentAgainForThem() =
        runTest {
            val held = HeldRuns()
            val wait = wait(held)
            wait.answered("run-1") { sent++ }
            runCurrent()

            sessions.session = AuthenticatedSession("bia", "token-b", "local-b")
            held.write()
            runCurrent()

            assertEquals(0, sent)
            assertNull(wait.generationId.value)
        }

    @Test
    fun aLostConnectionFollowsTheSameRunAgain() =
        runTest {
            val runs = DroppingRuns()
            val wait = wait(runs)
            wait.answered("run-1") { sent++ }
            runCurrent()
            assertEquals(GenerationFailure.Connection, wait.run.value.failure)

            wait.retry()
            runCurrent()
            assertEquals(listOf("run-1", "run-1"), runs.followed)
            assertEquals(1, sent)
        }
}

/** Its first stream drops; the next one writes the call. */
private class DroppingRuns : GenerationSource {
    val followed = mutableListOf<String>()

    override fun events(id: String): Flow<GenerationEvent> =
        flow {
            followed += id
            if (followed.size == 1) throw IOException("dropped")
            emit(GenerationEvent(status = "completed", step = "callReady"))
        }

    override suspend fun status(id: String) = Generation.Status.COMPLETED
}
