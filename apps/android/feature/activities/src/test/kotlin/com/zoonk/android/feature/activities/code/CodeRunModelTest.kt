package com.zoonk.android.feature.activities.code

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.MutationResult
import com.zoonk.android.ui.components.Limit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.consumeAsFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class CodeRunModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val asked = mutableListOf<Pair<UUID, String>>()
    private var updates = Channel<CodeRunUpdate>(Channel.UNLIMITED)
    private val model =
        CodeRunModel { requestId, _, code ->
            asked += requestId to code
            updates = Channel(Channel.UNLIMITED)
            updates.consumeAsFlow()
        }

    private val printed = ProgramRun(null, "", "hello\n", ProgramStop.Done, runId = "ec8eedd5-7adf-48aa-b686-ed38e40340b5")

    @Before
    fun start() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun stop() {
        Dispatchers.resetMain()
    }

    private fun end(result: MutationResult<ProgramRun>) {
        updates.trySend(CodeRunUpdate.Ended(result))
        updates.close()
    }

    @Test
    fun aRunShowsHowFarItGotThenWhatItPrinted() =
        runTest(dispatcher) {
            model.run("class Main {}", CodeLanguage.Java)
            runCurrent()
            assertTrue(model.isRunning)
            assertNull(model.phase)

            updates.send(CodeRunUpdate.Phase(CodeRunPhase.Compiling))
            runCurrent()
            assertEquals(CodeRunPhase.Compiling, model.phase)

            end(MutationResult.Done(printed))
            runCurrent()
            assertFalse(model.isRunning)
            assertNull(model.phase)
            assertEquals("class Main {}", model.result.value?.code)
            assertEquals(printed, model.result.value?.run)
        }

    @Test
    fun aRunWhoseEndWasLostAsksAgainWithTheSameRequestUntilItLands() =
        runTest(dispatcher) {
            model.run("a", CodeLanguage.Go)
            runCurrent()
            end(MutationResult.Failed(ApiError.Network))
            runCurrent()
            assertEquals(ServerRunIssue.Offline, model.issue.value)

            model.run("a", CodeLanguage.Go)
            runCurrent()
            assertNull(model.issue.value)
            end(MutationResult.Done(printed))
            runCurrent()

            model.run("a", CodeLanguage.Go)
            runCurrent()

            assertEquals(asked[0].first, asked[1].first)
            assertNotEquals(asked[1].first, asked[2].first)
        }

    @Test
    fun editedCodeAfterALostRunIsANewRequest() =
        runTest(dispatcher) {
            model.run("a", CodeLanguage.Go)
            runCurrent()
            end(MutationResult.Failed(ApiError.Network))
            runCurrent()

            model.run("b", CodeLanguage.Go)
            runCurrent()

            assertNotEquals(asked[0].first, asked[1].first)
        }

    @Test
    fun aRunTheServerAnsweredIsNeverAskedAgainByItsRequest() =
        runTest(dispatcher) {
            model.run("a", CodeLanguage.Rust)
            runCurrent()
            end(MutationResult.Done(printed.copy(stop = ProgramStop.Unavailable, output = "")))
            runCurrent()
            assertEquals(ServerRunIssue.Unavailable, model.issue.value)
            assertNull(model.result.value)

            model.run("a", CodeLanguage.Rust)
            runCurrent()
            end(MutationResult.Failed(ApiError.Unavailable, "SIGN_UP_REQUIRED", 403))
            runCurrent()
            assertEquals(ServerRunIssue.Limited(Limit.SignUpRequired), model.issue.value)

            model.run("a", CodeLanguage.Rust)
            runCurrent()

            assertEquals(3, asked.map { it.first }.toSet().size)
        }

    @Test
    fun aRunStillGoingWhenTheLearnerLeavesStopsAndShowsNothing() =
        runTest(dispatcher) {
            model.run("a", CodeLanguage.Java)
            runCurrent()

            model.visit.end()
            runCurrent()
            end(MutationResult.Done(printed))
            runCurrent()

            assertFalse(model.isRunning)
            assertNull(model.result.value)
        }

    @Test
    fun aSecondTapWhileRunningAsksNothing() =
        runTest(dispatcher) {
            model.run("a", CodeLanguage.Java)
            runCurrent()
            model.run("a", CodeLanguage.Java)
            runCurrent()

            assertEquals(1, asked.size)
        }
}
