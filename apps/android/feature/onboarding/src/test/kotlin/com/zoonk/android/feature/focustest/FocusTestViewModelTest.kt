package com.zoonk.android.feature.focustest

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModelStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.focusTestOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.api.models.FocusTestFocus
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class FocusTestViewModelTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val models = ViewModelStore()

    @After
    fun tearDown() {
        models.clear()
        Dispatchers.resetMain()
    }

    private fun TestScope.viewModel(
        api: OnboardingApi,
        handle: SavedStateHandle,
        plans: PlanApi = FakePlanApi(),
    ): FocusTestViewModel {
        val session = FakeSession(ana)
        val cache = AppCache(session, backgroundScope)
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        return FocusTestViewModel(GOAL_ID, store, PlanStore(plans, cache), null, handle).also { models.put("$it", it) }
    }

    /** The proposal the result of [vm] would ask about when the test's latest answers propose [next]. */
    private fun TestScope.waitingAfter(
        vm: FocusTestViewModel,
        next: PlanChange,
    ): PlanChange? {
        val focus = FocusTestFocus(proposal = next, rows = emptyList(), state = FocusTestFocus.State.PROPOSED)
        val questions = SessionQuestionsModel(unusedFocusTests(AppCache(FakeSession(ana), backgroundScope)), UUID.fromString(GOAL_ID))
        return focus.waitingProposal(
            PlanControls(vm.proposalAnswer, vm.repricedProposal, vm.deciding, vm.decisionFailed, vm::decide, {
            }, questions),
        )
    }

    /** What the screen does after the app comes back from process death with what [handle] saved. */
    private fun TestScope.restored(
        api: OnboardingApi,
        handle: SavedStateHandle,
    ): FocusTestViewModel {
        val saved = handle.savedStateProvider().saveState()
        models.clear()
        return viewModel(api, SavedStateHandle.createHandle(saved, null)).also {
            it.start { WriteOutcome.Done(Unit) }
            runCurrent()
        }
    }

    @Test
    fun aStartCutOffByTheAppClosingStartsAgainWhenTheTestComesBack() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val fake = FakeOnboardingApi().apply { placement = placementOf(next = null, focusTest = focusTestOf()) }
            val answer = CompletableDeferred<Placement>()
            var starts = 0
            val api =
                object : OnboardingApi by fake {
                    override suspend fun startPlacementSitting(
                        session: AuthenticatedSession,
                        goalId: String,
                    ): Placement {
                        starts++
                        return answer.await()
                    }
                }
            val handle = SavedStateHandle()
            viewModel(api, handle).start { WriteOutcome.Done(Unit) }
            runCurrent()

            val back = restored(api, handle)

            assertTrue(back.phase(LoadState.Loaded(fake.placement)) is FocusTestPhase.Offer)
            assertEquals(2, starts)
            assertTrue(back.busy)
        }

    @Test
    fun aStartThatFailedBeforeTheAppClosedStartsAgainWhenTheTestComesBack() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val api =
                FakeOnboardingApi().apply {
                    placement = placementOf(next = null, focusTest = focusTestOf())
                    writeFailure = ApiException(ApiError.Network)
                }
            val handle = SavedStateHandle()
            val first = viewModel(api, handle)
            first.start { WriteOutcome.Done(Unit) }
            runCurrent()
            assertTrue(first.failed)
            api.writeFailure = null

            restored(api, handle)

            assertEquals(2, api.sittingsStarted)
        }

    @Test
    fun aNewProposalFromMoreAnswersAsksAgainAfterTheLearnerDecidedTheLastOne() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val api = FakeOnboardingApi().apply { placement = placementOf(next = null, focusTest = focusTestOf()) }
            val vm = viewModel(api, SavedStateHandle())
            val proposal = decodeFixture<PlanChange>("plan-change").copy(source = "focusTest", canApply = true)
            vm.decide(proposal, PlanChangeDecisionInput.Status.APPLIED)
            runCurrent()
            assertNotNull(vm.proposalAnswer)

            vm.continueTest()
            runCurrent()

            val next = proposal.copy(id = UUID.randomUUID())
            assertEquals(next.id, waitingAfter(vm, next)?.id)
        }

    @Test
    fun anUndoThatAnswersAfterMoreQuestionsStartedLeavesTheNextProposalToAsk() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val api = FakeOnboardingApi().apply { placement = placementOf(next = null, focusTest = focusTestOf()) }
            val proposal = decodeFixture<PlanChange>("plan-change").copy(source = "focusTest", canApply = true, canUndo = true)
            val undone = CompletableDeferred<PlanChange>()
            val plans =
                object : PlanApi by FakePlanApi() {
                    override suspend fun decide(
                        session: AuthenticatedSession,
                        goalId: UUID,
                        changeId: UUID,
                        status: PlanChangeDecisionInput.Status,
                        quote: String?,
                    ): PlanChange =
                        if (status ==
                            PlanChangeDecisionInput.Status.UNDONE
                        ) {
                            undone.await()
                        } else {
                            proposal.copy(status = PlanChange.Status.APPLIED)
                        }
                }
            val vm = viewModel(api, SavedStateHandle(), plans)
            vm.decide(proposal, PlanChangeDecisionInput.Status.APPLIED)
            runCurrent()
            vm.decide(proposal, PlanChangeDecisionInput.Status.UNDONE)
            runCurrent()

            vm.continueTest()
            runCurrent()
            undone.complete(proposal)
            runCurrent()

            val next = proposal.copy(id = UUID.randomUUID())
            assertEquals(next.id, waitingAfter(vm, next)?.id)
        }
}
