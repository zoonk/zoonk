package com.zoonk.android.feature.placementtest

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
import com.zoonk.android.feature.onboarding.PlacementPart
import com.zoonk.android.feature.onboarding.orderQuestion
import com.zoonk.android.feature.questions.Answer
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementCompletion
import com.zoonk.api.models.PlacementLength
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class PlacementTestViewModelTest {
    private val models = ViewModelStore()

    @After
    fun tearDown() {
        models.clear()
        Dispatchers.resetMain()
    }

    private fun TestScope.viewModel(
        api: OnboardingApi,
        handle: SavedStateHandle = SavedStateHandle(),
    ): Pair<PlacementTestViewModel, OnboardingStore> {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val store = OnboardingStore(api, AppCache(session, backgroundScope), session) { SignInResult.SignedIn }
        return PlacementTestViewModel(GOAL_ID, store, handle).also { models.put("placement-test", it) } to store
    }

    private fun TestScope.shown(
        vm: PlacementTestViewModel,
        store: OnboardingStore,
    ): PlacementTestPhase {
        val placements = store.placements[GOAL_ID]
        runCurrent()
        return vm.phase(placements.state.value)
    }

    @Test
    fun anOpenAttemptGoesOnAtItsQuestionAndAFullTestBetweenPartsAsksToContinue() {
        assertEquals(PlacementTestPhase.Choose, placementTestPhase(LoadState.Loaded(placement(attempt = null)), closed = null))
        assertTrue(placementTestPhase(LoadState.Loaded(placement(PART_ONE)), closed = null) is PlacementTestPhase.Question)
        assertEquals(
            PlacementTestPhase.Waiting,
            placementTestPhase(LoadState.Loaded(placement(PART_ONE, status = "waitingForQuestions")), closed = null),
        )
        assertTrue(placementTestPhase(LoadState.Loaded(placement(PART_ONE, next = null)), closed = null) is PlacementTestPhase.PartOver)
        assertTrue(placementTestPhase(LoadState.Loaded(placement(PART_ONE_CLOSED)), closed = null) is PlacementTestPhase.Continue)
    }

    @Test
    fun anOpenPartWithNoAvailableQuestionsCanFinish() {
        val read = placement(PART_ONE, next = null, status = "unavailable")
        assertTrue(placementTestPhase(LoadState.Loaded(read), closed = null) is PlacementTestPhase.PartOver)
    }

    @Test
    fun aPartWhoseQuestionsFailedKeepsTheWaitOpen() {
        val read = placement(PART_ONE, next = null, status = "failed")
        assertTrue(placementTestPhase(LoadState.Loaded(read), closed = null) is PlacementTestPhase.PreparationFailed)
        assertEquals(null, read.partOver())
    }

    @Test
    fun theFullTestSaysItsPartFromTheFirstQuestionAndTheQuickTestDoesNot() {
        val full = placementTestPhase(LoadState.Loaded(placement(PART_TWO)), closed = null) as PlacementTestPhase.Question
        val quick = placementTestPhase(LoadState.Loaded(placement(QUICK)), closed = null) as PlacementTestPhase.Question

        assertTrue(full.wholeCourse)
        assertEquals(2L, full.attempt.part)
        assertEquals(1, full.number)
        assertFalse(quick.wholeCourse)
    }

    @Test
    fun theLastAnswerOfAPartSaysItIsDoneAndKeepGoingOpensTheNextPartAtItsFirstQuestion() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(PART_ONE)
                    answered = { placement(PART_ONE, next = null) }
                    completion = completion(attempt = PART_ONE_CLOSED, skipped = 6, heldUntilTomorrow = true)
                    sitting = { placement(PART_TWO) }
                }
            val (vm, store) = viewModel(api)
            val question = shown(vm, store.also { it.placements[GOAL_ID].load() }) as PlacementTestPhase.Question

            vm.answer(question, Answer.Order(listOf(0, 1, 2, 3)), durationMs = 2_000)
            runCurrent()

            assertEquals(PlacementPart(ATTEMPT, 1), api.placementAnswers.single().let { PlacementPart(it.attemptId!!, it.part!!) })
            assertEquals(listOf(PlacementPart(ATTEMPT, 1)), api.finishedParts)
            val done = vm.phase(store.placements[GOAL_ID].state.value) as PlacementTestPhase.PartDone
            assertEquals(
                PlacementTestPhase.PartDone(ATTEMPT, 1, 3, 6, partsLeft = 2, minutesEach = 6, heldUntilTomorrow = true),
                done.copy(changeId = null),
            )

            vm.start(PlacementLength.WHOLE_COURSE)
            runCurrent()

            val next = vm.phase(store.placements[GOAL_ID].state.value) as PlacementTestPhase.Question
            assertEquals(listOf<PlacementLength?>(PlacementLength.WHOLE_COURSE), api.sittingLengths)
            assertEquals(2L, next.attempt.part)
            assertEquals(1, next.number)
            assertFalse(vm.failed)
        }

    @Test
    fun stoppingMidPartSaysWhereTheTestPicksUpAndComingBackContinuesThere() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(PART_TWO_FOURTH)
                    completion = completion(attempt = PART_TWO_STOPPED, skipped = 1)
                    sitting = { placement(PART_TWO_FOURTH) }
                }
            val (vm, store) = viewModel(api)
            val question = shown(vm, store.also { it.placements[GOAL_ID].load() }) as PlacementTestPhase.Question

            vm.stop(question)
            runCurrent()

            assertEquals(listOf(3L), api.finishedAnswered)
            assertEquals(
                PlacementTestPhase.PartStopped(ATTEMPT, part = 2, parts = 3, question = 4, lessonsSkipped = 1),
                (vm.phase(store.placements[GOAL_ID].state.value) as PlacementTestPhase.PartStopped).copy(changeId = null),
            )

            val later = PlacementTestViewModel(GOAL_ID, store, SavedStateHandle())
            val back = later.phase(LoadState.Loaded(placement(PART_TWO_STOPPED, next = null, status = "done")))
            assertTrue(back is PlacementTestPhase.Continue)

            later.start(PlacementLength.WHOLE_COURSE)
            runCurrent()
            val resumed = later.phase(store.placements[GOAL_ID].state.value) as PlacementTestPhase.Question
            assertEquals(4, resumed.number)
            assertEquals(2L, resumed.attempt.part)
        }

    @Test
    fun aPartAnotherDeviceClosedFirstShowsWhereTheTestIsInsteadOfAFailure() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(PART_ONE, next = null)
                    writeFailure = ApiException(ApiError.Unavailable)
                }
            val (vm, store) = viewModel(api)
            val over = shown(vm, store.also { it.placements[GOAL_ID].load() }) as PlacementTestPhase.PartOver
            api.placement = placement(PART_ONE_CLOSED)

            vm.finishPart(over.attempt)
            runCurrent()

            assertFalse(vm.failed)
            assertTrue(vm.phase(store.placements[GOAL_ID].state.value) is PlacementTestPhase.Continue)
        }

    @Test
    fun aCloseThatFailsWhileThePartIsStillOpenSaysSo() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(PART_ONE, next = null)
                    writeFailure = ApiException(ApiError.Unavailable)
                }
            val (vm, store) = viewModel(api)
            val over = shown(vm, store.also { it.placements[GOAL_ID].load() }) as PlacementTestPhase.PartOver

            vm.finishPart(over.attempt)
            runCurrent()

            assertTrue(vm.failed)
        }

    @Test
    fun aQuickTestThatEndsWithPartsLeftShowsItsResultAndCanTestTheRest() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(attempt = null)
                    sitting = { placement(QUICK, next = null) }
                    completion = completion(attempt = QUICK_DONE, skipped = 3, result = true, heldUntilTomorrow = true)
                }
            val (vm, store) = viewModel(api)
            store.placements[GOAL_ID].load()

            vm.start(PlacementLength.QUICK)
            runCurrent()

            assertEquals(listOf<PlacementLength?>(PlacementLength.QUICK), api.sittingLengths)
            val result = vm.phase(store.placements[GOAL_ID].state.value) as PlacementTestPhase.Result
            assertEquals(3, result.lessonsSkipped)
            assertEquals(2, result.partsLeft)
            assertTrue(result.heldUntilTomorrow)
            assertEquals("Loops with for", result.nextLesson)
            // Coming back to the quick test that ended shows its result too, never "in progress".
            val back =
                placementTestPhase(LoadState.Loaded(placement(QUICK_DONE, next = null, status = "done", result = true)), closed = null)
            assertEquals(2, (back as PlacementTestPhase.Result).partsLeft)
        }

    @Test
    fun aClosedPartStillShowsWhatItSkippedAfterTheProcessIsReclaimed() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(attempt = null)
                    sitting = { placement(PART_ONE, next = null) }
                    completion = completion(attempt = null, skipped = 7, result = true)
                }
            val handle = SavedStateHandle()
            val (vm, store) = viewModel(api, handle)
            store.placements[GOAL_ID].load()
            vm.start(PlacementLength.WHOLE_COURSE)
            runCurrent()
            val shown = vm.phase(store.placements[GOAL_ID].state.value)

            val restored =
                PlacementTestViewModel(GOAL_ID, store, SavedStateHandle.createHandle(handle.savedStateProvider().saveState(), null))

            assertEquals(7, (shown as PlacementTestPhase.Result).lessonsSkipped)
            assertEquals(0, shown.partsLeft)
            assertEquals(shown, restored.phase(LoadState.Loaded(placement(attempt = null))))
        }

    private companion object {
        val ATTEMPT: UUID = UUID.fromString("0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d")

        fun attemptOf(
            length: String,
            part: Int,
            complete: Boolean,
            answered: Int = 0,
            resume: Int? = null,
        ) = """{"id":"$ATTEMPT","length":"$length","part":$part,"partComplete":$complete,"estimatedMinutes":6,"answered":$answered,
            |"chapter":"Loops","nextPart":${if (complete) part + 1 else "null"},"parts":3,"partsLeft":${if (complete) 2 else 3 - part + 1},
            |"questions":12,"remainingEstimatedMinutes":12,"resume":${resume?.let { """{"part":$part,"question":$it}""" } ?: "null"},
            |"totalEstimatedMinutes":18}
            """.trimMargin()

        val PART_ONE = attemptOf("wholeCourse", 1, complete = false)
        val PART_ONE_CLOSED = attemptOf("wholeCourse", 1, complete = true)
        val PART_TWO = attemptOf("wholeCourse", 2, complete = false)
        val PART_TWO_FOURTH = attemptOf("wholeCourse", 2, complete = false, answered = 3)
        val PART_TWO_STOPPED = attemptOf("wholeCourse", 2, complete = false, answered = 3, resume = 4)
        val QUICK = attemptOf("quick", 1, complete = false)
        val QUICK_DONE = attemptOf("quick", 1, complete = true)

        fun placement(
            attempt: String?,
            next: String? = orderQuestion(),
            status: String = "asking",
            result: Boolean = false,
        ): Placement =
            ApiJson.decodeFromString(
                Placement.serializer(),
                """
                {"answered":0,"areas":[],"complete":false,"dayBudgetSpent":0.2,"dayBudgetUsed":false,"knownSkillIds":[],"needsItems":[],
                 "next":${next ?: "null"},"phases":[],"started":true,"status":"$status","trueFalseLabels":"trueFalse","focusTest":null,
                 "attempt":${attempt ?: "null"},"result":${if (result) RESULT_OF_3 else "null"}}
                """.trimIndent(),
            )

        const val RESULT_OF_3 =
            """{"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","finishedAt":"2026-11-21T14:00:00Z","lessonsSkipped":3,
            "nextLesson":{"id":"1a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","title":"Loops with for"}}"""

        fun completion(
            attempt: String?,
            skipped: Int,
            result: Boolean = false,
            heldUntilTomorrow: Boolean = false,
        ): PlacementCompletion =
            ApiJson.decodeFromString(
                PlacementCompletion.serializer(),
                """
                {"areas":[],"complete":true,"knownSkillIds":[],"phases":[],"testedOutPlanItemIds":[],"focusTest":null,
                 "attempt":${attempt ?: "null"},"lessonsSkipped":$skipped,"partLessonsSkipped":$skipped,
                 ${if (heldUntilTomorrow && !result) """"heldUntilTomorrow":true,""" else ""}
                 "result":${if (result) {
                    val held = if (heldUntilTomorrow) ""","heldUntilTomorrow":true""" else ""
                    """{"attemptId":"$ATTEMPT","finishedAt":"2026-11-21T14:00:00Z","lessonsSkipped":$skipped$held,
                    "nextLesson":{"id":"1a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","title":"Loops with for"}}"""
                } else {
                    "null"
                }}}
                """.trimIndent(),
            )
    }
}
