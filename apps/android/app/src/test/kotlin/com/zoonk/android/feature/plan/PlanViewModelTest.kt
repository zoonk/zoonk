package com.zoonk.android.feature.plan

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.PlanChangeDecisionInput
import com.zoonk.api.models.PlanChangeResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDate
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class PlanViewModelTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val api = FakePlanApi()
    private lateinit var viewModel: PlanViewModel

    @Before
    fun start() {
        val dispatcher = UnconfinedTestDispatcher()
        Dispatchers.setMain(dispatcher)
        val store = PlanStore(api, AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + dispatcher)))
        viewModel = PlanViewModel(store, UUID.fromString(GOAL))
    }

    @After
    fun stop() = Dispatchers.resetMain()

    @Test
    fun archivingLeavesThePlanOnceSaved() =
        runTest {
            viewModel.setStatus(GoalUpdateInput.Status.ARCHIVED)

            assertEquals(listOf(GoalUpdateInput.Status.ARCHIVED), api.statuses)
            assertEquals(PlanEvent.Archived, viewModel.events.first())
            assertFalse(viewModel.isSaving.value)
        }

    @Test
    fun resumingOverFreesOneGoalSaysWhy() =
        runTest {
            api.statusFailure = ApiException(ApiError.Unavailable, code = "GOAL_LIMIT_REACHED", status = 429)

            viewModel.setStatus(GoalUpdateInput.Status.ACTIVE)

            assertEquals(PlanEvent.GoalLimitReached, viewModel.events.first())
        }

    @Test
    fun anyOtherFailureSaysItDidntSave() =
        runTest {
            api.statusFailure = ApiException(ApiError.Network)

            viewModel.setStatus(GoalUpdateInput.Status.PAUSED)

            assertEquals(PlanEvent.SaveFailed, viewModel.events.first())
        }

    @Test
    fun aChangeAnswersOnceThePlanShownIsReadAgain() =
        runTest {
            var readsWhenAnswered = -1

            viewModel.change(PlanPart.Schedule, listOf(PlanOp.DailyMinutes(45))) { readsWhenAnswered = api.plans }

            assertEquals(listOf(listOf<PlanOp>(PlanOp.DailyMinutes(45))), api.changes)
            assertEquals(1, readsWhenAnswered)
            assertEquals(
                CHANGE_ID,
                viewModel.latest.value
                    ?.change
                    ?.id
                    .toString(),
            )
            assertEquals(emptySet<PlanPart>(), viewModel.pending.value)
        }

    @Test
    fun aChangeThatDidntSaveFailsOnlyItsOwnPart() =
        runTest {
            api.changeFailure = ApiException(ApiError.Network)
            val answers = mutableListOf<PlanChangeResult?>()

            viewModel.change(PlanPart.Steering, listOf(PlanOp.DifficultyBias("harder"))) { answers += it }

            assertEquals(listOf<PlanChangeResult?>(null), answers)
            assertEquals(setOf(PlanPart.Steering), viewModel.failed.value)
            assertNull(viewModel.latest.value)
            assertEquals(0, api.plans)
        }

    @Test
    fun undoingTheLatestChangeShowsItUndone() =
        runTest {
            viewModel.change(PlanPart.Date, listOf(PlanOp.TargetDate(LocalDate.parse("2027-06-12"))))

            viewModel.undo(viewModel.latest.value!!.change)

            assertEquals(listOf(PlanChangeDecisionInput.Status.UNDONE), api.decisions)
            assertTrue(viewModel.latest.value!!.undone)
            assertEquals(2, api.plans)
        }
}
