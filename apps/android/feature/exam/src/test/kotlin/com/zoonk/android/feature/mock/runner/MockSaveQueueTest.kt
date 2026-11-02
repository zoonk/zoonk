package com.zoonk.android.feature.mock.runner

import com.zoonk.android.feature.questions.Answer
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MockSaveQueueTest {
    private val sent = mutableListOf<MockDraft>()
    private val results = ArrayDeque<SendResult>()
    private var gate: CompletableDeferred<Unit>? = null
    private val kept = mutableListOf<List<MockDraft>>()
    private lateinit var queue: MockSaveQueue

    private fun TestScope.queue() =
        MockSaveQueue(
            scope = this,
            send = { draft ->
                gate?.await()
                sent += draft
                results.removeFirstOrNull() ?: SendResult.Stored
            },
            onPendingChange = { kept += queue.pending },
        ).also { queue = it }

    private fun draft(
        item: String,
        pick: Int,
    ) = MockDraft(item, Answer.Choice(pick))

    @Test
    fun answersGoOutInTheOrderTheyWereGiven() =
        runTest {
            val queue = queue()
            queue.add(draft("a", 0))
            queue.add(draft("b", 1))
            advanceUntilIdle()

            assertEquals(listOf("a", "b"), sent.map { it.itemId })
            assertEquals(DraftSaveStatus.Saved, queue.status.value)
            assertEquals(emptyList<MockDraft>(), kept.last())
        }

    @Test
    fun onlyTheNewestAnswerToAWaitingQuestionGoesOut() =
        runTest {
            gate = CompletableDeferred()
            val queue = queue()
            queue.add(draft("a", 0))
            runCurrent()
            queue.add(draft("b", 1))
            queue.add(draft("b", 2))
            gate!!.complete(Unit)
            advanceUntilIdle()

            assertEquals(listOf(draft("a", 0), draft("b", 2)), sent)
        }

    @Test
    fun anAnswerThatDidntGetThroughIsTriedAgainFirstWithAGrowingWait() =
        runTest {
            results += SendResult.Unreachable
            results += SendResult.Unreachable
            val queue = queue()
            queue.add(draft("a", 0))
            queue.add(draft("b", 1))
            runCurrent()
            assertEquals(DraftSaveStatus.Retrying, queue.status.value)

            advanceTimeBy(1_001)
            assertEquals(listOf("a", "a"), sent.map { it.itemId })
            advanceTimeBy(1_500)
            assertEquals(2, sent.size)
            advanceTimeBy(600)
            advanceUntilIdle()

            assertEquals(listOf("a", "a", "a", "b"), sent.map { it.itemId })
            assertEquals(DraftSaveStatus.Saved, queue.status.value)
        }

    @Test
    fun retryNowSendsAtOnce() =
        runTest {
            results += SendResult.Unreachable
            val queue = queue()
            queue.add(draft("a", 0))
            runCurrent()
            queue.retryNow()
            runCurrent()

            assertEquals(2, sent.size)
            assertEquals(DraftSaveStatus.Saved, queue.status.value)
        }

    @Test
    fun aRefusedAnswerIsSaidUntilALaterOneIsStored() =
        runTest {
            results += SendResult.Refused
            val queue = queue()
            queue.add(draft("a", 0))
            advanceUntilIdle()
            assertEquals(DraftSaveStatus.Refused, queue.status.value)

            queue.add(draft("b", 1))
            advanceUntilIdle()
            assertEquals(DraftSaveStatus.Saved, queue.status.value)
        }

    @Test
    fun aHandInWaitsForEveryAnswerRetriesIncluded() =
        runTest {
            results += SendResult.Unreachable
            val queue = queue()
            queue.add(draft("a", 0))
            val idle = async { queue.idle() }
            runCurrent()
            assertFalse(idle.isCompleted)

            advanceUntilIdle()
            assertTrue(idle.isCompleted)
            assertEquals(2, sent.size)
        }

    @Test
    fun whatIsntStoredYetIsKeptOnTheDevice() =
        runTest {
            gate = CompletableDeferred()
            val queue = queue()
            queue.add(draft("a", 0))
            runCurrent()

            assertEquals(listOf(draft("a", 0)), kept.last())
            gate!!.complete(Unit)
            advanceUntilIdle()
            assertEquals(emptyList<MockDraft>(), kept.last())
        }

    @Test
    fun aNewerAnswerToTheQuestionGoingOutIsTheOneKept() =
        runTest {
            gate = CompletableDeferred()
            val queue = queue()
            queue.add(draft("a", 0))
            runCurrent()
            queue.add(draft("a", 1))

            assertEquals(listOf(draft("a", 1)), kept.last())
            gate!!.complete(Unit)
            advanceUntilIdle()
            assertEquals(listOf(draft("a", 0), draft("a", 1)), sent)
            assertEquals(emptyList<MockDraft>(), kept.last())
        }

    @Test
    fun aSessionThatEndedStopsTheQueue() =
        runTest {
            results += SendResult.Stop
            val queue = queue()
            queue.add(draft("a", 0))
            queue.add(draft("b", 1))
            advanceUntilIdle()

            assertEquals(listOf("a"), sent.map { it.itemId })
            assertFalse(queue.isBusy)
        }
}
