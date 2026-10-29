package com.zoonk.android.feature.plan

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.api.models.GoalUpdateInput
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
import org.junit.Before
import org.junit.Test
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
}
