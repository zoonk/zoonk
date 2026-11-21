package com.zoonk.android.feature.mock

import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.WritingRuns
import com.zoonk.api.models.MockWriting
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.time.Duration.Companion.seconds

@OptIn(ExperimentalCoroutinesApi::class)
class MockPaperWaitTest {
    private fun TestScope.wait(
        source: (String?) -> WritingRuns = { WritingRuns("writeMockQuestions", "mockPaperReady") },
        read: suspend () -> MockWriting?,
    ) = MockPaperWait(CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler)), source, read)

    @Test
    fun followsTheRunOnceItTakesThePaper() =
        runTest {
            val runs = WritingRuns("writeMockQuestions", "mockPaperReady")
            val starting = MockWriting(generationId = null, namespace = null, status = MockWriting.Status.STARTING)
            val namespace = "mock-paper:goal:paper"
            val writing = MockWriting(generationId = "paper-run", namespace = namespace, status = MockWriting.Status.WRITING)
            var reads = 0
            val wait =
                wait(source = { if (it == namespace) runs else WritingRuns() }) {
                    if (++reads < 3) starting else writing
                }

            wait.start()
            runCurrent()
            assertEquals(GenerationRun.Status.Waiting, wait.run.value.status)

            advanceTimeBy(5.seconds)
            runCurrent()

            assertEquals(listOf("paper-run"), runs.followed)
            assertEquals(GenerationRun.Status.Ready, wait.run.value.status)
        }

    @Test
    fun stopsAskingWhenNothingIsWritingThePaper() =
        runTest {
            var reads = 0
            val wait =
                wait {
                    reads++
                    MockWriting(generationId = null, namespace = null, status = MockWriting.Status.NONE)
                }

            wait.start()
            advanceTimeBy(30.seconds)
            runCurrent()

            assertTrue(wait.idle.value)
            assertEquals(1, reads)
        }
}
