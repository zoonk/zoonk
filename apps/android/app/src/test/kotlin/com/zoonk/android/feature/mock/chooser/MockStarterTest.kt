package com.zoonk.android.feature.mock.chooser

import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.exam.GOAL
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.models.AnytimeMock
import com.zoonk.api.models.MockQuestionsGeneration
import com.zoonk.api.models.MockShape
import com.zoonk.api.models.PlacementMockOption
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MockStarterTest {
    private val dispatcher = StandardTestDispatcher()
    private val api = FakeMockStartApi()
    private val full = MockChoice.Practice(MockShape(area = null, day = 1, kind = MockShape.Kind.FULL))

    private fun TestScope.cache() =
        AppCache(
            FakeSession(AuthenticatedSession(ANA, "token", "local")),
            CoroutineScope(SupervisorJob() + dispatcher),
        )

    @Test
    fun onlyAStartedMockRefreshesTheLearnerModel() =
        runTest(dispatcher) {
            val cache = cache()
            var reads = 0
            val model = cache.resource<Int>(Audience.SignedIn, setOf(DataDomain.LearnerModel)) { ++reads }
            val starter = MockStarter(api, cache)
            model.load()

            api.starts = listOf({ short() }, { started() })
            starter.start(GOAL, full, acceptFewer = false)
            model.load()
            assertEquals(1, reads)

            assertEquals(MutationResult.Done(MockStartOutcome.Opened(STARTED)), starter.start(GOAL, full, acceptFewer = true))
            model.load()
            assertEquals(2, reads)
        }

    @Test
    fun aMockAlreadyRunningOpensInsteadOfAnother() =
        runTest(dispatcher) {
            api.starts = listOf { started(AnytimeMock.Status.RUNNING) }

            assertEquals(
                MutationResult.Done(MockStartOutcome.Opened(STARTED)),
                MockStarter(api, cache()).start(GOAL, full, acceptFewer = false),
            )
        }

    @Test
    fun aShortBankSaysHowMuchItCanAskAndWhenMoreCanBeWritten() =
        runTest(dispatcher) {
            api.starts = listOf { short(AnytimeMock.Limit.MONTH) }

            assertEquals(
                MutationResult.Done(
                    MockStartOutcome.Short(questions = 40, examQuestions = 90, minutes = 130, limit = AnytimeMock.Limit.MONTH),
                ),
                MockStarter(api, cache()).start(GOAL, full, acceptFewer = false),
            )
        }

    @Test
    fun tooFewQuestionsAndALapsedPlusAreAnswersNotFailures() =
        runTest(dispatcher) {
            val starter = MockStarter(api, cache())

            api.starts = listOf { throw refusal("NOT_ENOUGH_QUESTIONS") }
            assertEquals(MutationResult.Done(MockStartOutcome.NotEnoughQuestions), starter.start(GOAL, full, acceptFewer = false))

            api.starts = listOf { throw refusal("PLUS_REQUIRED") }
            assertEquals(MutationResult.Done(MockStartOutcome.PlusRequired), starter.start(GOAL, full, acceptFewer = false))

            api.starts = listOf { throw refusal("GOAL_NOT_ACTIVE") }
            assertEquals(MutationResult.Failed::class, starter.start(GOAL, full, acceptFewer = false)::class)
        }

    @Test
    fun questionsAreAskedForAgainEveryThreeSecondsWhileTheSkillMapIsDrawn() =
        runTest(dispatcher) {
            val placement = MockChoice.Placement(PlacementMockOption.Length.MEDIUM)
            api.writes =
                listOf(
                    { writing(MockQuestionsGeneration.Status.PREPARING) },
                    { writing(MockQuestionsGeneration.Status.PREPARING) },
                    { writing(MockQuestionsGeneration.Status.GENERATING, "run-1") },
                )

            val result = MockStarter(api, cache()).writeQuestions(GOAL, placement)

            assertEquals(MutationResult.Done(QuestionWriting.Writing("run-1")), result)
            assertEquals(listOf(placement, placement, placement), api.asked)
            assertEquals(6_000L, currentTime)
        }

    @Test
    fun aSkillMapStillDrawnAfterThreeMinutesStartsWithWhatTheBankHas() =
        runTest(dispatcher) {
            api.writes = listOf { writing(MockQuestionsGeneration.Status.PREPARING) }

            assertEquals(MutationResult.Done(QuestionWriting.Ready), MockStarter(api, cache()).writeQuestions(GOAL, full))
            assertEquals(60, api.asked.size)
        }

    @Test
    fun usedUpHelpRefusesTheWritingWithItsLimit() =
        runTest(dispatcher) {
            api.writes = listOf { throw usageLimit() }

            assertEquals(
                MutationResult.Done(QuestionWriting.Refused(Limit.Reached(LimitTier.Free, LimitPeriod.Day))),
                MockStarter(api, cache()).writeQuestions(GOAL, full),
            )
        }
}
