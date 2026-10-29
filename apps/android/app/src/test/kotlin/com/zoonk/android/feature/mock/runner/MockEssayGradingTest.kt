package com.zoonk.android.feature.mock.runner

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.value
import com.zoonk.android.feature.mock.result.ESSAY_TWO
import com.zoonk.android.feature.mock.result.finishedMock
import com.zoonk.android.feature.mock.result.gradedEssay
import com.zoonk.android.feature.mock.result.pendingEssay
import com.zoonk.api.models.MockEssay
import com.zoonk.api.models.MockExam
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import kotlin.time.Duration.Companion.seconds

@OptIn(ExperimentalCoroutinesApi::class)
class MockEssayGradingTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val dispatcher = StandardTestDispatcher()
    private val ana = AuthenticatedSession("ana", "token", "local")
    private val session = FakeSession(ana)
    private val api = FakeMockRunApi(runningMock(current = "null"))
    private lateinit var store: MockRunStore
    private lateinit var cache: AppCache

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private suspend fun viewModel(initial: MockExam = api.mock): MockRunnerViewModel {
        val scope = CoroutineScope(SupervisorJob() + dispatcher)
        val drafts = DraftStore(folder.root, scope, io = dispatcher)
        drafts.follow { DraftsChange(next = ana.accountId) }
        cache = AppCache(session, scope)
        store = MockRunStore(api, cache, drafts) { "UTC" }
        return MockRunnerViewModel(store, session, RUN_BLOCK, OpenedMock(initial, emptyList()), reread = {})
    }

    private fun essays(vararg essays: String) = finishedMock(extra = """"essayRubric":"enem","essays":[${essays.joinToString(",")}]""")

    private val MockRunnerViewModel.essayStatuses get() =
        state.value.view.essays
            .map { it.status }

    @Test
    fun finishingGradesTheEssaysRightAway() =
        runTest(dispatcher) {
            api.afterFinish = essays(pendingEssay())
            api.afterGrade = essays(gradedEssay())
            val viewModel = viewModel()

            viewModel.finish()
            advanceUntilIdle()

            assertEquals(1, api.grades)
            assertEquals(EssayGrading.Idle, viewModel.essayGrading.value)
            assertEquals(listOf(MockEssay.Status.GRADED), viewModel.essayStatuses)
        }

    @Test
    fun todaysLimitShowsWhatGotGradedAndSaysSo() =
        runTest(dispatcher) {
            api.afterFinish = essays(pendingEssay(), pendingEssay(ESSAY_TWO))
            api.afterGrade = essays(gradedEssay(), pendingEssay(ESSAY_TWO))
            api.gradeOutcome = EssayGradeOutcome.LimitReached
            val viewModel = viewModel()

            viewModel.finish()
            advanceUntilIdle()

            assertEquals(EssayGrading.LimitReached, viewModel.essayGrading.value)
            assertEquals(listOf(MockEssay.Status.GRADED, MockEssay.Status.PENDING), viewModel.essayStatuses)
        }

    @Test
    fun aFailedGradeIsTriedAgainFromGradeIt() =
        runTest(dispatcher) {
            api.afterFinish = essays(pendingEssay())
            api.gradeFailure = UNREACHABLE
            val viewModel = viewModel()

            viewModel.finish()
            advanceUntilIdle()
            assertEquals(EssayGrading.Failed, viewModel.essayGrading.value)
            assertEquals(listOf(MockEssay.Status.PENDING), viewModel.essayStatuses)

            api.gradeFailure = null
            api.afterGrade = essays(gradedEssay())
            viewModel.gradeEssays()
            advanceUntilIdle()

            assertEquals(2, api.grades)
            assertEquals(EssayGrading.Idle, viewModel.essayGrading.value)
            assertEquals(listOf(MockEssay.Status.GRADED), viewModel.essayStatuses)
        }

    @Test
    fun gradingThatNeverAnswersFailsAfterTwoMinutes() =
        runTest(dispatcher) {
            api.afterFinish = essays(pendingEssay())
            api.gradeGate = CompletableDeferred()
            val viewModel = viewModel()

            viewModel.finish()
            advanceTimeBy(119.seconds)
            assertEquals(EssayGrading.Grading, viewModel.essayGrading.value)

            advanceTimeBy(2.seconds)
            assertEquals(EssayGrading.Failed, viewModel.essayGrading.value)
        }

    @Test
    fun openingAFinishedMockNeverGradesOnItsOwn() =
        runTest(dispatcher) {
            val viewModel = viewModel(essays(pendingEssay()))
            advanceUntilIdle()

            assertEquals(0, api.grades)
            assertEquals(EssayGrading.Idle, viewModel.essayGrading.value)
        }

    @Test
    fun gradingMarksTheLearnerModelStale() =
        runTest(dispatcher) {
            api.mock = essays(pendingEssay())
            api.afterGrade = essays(gradedEssay())
            viewModel()
            var reads = 0
            val model = cache.resource(Audience.SignedIn, setOf(DataDomain.LearnerModel)) { ++reads }
            model.load()

            store.gradeEssays(RUN_BLOCK)
            model.load()

            assertEquals(2, reads)
        }
}
