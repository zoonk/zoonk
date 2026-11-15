package com.zoonk.android.feature.plan

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.HeldRuns
import com.zoonk.android.data.VisitOutcome
import com.zoonk.android.data.WritingRuns
import com.zoonk.android.data.writingWaits
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanBase
import com.zoonk.api.models.PlanBasesAdvice
import com.zoonk.api.models.PlanChangeDecisionInput
import com.zoonk.api.models.PlanChangePreview
import com.zoonk.api.models.PlanChangeResult
import com.zoonk.api.models.PlanDay
import com.zoonk.api.models.PlanEffect
import com.zoonk.api.models.PlanTool
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
    private val runs = WritingRuns(write = "writeSetupLessons", ready = "setupLessonsReady")
    private val goalId = UUID.fromString(GOAL)

    /** The sheet opening a save answers. */
    private val opening = UUID.randomUUID()
    private lateinit var store: PlanStore
    private lateinit var viewModel: PlanViewModel

    @Before
    fun start() {
        val dispatcher = UnconfinedTestDispatcher()
        Dispatchers.setMain(dispatcher)
        store = PlanStore(api, AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + dispatcher)))
        viewModel = PlanViewModel(store, goalId, writingWaits(runs))
    }

    @After
    fun stop() = Dispatchers.resetMain()

    @Test
    fun archivingLeavesThePlanOnceSaved() =
        runTest {
            viewModel.setStatus(LearnerSummaryGoal.Status.ARCHIVED)

            assertEquals(listOf(LearnerSummaryGoal.Status.ARCHIVED), api.statuses)
            assertEquals(PlanEvent.Archived, viewModel.event.value)
            assertFalse(viewModel.isSaving.value)
        }

    @Test
    fun anArchiveThatSavedBeforeThePlanActedAndThenLeftLeavesNothingToDoOnReturn() =
        runTest {
            viewModel.setStatus(LearnerSummaryGoal.Status.ARCHIVED)
            viewModel.visit.end()

            assertEquals(listOf(LearnerSummaryGoal.Status.ARCHIVED), api.statuses)
            assertNull(viewModel.event.value)
        }

    @Test
    fun anArchiveThatSavesAfterThePlanLeftLeavesNothingToDoOnReturn() =
        runTest {
            val held = CompletableDeferred<Unit>()
            api.statusGate = held

            viewModel.setStatus(LearnerSummaryGoal.Status.ARCHIVED)
            viewModel.visit.end()
            held.complete(Unit)

            assertEquals(listOf(LearnerSummaryGoal.Status.ARCHIVED), api.statuses)
            assertNull(viewModel.event.value)
        }

    @Test
    fun resumingOverFreesOneGoalSaysWhy() =
        runTest {
            api.statusFailure = ApiException(ApiError.Unavailable, code = "GOAL_LIMIT_REACHED", status = 429)

            viewModel.setStatus(LearnerSummaryGoal.Status.ACTIVE)

            assertEquals(ResumeFailure.GoalLimit, viewModel.resumeFailure)
        }

    @Test
    fun aResumeThatFailsAfterTheLearnerLeftSaysNothingOnReturn() =
        runTest {
            val held = CompletableDeferred<Unit>().also { api.statusGate = it }
            api.statusFailure = ApiException(ApiError.Network)

            viewModel.setStatus(LearnerSummaryGoal.Status.ACTIVE)
            viewModel.visit.end()
            held.complete(Unit)

            assertNull(viewModel.resumeFailure)
        }

    @Test
    fun aResumeFailureShownBeforeTheLearnerLeftIsGoneOnReturn() =
        runTest {
            api.statusFailure = ApiException(ApiError.Network)

            viewModel.setStatus(LearnerSummaryGoal.Status.ACTIVE)
            assertEquals(ResumeFailure.Failed, viewModel.resumeFailure)
            viewModel.visit.end()

            assertNull(viewModel.resumeFailure)
        }

    @Test
    fun anyOtherFailureSaysItDidntSave() =
        runTest {
            api.statusFailure = ApiException(ApiError.Network)

            viewModel.setStatus(LearnerSummaryGoal.Status.PAUSED)

            assertEquals(Unit, viewModel.outcomes.saveFailed.value)
        }

    @Test
    fun aLaterDaysFitOfferAddsItsLessonsOnceTheCheckShowsTheSameNumbers() =
        runTest {
            val held = CompletableDeferred<Unit>()
            api.previewGate = held
            api.preview = checked(FIT_PLAN.fitOffer!!.effect)

            viewModel.addFitOffer(FIT_PLAN, FIT_PLAN.fitOffer!!)

            assertTrue(viewModel.slotPreview.value is PlanPreviewState.Loading)
            assertEquals(emptyList<List<PlanOp>>(), api.changes)
            held.complete(Unit)
            assertEquals(listOf(FIT_OPERATIONS), api.changes)
        }

    @Test
    fun aFitCheckPutOffWithNotNowOrAClosedSuggestionAddsNothing() =
        runTest {
            val held = CompletableDeferred<Unit>()
            api.previewGate = held
            api.preview = checked(FIT_PLAN.fitOffer!!.effect)

            viewModel.addFitOffer(FIT_PLAN, FIT_PLAN.fitOffer!!)
            viewModel.clearSlotPreview()
            held.complete(Unit)

            assertEquals(emptyList<List<PlanOp>>(), api.changes)
            assertEquals(PlanPreviewState.Idle, viewModel.slotPreview.value)
        }

    @Test
    fun otherNumbersTodayShowAndTheNextTapAddsThem() =
        runTest {
            val today = ApiJson.decodeFromString<PlanEffect>(effect(""""lessonsAdded":4"""))
            api.preview = checked(today)

            viewModel.addFitOffer(FIT_PLAN, FIT_PLAN.fitOffer!!)

            assertEquals(emptyList<List<PlanOp>>(), api.changes)
            assertEquals(today, (viewModel.slotPreview.value as PlanPreviewState.Ready).preview.effect)

            viewModel.addFitOffer(FIT_PLAN, FIT_PLAN.fitOffer!!)

            assertEquals(listOf(FIT_OPERATIONS), api.changes)
        }

    @Test
    fun aFitCheckThatFailsSaysSoAndAddsNothing() =
        runTest {
            api.preview = PlanChangePreview(finishDate = null, effect = null, feasibility = null, ready = false, unchanged = false)

            viewModel.addFitOffer(FIT_PLAN, FIT_PLAN.fitOffer!!)

            assertTrue(viewModel.slotPreview.value is PlanPreviewState.Failed)
            assertEquals(emptyList<List<PlanOp>>(), api.changes)
        }

    @Test
    fun aFitOfferThatDidntSaveSaysSoInTheAppsSnackbars() =
        runTest {
            api.changeFailure = ApiException(ApiError.Network)
            val offer = FIT_PLAN.fitOffer!!.copy(canApply = true)

            viewModel.addFitOffer(FIT_PLAN, offer)

            assertEquals(Unit, viewModel.outcomes.saveFailed.value)
        }

    private fun checked(effect: PlanEffect) =
        PlanChangePreview(finishDate = null, effect = effect, feasibility = null, ready = true, unchanged = false)

    @Test
    fun aChangeAnswersOnceThePlanShownIsReadAgain() =
        runTest {
            val read = CompletableDeferred<Unit>().also { api.planGate = it }

            viewModel.change(PlanPart.Schedule, listOf(PlanOp.DailyMinutes(45)), PlanAsker.Sheet(opening))
            assertEquals(listOf(listOf<PlanOp>(PlanOp.DailyMinutes(45))), api.changes)
            assertTrue(viewModel.sheetAnswers.value.isEmpty())
            read.complete(Unit)

            assertEquals(1, api.plans)
            assertEquals(PlanChangeResult.Status.APPLIED, viewModel.sheetAnswers.value[opening]?.status)
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

            viewModel.change(PlanPart.Steering, listOf(PlanOp.DifficultyBias("harder")), PlanAsker.Sheet(opening))

            assertEquals(mapOf(opening to null), viewModel.sheetAnswers.value)
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

            viewModel.change(PlanPart.Writing, listOf(PlanOp.WrittenCadence("biweekly")), PlanAsker.Sheet(opening))

            assertEquals(setOf(PlanPart.Writing), viewModel.failed.value)
            assertEquals(mapOf(opening to null), viewModel.sheetAnswers.value)
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

            viewModel.change(PlanPart.Schedule, listOf(PlanOp.DailyMinutes(45)), PlanAsker.Sheet(opening))

            assertNull(viewModel.latest.value)
            assertEquals(emptyMap<UUID, PlanChangeResult?>(), viewModel.sheetAnswers.value)
            assertEquals(emptyMap<PlanPart, List<PlanOp>>(), viewModel.asked.value)
        }

    @Test
    fun aTapWhileTheTimeIsBeingFoundJoinsTheSameSearch() =
        runTest {
            val plan = shown()
            api.timeToCoverGate = CompletableDeferred()

            viewModel.findTimeToCover(plan, TimeAsker.MoveDate)
            viewModel.findTimeToCover(plan, TimeAsker.Coverage(CoverageIntent.Time))
            assertEquals(TimeToCoverState.Pending(planAdviceRevision(plan)), viewModel.timeToCover.value)
            api.timeToCoverGate?.complete(Unit)

            val answered = TimeToCoverOutcome.Answered(api.timeToCover)
            assertEquals(1, api.timeToCoverRequests)
            assertEquals(answered, actOnMoveDate())
            assertEquals(TimeFound(CoverageIntent.Time, answered), viewModel.outcomes.coverageFound.value)
            assertEquals(TimeToCoverState.Answered(planAdviceRevision(plan), api.timeToCover), viewModel.timeToCover.value)
        }

    @Test
    fun aTimeFoundIsGivenAgainWithoutPlanningTheGoalAgain() =
        runTest {
            val plan = shown()

            viewModel.findTimeToCover(plan, TimeAsker.MoveDate)
            val first = actOnMoveDate()
            viewModel.findTimeToCover(plan, TimeAsker.MoveDate)

            assertEquals(1, api.timeToCoverRequests)
            assertEquals(List(2) { TimeToCoverOutcome.Answered(api.timeToCover) }, listOf(first, actOnMoveDate()))
        }

    @Test
    fun aPlanReplannedWhileTheTimeIsFoundGetsNoAnswer() =
        runTest {
            val plan = shown()
            api.timeToCoverGate = CompletableDeferred()

            viewModel.findTimeToCover(plan, TimeAsker.MoveDate)
            val replanned = shown(coveragePlan(coreFits = false))
            api.timeToCoverGate?.complete(Unit)

            assertEquals(TimeToCoverOutcome.Stale, actOnMoveDate())
            assertEquals(TimeToCoverState.Idle, viewModel.timeToCover.value.forPlan(replanned))
        }

    @Test
    fun aPlanStillBeingBuiltLetsTheLearnerAskAgain() =
        runTest {
            val plan = shown()
            api.timeToCover = timeToCover(ready = false)

            viewModel.findTimeToCover(plan, TimeAsker.MoveDate)
            assertEquals(TimeToCoverState.Building(planAdviceRevision(plan)), viewModel.timeToCover.value)
            val first = actOnMoveDate()
            viewModel.findTimeToCover(plan, TimeAsker.MoveDate)

            assertEquals(2, api.timeToCoverRequests)
            assertEquals(List(2) { TimeToCoverOutcome.Building }, listOf(first, actOnMoveDate()))
        }

    @Test
    fun aTimeFoundWhileThePlanIsRecreatedIsActedOnOnce() =
        runTest {
            val plan = shown()
            api.timeToCoverGate = CompletableDeferred()

            // No frame acts while the search is out, as when the window is recreated.
            viewModel.findTimeToCover(plan, TimeAsker.PastDate(request = 2))
            api.timeToCoverGate?.complete(Unit)

            assertEquals(TimeFound(2, TimeToCoverOutcome.Answered(api.timeToCover)), actOnPastDate())
            assertNull(actOnPastDate())
        }

    @Test
    fun aTimeFoundAfterThePlanLeftIsActedOnByNothingOnReturn() =
        runTest {
            val plan = shown()
            api.timeToCoverGate = CompletableDeferred()

            viewModel.findTimeToCover(plan, TimeAsker.PastDate(request = 2))
            viewModel.visit.end()
            api.timeToCoverGate?.complete(Unit)

            assertNull(actOnPastDate())
            assertEquals(TimeToCoverState.Answered(planAdviceRevision(plan), api.timeToCover), viewModel.timeToCover.value)
        }

    private fun actOnMoveDate() = actOn(viewModel.outcomes.moveDateFound)

    private fun actOnPastDate() = actOn(viewModel.outcomes.pastDateFound)

    @Test
    fun aSearchThatFailedSaysSoAndSavesNothing() =
        runTest {
            val plan = shown()
            api.timeToCoverFailure = ApiException(ApiError.Network)

            viewModel.findTimeToCover(plan)

            assertEquals(TimeToCoverState.Failed(planAdviceRevision(plan)), viewModel.timeToCover.value)
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

    @Test
    fun theSlotsPreviewIsItsOwnSoStudyEverythingNeverReplacesIt() =
        runTest {
            val plan = shown()

            viewModel.requestSlotPreview(plan, listOf(PlanOp.DailyMinutes(45)))
            viewModel.requestPreview(plan, listOf(PlanOp.TargetDate(null)))

            assertEquals(listOf<PlanOp>(PlanOp.DailyMinutes(45)), (viewModel.slotPreview.value as PlanPreviewState.Ready).operations)
            assertEquals(listOf<PlanOp>(PlanOp.TargetDate(null)), (viewModel.preview.value as PlanPreviewState.Ready).operations)

            viewModel.clearSlotPreview()

            assertEquals(PlanPreviewState.Idle, viewModel.slotPreview.value)
            assertTrue(viewModel.preview.value is PlanPreviewState.Ready)
        }

    @Test
    fun theNextLevelStartsOnceAndStaysStartedForTheNewGoal() =
        runTest {
            viewModel.continueAtNextLevel()
            viewModel.continueAtNextLevel()

            assertEquals(1, api.continued)
            assertEquals(NextLevelStart.Started, viewModel.nextLevel.value)
        }

    @Test
    fun aNextLevelThatDidntStartCanBeTriedAgain() =
        runTest {
            api.continueFailure = ApiException(ApiError.Unavailable, status = 409)

            viewModel.continueAtNextLevel()
            assertEquals(NextLevelStart.Failed, viewModel.nextLevel.value)

            api.continueFailure = null
            viewModel.continueAtNextLevel()
            assertEquals(NextLevelStart.Started, viewModel.nextLevel.value)
        }

    private suspend fun shown(plan: Plan = coveragePlan()): Plan {
        api.shownPlan = plan
        withContext(Dispatchers.Main) { store.plan[goalId].refresh() }
        return plan
    }

    @Test
    fun aChangeKeepsItsUndoAfterANewerOneIsLatest() =
        runTest {
            val focus = PlanOp.FocusAreas(listOf("Algebra"))
            val time = PlanOp.DailyMinutes(45)
            val newer = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1d02"
            api.createdAt = { if (it == listOf(time)) "2026-10-28T12:01:00Z" else "2026-10-28T12:00:00Z" }
            api.changeId = { if (it == listOf(time)) newer else CHANGE_ID }

            viewModel.change(PlanPart.Focus, listOf(focus))
            viewModel.change(PlanPart.Schedule, listOf(time))
            val sheets = viewModel.changes.value.getValue(UUID.fromString(CHANGE_ID))
            viewModel.undo(sheets.change)

            assertEquals(
                newer,
                viewModel.latest.value
                    ?.change
                    ?.id
                    .toString(),
            )
            assertTrue(
                viewModel.changes.value
                    .getValue(UUID.fromString(CHANGE_ID))
                    .undone,
            )
            assertEquals(false, viewModel.latest.value?.undone)
        }

    @Test
    fun aSlotChangeKeepsItsUndoAfterTheEditorOpens() =
        runTest {
            viewModel.change(PlanPart.Suggestion, listOf(PlanOp.DailyMinutes(45)))
            val change =
                viewModel.changes.value
                    .getValue(UUID.fromString(CHANGE_ID))
                    .change
            viewModel.forgetLatest()

            viewModel.undo(change)

            assertNull(viewModel.latest.value)
            assertTrue(
                viewModel.changes.value
                    .getValue(change.id)
                    .undone,
            )
        }

    @Test
    fun anExamChoiceShowsItsChangeOnceThePlanShownHasIt() =
        runTest {
            val read = CompletableDeferred<Unit>().also { api.planGate = it }

            viewModel.chooseExamOption("Foreign language", listOf("Spanish"), PlanAsker.Sheet(opening))
            assertTrue(viewModel.sheetAnswers.value.isEmpty())
            read.complete(Unit)

            assertEquals(listOf("Foreign language" to listOf("Spanish")), api.examChoices)
            assertEquals(emptyMap<PlanPart, List<PlanOp>>(), viewModel.asked.value)
            assertEquals(PlanChangeResult.Status.APPLIED, viewModel.sheetAnswers.value[opening]?.status)
            assertEquals(
                CHANGE_ID,
                viewModel.latest.value
                    ?.change
                    ?.id
                    .toString(),
            )
        }

    @Test
    fun aSetupLessonBeingWrittenIsWaitedOnThenTheSameChoiceIsSentAgain() =
        runTest {
            val held = HeldRuns(first = "writeSetupLessons", ready = "setupLessonsReady")
            viewModel = PlanViewModel(store, goalId, writingWaits(held))
            api.setupWritings += "run-1"
            val answer = ToolAnswer(listOf("Python"), PlanTool.Choice.SETUP, PlanTool.System.MACOS)

            viewModel.chooseTools(answer, PlanAsker.Sheet(opening))
            assertEquals("run-1", viewModel.setupLessons.generationId.value)
            assertEquals(emptySet<PlanPart>(), viewModel.pending.value)
            assertEquals(emptyMap<UUID, PlanChangeResult?>(), viewModel.sheetAnswers.value)

            held.write()
            assertEquals(listOf(answer, answer), api.toolAnswers)
            assertEquals(
                PlanChangeResult.Status.APPLIED,
                viewModel.sheetAnswers.value
                    .getValue(opening)
                    ?.status,
            )
            assertNull(viewModel.setupLessons.generationId.value)
        }

    @Test
    fun aToolChoiceWhoseSetupLessonIsWrittenAfterThePlanLeftShowsNothingOnReturn() =
        runTest {
            val held = HeldRuns(first = "writeSetupLessons", ready = "setupLessonsReady")
            viewModel = PlanViewModel(store, goalId, writingWaits(held))
            api.setupWritings += "run-1"
            val answer = ToolAnswer(listOf("Python"), PlanTool.Choice.SETUP, PlanTool.System.MACOS)

            viewModel.chooseTools(answer, PlanAsker.Sheet(opening))
            viewModel.visit.end()
            held.write()

            assertEquals(listOf(answer, answer), api.toolAnswers)
            assertEquals(emptyMap<UUID, PlanChangeResult?>(), viewModel.sheetAnswers.value)
        }

    @Test
    fun aSetupLessonStillUnwrittenAfterItsRunFailsTheTools() =
        runTest {
            api.setupWritings += listOf("run-1", "run-2")

            viewModel.chooseTools(ToolAnswer(listOf("Python"), PlanTool.Choice.SETUP, PlanTool.System.MACOS), PlanAsker.Sheet(opening))

            assertEquals(2, api.toolAnswers.size)
            assertEquals(mapOf(opening to null), viewModel.sheetAnswers.value)
            assertEquals(setOf(PlanPart.Tools), viewModel.failed.value)
            assertNull(viewModel.setupLessons.generationId.value)
        }

    @Test
    fun aChoiceThatFailsWhenSentAgainAfterItsRunClosesTheWaitAndFailsTheTools() =
        runTest {
            val held = HeldRuns(first = "writeSetupLessons", ready = "setupLessonsReady")
            viewModel = PlanViewModel(store, goalId, writingWaits(held))
            api.setupWritings += "run-1"

            viewModel.chooseTools(ToolAnswer(listOf("Python"), PlanTool.Choice.SETUP, PlanTool.System.MACOS), PlanAsker.Sheet(opening))
            api.toolFailure = ApiException(ApiError.Unavailable, status = 502)
            held.write()

            assertNull(viewModel.setupLessons.generationId.value)
            assertEquals(mapOf(opening to null), viewModel.sheetAnswers.value)
            assertEquals(setOf(PlanPart.Tools), viewModel.failed.value)
        }

    @Test
    fun aToolSetupThatDidntWorkFailsOnlyTheTools() =
        runTest {
            api.toolFailure = ApiException(ApiError.Unavailable, status = 502)

            viewModel.chooseTools(ToolAnswer(listOf("Python"), PlanTool.Choice.SETUP, PlanTool.System.MACOS), PlanAsker.Sheet(opening))

            assertEquals(mapOf(opening to null), viewModel.sheetAnswers.value)
            assertEquals(setOf(PlanPart.Tools), viewModel.failed.value)
            assertEquals(emptySet<PlanPart>(), viewModel.pending.value)
            assertNull(viewModel.latest.value)
        }

    @Test
    fun aRecommendationForThePrerequisitesSavesNothing() =
        runTest {
            val plan = shown()

            viewModel.askBasesAdvice(plan)

            assertEquals(PlanBase.Choice.ESSENTIAL, viewModel.basesAdvice.value.recommendedFor(plan))
            assertEquals(1, api.advised)
            assertTrue(api.changes.isEmpty())
        }

    @Test
    fun aNewDayAsksForTheRecommendationAgain() =
        runTest {
            val today = shown(onDay("2026-10-27"))
            viewModel.askBasesAdvice(today)
            viewModel.askBasesAdvice(today)
            assertEquals(1, api.advised)

            api.advice = api.advice.copy(recommended = PlanBasesAdvice.Recommended.QUICK)
            val tomorrow = shown(onDay("2026-10-28"))
            assertNull(viewModel.basesAdvice.value.recommendedFor(tomorrow))
            viewModel.askBasesAdvice(tomorrow)

            assertEquals(2, api.advised)
            assertEquals(PlanBase.Choice.QUICK, viewModel.basesAdvice.value.recommendedFor(tomorrow))
        }

    @Test
    fun aRecommendationStillOutIsNeverAskedForTwice() =
        runTest {
            val plan = shown()
            val gate = CompletableDeferred<Unit>()
            api.adviceGate = gate

            viewModel.askBasesAdvice(plan)
            viewModel.askBasesAdvice(plan)
            assertNull(viewModel.basesAdvice.value.recommendedFor(plan))
            gate.complete(Unit)

            assertEquals(1, api.advised)
            assertEquals(PlanBase.Choice.ESSENTIAL, viewModel.basesAdvice.value.recommendedFor(plan))
        }

    @Test
    fun aLateRecommendationForAnOlderPlanMarksNothing() =
        runTest {
            val gate = CompletableDeferred<Unit>()
            api.adviceGate = gate
            viewModel.askBasesAdvice(shown())

            api.advice = api.advice.copy(recommended = PlanBasesAdvice.Recommended.QUICK)
            val replanned = shown(coveragePlan(coreFits = false))
            viewModel.askBasesAdvice(replanned)
            gate.complete(Unit)

            assertEquals(2, api.advised)
            assertEquals(PlanBase.Choice.QUICK, viewModel.basesAdvice.value.recommendedFor(replanned))
        }

    @Test
    fun anotherPlansAskCancelsTheRecommendationStillOut() =
        runTest {
            val gate = CompletableDeferred<Unit>()
            api.adviceGate = gate
            viewModel.askBasesAdvice(shown())

            api.advice = api.advice.copy(recommended = PlanBasesAdvice.Recommended.QUICK)
            val replanned = shown(coveragePlan(coreFits = false))
            viewModel.askBasesAdvice(replanned)

            assertEquals(1, api.adviceCancelled)
            assertEquals(PlanBase.Choice.QUICK, viewModel.basesAdvice.value.recommendedFor(replanned))
            gate.complete(Unit)
            assertEquals(PlanBase.Choice.QUICK, viewModel.basesAdvice.value.recommendedFor(replanned))
        }

    @Test
    fun aSavedChangeCancelsTheRecommendationStillOut() =
        runTest {
            val gate = CompletableDeferred<Unit>()
            api.adviceGate = gate
            val plan = shown()
            viewModel.askBasesAdvice(plan)

            viewModel.change(PlanPart.Schedule, listOf(PlanOp.DailyMinutes(45)))

            assertEquals(1, api.adviceCancelled)
            assertNull(viewModel.basesAdvice.value.recommendedFor(plan))
        }

    @Test
    fun aPlanStillBeingBuiltMarksNothingAndTheNextOpeningAsksAgain() =
        runTest {
            val plan = shown()
            api.advice = api.advice.copy(ready = false)

            viewModel.askBasesAdvice(plan)
            assertNull(viewModel.basesAdvice.value.recommendedFor(plan))
            viewModel.askBasesAdvice(plan)

            assertEquals(2, api.advised)
        }

    @Test
    fun aChangeWhosePlanCantBeReadAgainLeavesNoRecommendation() =
        runTest {
            val plan = shown()
            viewModel.askBasesAdvice(plan)
            api.planFailure = ApiException(ApiError.Network)

            viewModel.change(PlanPart.Schedule, listOf(PlanOp.DailyMinutes(45)))

            assertNull(viewModel.basesAdvice.value.recommendedFor(plan))
        }

    /** [plan] as read on [date], so its advice is that day's. */
    private fun onDay(
        date: String,
        plan: Plan = coveragePlan(),
    ) = plan.copy(
        week =
            plan.week.copy(
                days = listOf(PlanDay(kotlinx.datetime.LocalDate.parse(date), emptyList(), 20.0, null, PlanDay.State.TODAY)),
            ),
    )

    @Test
    fun aSheetsAnswerStaysWithItsOwnOpeningUntilTheEditorOpensAgain() =
        runTest {
            val first = UUID.randomUUID()
            val saved = PlanChangeResult(change = planChange(), status = PlanChangeResult.Status.APPLIED)

            viewModel.chooseTools(ToolAnswer(listOf("Python"), PlanTool.Choice.HAVE), PlanAsker.Sheet(first))

            assertEquals(mapOf(first to saved), viewModel.sheetAnswers.value)
            viewModel.forgetLatest()
            assertEquals(emptyMap<UUID, PlanChangeResult?>(), viewModel.sheetAnswers.value)
        }

    @Test
    fun anAimThatAppliesWhileThePlanIsRecreatedClosesItsPickerOnce() =
        runTest {
            // No frame acts while the save is out, as when the window is recreated.
            viewModel.change(PlanPart.Aim, listOf(PlanOp.Aim("conversation")), PlanAsker.AimPicker)

            assertEquals(Unit, actOn(viewModel.outcomes.aimPicked))
            assertNull(actOn(viewModel.outcomes.aimPicked))
        }

    @Test
    fun anAimThatAppliesAfterThePlanLeftClosesNothingOnReturn() =
        runTest {
            val aim = PlanOp.Aim("conversation")
            val held = CompletableDeferred<Unit>().also { api.gates[aim] = it }

            viewModel.change(PlanPart.Aim, listOf(aim), PlanAsker.AimPicker)
            viewModel.visit.end()
            held.complete(Unit)

            assertEquals(listOf(listOf<PlanOp>(aim)), api.changes)
            assertNull(actOn(viewModel.outcomes.aimPicked))
        }

    @Test
    fun aMovedDateThatSavedBeforeThePlanActedAndThenLeftMovesNoFocusOnReturn() =
        runTest {
            viewModel.change(PlanPart.Schedule, listOf(PlanOp.TargetDate(LocalDate.parse("2027-06-12"))), PlanAsker.MoveDate)
            viewModel.visit.end()

            assertNull(actOn(viewModel.outcomes.dateMoved))
        }

    @Test
    fun aSuggestionThatSavesAfterThePlanLeftShowsNoAnswerOnReturn() =
        runTest {
            val time = PlanOp.DailyMinutes(45)
            val held = CompletableDeferred<Unit>().also { api.gates[time] = it }

            viewModel.change(PlanPart.Suggestion, listOf(time), PlanAsker.Suggestion(SlotItem.Coverage))
            viewModel.visit.end()
            held.complete(Unit)

            assertEquals(listOf(listOf<PlanOp>(time)), api.changes)
            assertNull(viewModel.slotState.result)
        }

    @Test
    fun aChangeThatFailsAfterThePlanLeftSaysNothingOnReturn() =
        runTest {
            val time = PlanOp.DailyMinutes(45)
            val held = CompletableDeferred<Unit>().also { api.gates[time] = it }
            api.changeFailure = ApiException(ApiError.Network)

            viewModel.change(PlanPart.Schedule, listOf(time), PlanAsker.Sheet(opening))
            viewModel.visit.end()
            held.complete(Unit)

            assertEquals(emptySet<PlanPart>(), viewModel.failed.value)
            assertEquals(emptyMap<UUID, PlanChangeResult?>(), viewModel.sheetAnswers.value)
        }

    @Test
    fun anExamChoiceThatSavesAfterThePlanLeftShowsNothingOnReturn() =
        runTest {
            val read = CompletableDeferred<Unit>().also { api.planGate = it }

            viewModel.chooseExamOption("Foreign language", listOf("Spanish"), PlanAsker.Sheet(opening))
            viewModel.visit.end()
            read.complete(Unit)

            assertEquals(listOf("Foreign language" to listOf("Spanish")), api.examChoices)
            assertEquals(emptyMap<UUID, PlanChangeResult?>(), viewModel.sheetAnswers.value)
        }

    @Test
    fun aCountrySavedWhileThePlanIsRecreatedClosesItsQuestionOnce() =
        runTest {
            viewModel.setRegion("MX")
            viewModel.setContentCountry("PT")

            assertEquals(Unit, actOn(viewModel.outcomes.regionSaved))
            assertEquals(Unit, actOn(viewModel.outcomes.countrySaved))
            assertNull(actOn(viewModel.outcomes.regionSaved))
            assertNull(actOn(viewModel.outcomes.countrySaved))
        }

    @Test
    fun aCountrySavedAfterThePlanLeftClosesNothingOnReturn() =
        runTest {
            val held = CompletableDeferred<Unit>().also { api.goalGate = it }

            viewModel.setRegion("MX")
            viewModel.setContentCountry("PT")
            viewModel.visit.end()
            held.complete(Unit)

            assertNull(actOn(viewModel.outcomes.regionSaved))
            assertNull(actOn(viewModel.outcomes.countrySaved))
        }

    @Test
    fun aCountryThatFailsAfterThePlanLeftSaysNothingOnReturn() =
        runTest {
            val held = CompletableDeferred<Unit>().also { api.goalGate = it }
            api.goalFailure = ApiException(ApiError.Network)

            viewModel.setContentCountry("PT")
            viewModel.visit.end()
            held.complete(Unit)

            assertEquals(emptySet<PlanPart>(), viewModel.failed.value)
        }

    /** What the frame acts on, then acknowledges, as `ActOn` does. */
    private fun <T : Any> actOn(outcome: VisitOutcome<T>) = outcome.value?.also(outcome::acted)

    @Test
    fun anAimFromAnEarlierEditorOpeningClosesNoPickerInTheNext() =
        runTest {
            val aim = PlanOp.Aim("conversation")
            val held = CompletableDeferred<Unit>().also { api.gates[aim] = it }

            viewModel.change(PlanPart.Aim, listOf(aim), PlanAsker.AimPicker)
            reopenEditor()
            held.complete(Unit)

            assertEquals(listOf(listOf<PlanOp>(aim)), api.changes)
            assertNull(viewModel.outcomes.aimPicked.value)
        }

    @Test
    fun aCountryFromAnEarlierEditorOpeningClosesNoPickerInTheNext() =
        runTest {
            val held = CompletableDeferred<Unit>().also { api.goalGate = it }

            viewModel.setRegion("MX")
            viewModel.setContentCountry("PT")
            reopenEditor()
            held.complete(Unit)

            assertNull(viewModel.outcomes.regionSaved.value)
            assertNull(viewModel.outcomes.countrySaved.value)
        }

    @Test
    fun anAimFromAPickerTheLearnerClosedClosesNoOtherPicker() =
        runTest {
            val aim = PlanOp.Aim("conversation")
            val held = CompletableDeferred<Unit>().also { api.gates[aim] = it }

            viewModel.change(PlanPart.Aim, listOf(aim), PlanAsker.AimPicker)
            viewModel.outcomes.aimPicker.end()
            held.complete(Unit)

            assertEquals(listOf(listOf<PlanOp>(aim)), api.changes)
            assertNull(viewModel.outcomes.aimPicked.value)
        }

    @Test
    fun aCountryFromAPickerTheLearnerClosedClosesNoOtherPicker() =
        runTest {
            val held = CompletableDeferred<Unit>().also { api.goalGate = it }

            viewModel.setRegion("MX")
            viewModel.outcomes.varietyPicker.end()
            viewModel.setContentCountry("PT")
            viewModel.outcomes.countryPicker.end()
            held.complete(Unit)

            assertNull(viewModel.outcomes.regionSaved.value)
            assertNull(viewModel.outcomes.countrySaved.value)
        }

    @Test
    fun aDateMovedFromAnEarlierEditorOpeningMovesNoFocusInTheNext() =
        runTest {
            val plan = shown()
            val date = PlanOp.TargetDate(LocalDate.parse("2027-06-12"))
            val held = CompletableDeferred<Unit>().also { api.gates[date] = it }
            api.timeToCoverGate = CompletableDeferred()

            viewModel.change(PlanPart.Schedule, listOf(date), PlanAsker.MoveDate)
            viewModel.findTimeToCover(plan, TimeAsker.MoveDate)
            reopenEditor()
            held.complete(Unit)
            api.timeToCoverGate?.complete(Unit)

            assertNull(viewModel.outcomes.dateMoved.value)
            assertNull(viewModel.outcomes.moveDateFound.value)
        }

    /** The learner closes the editor, which ends its opening's visit (its `VisitOf`), and opens it again. */
    private fun reopenEditor() {
        viewModel.outcomes.editor.end()
        viewModel.forgetLatest()
    }

    @Test
    fun aFailureWhileThePlanIsRecreatedIsSaidOnce() =
        runTest {
            api.changeFailure = ApiException(ApiError.Network)

            // No frame acts while the save is out, as when the window is recreated.
            viewModel.change(PlanPart.FullCourse, listOf(PlanOp.FullCourse(true)), PlanAsker.SaysFailure)

            assertEquals(Unit, actOn(viewModel.outcomes.saveFailed))
            assertNull(actOn(viewModel.outcomes.saveFailed))
        }

    @Test
    fun aFailureAfterThePlanLeftIsSaidNowhere() =
        runTest {
            val time = PlanOp.DailyMinutes(45)
            val held = CompletableDeferred<Unit>().also { api.gates[time] = it }
            api.changeFailure = ApiException(ApiError.Network)

            viewModel.change(PlanPart.Schedule, listOf(time), PlanAsker.SaysFailure)
            viewModel.visit.end()
            held.complete(Unit)

            assertNull(viewModel.outcomes.saveFailed.value)
        }

    @Test
    fun aStatusThatFailsAfterThePlanLeftIsSaidNowhere() =
        runTest {
            val held = CompletableDeferred<Unit>()
            api.statusGate = held
            api.statusFailure = ApiException(ApiError.Network)

            viewModel.setStatus(LearnerSummaryGoal.Status.PAUSED)
            viewModel.visit.end()
            held.complete(Unit)

            assertNull(viewModel.outcomes.saveFailed.value)
        }

    @Test
    fun aSearchWhoseSuggestionClosedBeforeItAnsweredOwesItNothing() =
        runTest {
            val plan = shown()
            api.timeToCoverGate = CompletableDeferred()

            viewModel.findTimeToCover(plan, TimeAsker.Coverage(CoverageIntent.Time))
            viewModel.findTimeToCover(plan, TimeAsker.PastDate(request = 1))
            viewModel.outcomes.suggestion.end()
            api.timeToCoverGate?.complete(Unit)

            assertNull(viewModel.outcomes.coverageFound.value)
            assertNull(viewModel.outcomes.pastDateFound.value)
            assertEquals(TimeToCoverState.Answered(planAdviceRevision(plan), api.timeToCover), viewModel.timeToCover.value)
        }

    @Test
    fun aRegionFailureFromAnEarlierEditorOpeningMarksNothingInTheNext() =
        runTest {
            val held = CompletableDeferred<Unit>().also { api.goalGate = it }
            api.goalFailure = ApiException(ApiError.Network)
            viewModel.setRegion("MX")
            reopenEditor()
            held.complete(Unit)
            assertFalse(viewModel.failed.value.contains(PlanPart.Region))
        }

    private companion object {
        /** A later day's fit offer: its numbers are the last plan write's, so the tap checks today's first. */
        val FIT_PLAN =
            plan(
                """"fitOffer":{"canApply":false,"fits":false,"operations":[{"kind":"fitLessons"}],"effect":{"lessonsAdded":6,""" +
                    """"lessonsRemoved":0,"topicsAdded":[{"area":"Web apps","topics":["Flask","Django","FastAPI"]}]}}""",
            )
        val FIT_OPERATIONS = FIT_PLAN.fitOffer!!.operations.map { it.op }
    }
}
