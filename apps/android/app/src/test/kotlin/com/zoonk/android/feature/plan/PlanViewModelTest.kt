package com.zoonk.android.feature.plan

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanChangeDecisionInput
import com.zoonk.api.models.PlanChangeResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withContext
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDate
import java.util.UUID
import kotlin.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class PlanViewModelTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val api = FakePlanApi()
    private val goalId = UUID.fromString(GOAL)
    private lateinit var store: PlanStore
    private lateinit var viewModel: PlanViewModel

    @Before
    fun start() {
        val dispatcher = UnconfinedTestDispatcher()
        Dispatchers.setMain(dispatcher)
        store = PlanStore(api, AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + dispatcher)))
        viewModel = PlanViewModel(store, goalId)
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

    @Test
    fun whatAPartAskedForShowsUntilThePlanShownHasIt() =
        runTest {
            val time = PlanOp.DailyMinutes(45)
            val gate = CompletableDeferred<Unit>().also { api.gates[time] = it }

            viewModel.change(PlanPart.Schedule, listOf(time))
            assertEquals(setOf(PlanPart.Schedule), viewModel.pending.value)
            assertEquals(mapOf(PlanPart.Schedule to listOf<PlanOp>(time)), viewModel.asked.value)

            gate.complete(Unit)
            assertEquals(emptySet<PlanPart>(), viewModel.pending.value)
            assertEquals(emptyMap<PlanPart, List<PlanOp>>(), viewModel.asked.value)
        }

    @Test
    fun aPartTakesNoOtherTapUntilThePlanShownHasItsChange() =
        runTest {
            val gate = CompletableDeferred<Unit>().also { api.planGate = it }

            viewModel.change(PlanPart.Schedule, listOf(PlanOp.DailyMinutes(45)))
            viewModel.change(PlanPart.Schedule, listOf(PlanOp.DailyMinutes(60)))
            assertEquals(setOf(PlanPart.Schedule), viewModel.pending.value)

            gate.complete(Unit)
            assertEquals(listOf(listOf<PlanOp>(PlanOp.DailyMinutes(45))), api.changes)
            assertEquals(emptySet<PlanPart>(), viewModel.pending.value)
        }

    @Test
    fun aSaveWhosePlanCantBeReadAgainSaysItDidntSave() =
        runTest {
            withContext(Dispatchers.Main) { store.plan[goalId].load() }
            api.planFailure = ApiException(ApiError.Network)
            val answers = mutableListOf<PlanChangeResult?>()

            viewModel.change(PlanPart.Writing, listOf(PlanOp.WrittenCadence("biweekly"))) { answers += it }

            assertEquals(setOf(PlanPart.Writing), viewModel.failed.value)
            assertEquals(listOf<PlanChangeResult?>(null), answers)
            assertEquals(emptyMap<PlanPart, List<PlanOp>>(), viewModel.asked.value)
            assertEquals(emptySet<PlanPart>(), viewModel.pending.value)
            assertNull(viewModel.latest.value)
        }

    @Test
    fun anOlderChangeAnsweringLastLeavesTheNewerOneShown() =
        runTest {
            val time = PlanOp.DailyMinutes(45)
            val harder = PlanOp.DifficultyBias("harder")
            val newer = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1d02"
            api.createdAt = { if (it == listOf(time)) "2026-10-28T12:00:00Z" else "2026-10-28T12:01:00Z" }
            api.changeId = { if (it == listOf(time)) CHANGE_ID else newer }
            val gate = CompletableDeferred<Unit>().also { api.gates[time] = it }

            viewModel.change(PlanPart.Schedule, listOf(time))
            viewModel.change(PlanPart.Steering, listOf(harder))
            gate.complete(Unit)

            assertEquals(
                newer,
                viewModel.latest.value
                    ?.change
                    ?.id
                    .toString(),
            )
        }

    @Test
    fun aChangeSavedBeforeTheEditorReopensDoesntShowInIt() =
        runTest {
            val time = PlanOp.DailyMinutes(45)
            val gate = CompletableDeferred<Unit>().also { api.gates[time] = it }

            viewModel.change(PlanPart.Schedule, listOf(time))
            viewModel.forgetLatest()
            gate.complete(Unit)

            assertNull(viewModel.latest.value)
            assertEquals(emptyMap<PlanPart, List<PlanOp>>(), viewModel.asked.value)
        }

    @Test
    fun aSessionThatEndsBeforeThePlanIsReadAgainShowsNothing() =
        runTest {
            api.planFailure = ApiException(ApiError.Unauthorized)
            val answers = mutableListOf<PlanChangeResult?>()

            viewModel.change(PlanPart.Schedule, listOf(PlanOp.DailyMinutes(45))) { answers += it }

            assertNull(viewModel.latest.value)
            assertEquals(emptyList<PlanChangeResult?>(), answers)
            assertEquals(emptyMap<PlanPart, List<PlanOp>>(), viewModel.asked.value)
        }

    @Test
    fun aTapWhileTheTimeIsBeingFoundJoinsTheSameSearch() =
        runTest {
            val plan = shown()
            val outcomes = mutableListOf<TimeToCoverOutcome>()
            api.timeToCoverGate = CompletableDeferred()

            viewModel.findTimeToCover(plan) { outcomes += it }
            viewModel.findTimeToCover(plan) { outcomes += it }
            assertEquals(TimeToCoverState.Pending(timeToCoverRevision(plan)), viewModel.timeToCover.value)
            api.timeToCoverGate?.complete(Unit)

            assertEquals(1, api.timeToCoverRequests)
            assertEquals(List(2) { TimeToCoverOutcome.Answered(api.timeToCover) }, outcomes)
            assertEquals(TimeToCoverState.Answered(timeToCoverRevision(plan), api.timeToCover), viewModel.timeToCover.value)
        }

    @Test
    fun aTimeFoundIsGivenAgainWithoutPlanningTheGoalAgain() =
        runTest {
            val plan = shown()
            val outcomes = mutableListOf<TimeToCoverOutcome>()

            viewModel.findTimeToCover(plan) { outcomes += it }
            viewModel.findTimeToCover(plan) { outcomes += it }

            assertEquals(1, api.timeToCoverRequests)
            assertEquals(List(2) { TimeToCoverOutcome.Answered(api.timeToCover) }, outcomes)
        }

    @Test
    fun aPlanReplannedWhileTheTimeIsFoundGetsNoAnswer() =
        runTest {
            val plan = shown()
            val outcomes = mutableListOf<TimeToCoverOutcome>()
            api.timeToCoverGate = CompletableDeferred()

            viewModel.findTimeToCover(plan) { outcomes += it }
            val replanned = shown(coveragePlan(coreFits = false))
            api.timeToCoverGate?.complete(Unit)

            assertEquals(listOf<TimeToCoverOutcome>(TimeToCoverOutcome.Stale), outcomes)
            assertEquals(TimeToCoverState.Idle, viewModel.timeToCover.value.forPlan(replanned))
        }

    @Test
    fun aPlanStillBeingBuiltLetsTheLearnerAskAgain() =
        runTest {
            val plan = shown()
            val outcomes = mutableListOf<TimeToCoverOutcome>()
            api.timeToCover = timeToCover(ready = false)

            viewModel.findTimeToCover(plan) { outcomes += it }
            assertEquals(TimeToCoverState.Building(timeToCoverRevision(plan)), viewModel.timeToCover.value)
            viewModel.findTimeToCover(plan) { outcomes += it }

            assertEquals(2, api.timeToCoverRequests)
            assertEquals(List(2) { TimeToCoverOutcome.Building }, outcomes)
        }

    @Test
    fun aSearchThatFailedSaysSoAndSavesNothing() =
        runTest {
            val plan = shown()
            api.timeToCoverFailure = ApiException(ApiError.Network)

            viewModel.findTimeToCover(plan)

            assertEquals(TimeToCoverState.Failed(timeToCoverRevision(plan)), viewModel.timeToCover.value)
            assertEquals(1, api.plans)
            assertTrue(api.changes.isEmpty())
        }

    @Test
    fun aPreviewSavesNothingAndALateOneGivesWayToTheNewer() =
        runTest {
            val plan = shown()
            api.previewGate = CompletableDeferred()

            viewModel.requestPreview(plan, listOf(PlanOp.DailyMinutes(45)))
            viewModel.requestPreview(plan, listOf(PlanOp.DailyMinutes(60)))
            api.previewGate?.complete(Unit)

            val state = viewModel.preview.value
            assertTrue(state is PlanPreviewState.Ready)
            assertEquals(listOf<PlanOp>(PlanOp.DailyMinutes(60)), (state as PlanPreviewState.Ready).operations)
            assertEquals(1, api.plans)
            assertTrue(api.changes.isEmpty())
        }

    private suspend fun shown(plan: Plan = coveragePlan()): Plan {
        api.shownPlan = plan
        withContext(Dispatchers.Main) { store.plan[goalId].refresh() }
        return plan
    }
}
