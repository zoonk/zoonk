package com.zoonk.android.feature.mock.chooser

import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.exam.GOAL
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.models.AnytimeMock
import com.zoonk.api.models.MockQuestionsGeneration
import com.zoonk.api.models.MockShape
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MockChooserViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
    private val api = FakeMockStartApi()
    private val runs = ReadyRuns()
    private val full = MockChoice.Practice(MockShape(area = null, day = 1, kind = MockShape.Kind.FULL))
    private val math = MockChoice.Practice(MockShape(area = "Mathematics", day = null, kind = MockShape.Kind.AREA))

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun TestScope.viewModel(): MockChooserViewModel {
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        return MockChooserViewModel(GOAL, MockStarter(api, cache), session) { runs }
    }

    @Test
    fun aStartedMockOpens() =
        runTest(dispatcher) {
            val viewModel = viewModel()

            viewModel.start(full, "full:1:")
            advanceUntilIdle()

            assertEquals(STARTED, viewModel.opened.value)
            assertEquals(listOf(full to false), api.started)
        }

    @Test
    fun theMockAlreadyRunningOpensInstead() =
        runTest(dispatcher) {
            api.starts = listOf { started(AnytimeMock.Status.RUNNING) }
            val viewModel = viewModel()

            viewModel.start(full, "full:1:")
            advanceUntilIdle()

            assertEquals(STARTED, viewModel.opened.value)
        }

    @Test
    fun aShortMockStartsWithFewerQuestionsOnlyOnTheSecondTapOfTheSameOption() =
        runTest(dispatcher) {
            api.starts = listOf({ short() }, { short() }, { started() })
            val viewModel = viewModel()

            viewModel.start(full, "full:1:")
            advanceUntilIdle()
            assertEquals(ChooserStatus.Short("full:1:", MockStartOutcome.Short(40, 90, 130, AnytimeMock.Limit.DAY)), viewModel.status.value)
            assertNull(viewModel.opened.value)

            viewModel.start(math, "area::Mathematics")
            advanceUntilIdle()
            viewModel.start(math, "area::Mathematics")
            advanceUntilIdle()

            assertEquals(listOf(full to false, math to false, math to true), api.started)
            assertEquals(STARTED, viewModel.opened.value)
        }

    @Test
    fun questionsWrittenFirstStartTheMockWithWhatTheRunWrote() =
        runTest(dispatcher) {
            api.starts = listOf({ NEEDS_QUESTIONS }, { started() })
            api.writes =
                listOf(
                    { writing(MockQuestionsGeneration.Status.PREPARING) },
                    { writing(MockQuestionsGeneration.Status.GENERATING, "run-1") },
                )
            val viewModel = viewModel()

            viewModel.start(full, "full:1:")
            advanceUntilIdle()

            assertEquals(listOf("run-1"), runs.followed)
            assertEquals(listOf(full to false, full to true), api.started)
            assertEquals(STARTED, viewModel.opened.value)
        }

    @Test
    fun aMockWrittenWhileTheChooserWasHiddenStartsOnlyOnceItsSeenAgain() =
        runTest(dispatcher) {
            api.starts = listOf({ NEEDS_QUESTIONS }, { started() })
            api.writes = listOf { writing(MockQuestionsGeneration.Status.GENERATING, "run-1") }
            val viewModel = viewModel()

            viewModel.start(full, "full:1:")
            viewModel.onShown(false)
            advanceUntilIdle()
            assertEquals(listOf(full to false), api.started)
            assertNull(viewModel.opened.value)

            viewModel.onShown(true)
            advanceUntilIdle()
            assertEquals(STARTED, viewModel.opened.value)
        }

    @Test
    fun anotherLearnerSigningInWhileQuestionsAreWrittenNeverStartsTheMock() =
        runTest(dispatcher) {
            api.starts = listOf({ NEEDS_QUESTIONS }, { started() })
            api.writes = listOf { writing(MockQuestionsGeneration.Status.GENERATING, "run-1") }
            val viewModel = viewModel()

            viewModel.start(full, "full:1:")
            viewModel.onShown(false)
            advanceUntilIdle()
            session.session = AuthenticatedSession("bea", "token-b", "local-b")
            viewModel.onShown(true)
            advanceUntilIdle()

            assertEquals(listOf(full to false), api.started)
            assertNull(viewModel.opened.value)
            assertEquals(ChooserStatus.Choosing, viewModel.status.value)
        }

    @Test
    fun aBankThatCantHaveMoreWrittenNowStartsWithWhatItHas() =
        runTest(dispatcher) {
            api.starts = listOf({ NEEDS_QUESTIONS }, { started() })
            val viewModel = viewModel()

            viewModel.start(full, "full:1:")
            advanceUntilIdle()

            assertEquals(emptyList<String>(), runs.followed)
            assertEquals(listOf(full to false, full to true), api.started)
            assertEquals(STARTED, viewModel.opened.value)
        }

    @Test
    fun usedUpHelpShowsItsLimitAndStartsNothing() =
        runTest(dispatcher) {
            api.starts = listOf { NEEDS_QUESTIONS }
            api.writes = listOf { throw usageLimit() }
            val viewModel = viewModel()

            viewModel.start(full, "full:1:")
            advanceUntilIdle()

            assertEquals(ChooserStatus.Refused(Limit.Reached(LimitTier.Free, LimitPeriod.Day)), viewModel.status.value)
            assertEquals(1, api.started.size)
        }

    @Test
    fun tooFewQuestionsSaysSoAndALapsedPlusGoesBackToChoosing() =
        runTest(dispatcher) {
            api.starts = listOf { throw refusal("NOT_ENOUGH_QUESTIONS") }
            val viewModel = viewModel()

            viewModel.start(math, "area::Mathematics")
            advanceUntilIdle()
            assertEquals(ChooserStatus.Failed(notEnoughQuestions = true), viewModel.status.value)

            api.starts = listOf { throw refusal("PLUS_REQUIRED") }
            viewModel.start(math, "area::Mathematics")
            advanceUntilIdle()
            assertEquals(ChooserStatus.Choosing, viewModel.status.value)
            assertNull(viewModel.opened.value)
        }
}
