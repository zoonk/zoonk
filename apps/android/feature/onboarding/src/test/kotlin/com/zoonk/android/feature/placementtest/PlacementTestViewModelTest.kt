package com.zoonk.android.feature.placementtest

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

    private fun TestScope.viewModel(api: OnboardingApi): Pair<PlacementTestViewModel, OnboardingStore> {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val store = OnboardingStore(api, AppCache(session, backgroundScope), session) { SignInResult.SignedIn }
        return PlacementTestViewModel(GOAL_ID, store).also { models.put("placement-test", it) } to store
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
    fun anOpenAttemptGoesOnAtItsQuestionAndOneClosedOnAnotherDeviceWaitsBetweenParts() {
        assertEquals(PlacementTestPhase.Choose, placementTestPhase(LoadState.Loaded(placement(attempt = null)), closed = null))
        assertTrue(placementTestPhase(LoadState.Loaded(placement(PART_ONE)), closed = null) is PlacementTestPhase.Question)
        assertEquals(
            PlacementTestPhase.Waiting,
            placementTestPhase(LoadState.Loaded(placement(PART_ONE, status = "waitingForQuestions")), closed = null),
        )
        assertTrue(placementTestPhase(LoadState.Loaded(placement(PART_ONE, next = null)), closed = null) is PlacementTestPhase.PartOver)
        val between = placementTestPhase(LoadState.Loaded(placement(PART_ONE_CLOSED)), closed = null)
        assertEquals(null, (between as PlacementTestPhase.Between).lessonsSkipped)
    }

    @Test
    fun anOpenPartWithNoAvailableQuestionsCanFinish() {
        val read = placement(PART_ONE, next = null, status = "unavailable")
        assertTrue(placementTestPhase(LoadState.Loaded(read), closed = null) is PlacementTestPhase.PartOver)
    }

    @Test
    fun theLastAnswerOfAPartClosesThatPartAndSaysWhatItSkipped() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(PART_ONE)
                    answered = { placement(PART_ONE, next = null) }
                    completion = completion(attempt = PART_TWO, skipped = 6, heldUntilTomorrow = true)
                }
            val (vm, store) = viewModel(api)
            val question = shown(vm, store.also { it.placements[GOAL_ID].load() }) as PlacementTestPhase.Question

            vm.answer(question, Answer.Order(listOf(0, 1, 2, 3)), durationMs = 2_000)
            runCurrent()

            assertEquals(PlacementPart(ATTEMPT, 1), api.placementAnswers.single().let { PlacementPart(it.attemptId!!, it.part!!) })
            assertEquals(listOf(PlacementPart(ATTEMPT, 1)), api.finishedParts)
            val between = vm.phase(store.placements[GOAL_ID].state.value) as PlacementTestPhase.Between
            assertEquals(6, between.lessonsSkipped)
            assertEquals(2L, between.attempt.part)
            assertTrue(between.heldUntilTomorrow)
            assertFalse(vm.failed)
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
            assertTrue(vm.phase(store.placements[GOAL_ID].state.value) is PlacementTestPhase.Between)
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
    fun aQuickTestThatClosesShowsItsResultWhileThePlanReadsAgain() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(attempt = null)
                    sitting = { placement(QUICK, next = null) }
                    completion = completion(attempt = null, skipped = 3, result = true, heldUntilTomorrow = true)
                }
            val (vm, store) = viewModel(api)
            store.placements[GOAL_ID].load()

            vm.start(PlacementLength.QUICK)
            runCurrent()
            api.placement = placement(attempt = null)

            assertEquals(listOf<PlacementLength?>(PlacementLength.QUICK), api.sittingLengths)
            assertEquals(
                PlacementTestPhase.Result(PlacementLength.QUICK, 3, attemptId = ATTEMPT, heldUntilTomorrow = true),
                vm.phase(store.placements[GOAL_ID].state.value),
            )
        }

    private companion object {
        val ATTEMPT: UUID = UUID.fromString("0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d")

        fun attemptOf(
            length: String,
            part: Int,
            complete: Boolean,
        ) = """{"id":"$ATTEMPT","length":"$length","part":$part,"partComplete":$complete,"estimatedMinutes":20}"""

        val PART_ONE = attemptOf("wholeCourse", 1, complete = false)
        val PART_ONE_CLOSED = attemptOf("wholeCourse", 1, complete = true)
        val PART_TWO = attemptOf("wholeCourse", 2, complete = false)
        val QUICK = attemptOf("quick", 1, complete = false)

        fun placement(
            attempt: String?,
            next: String? = orderQuestion(),
            status: String = "asking",
        ): Placement =
            ApiJson.decodeFromString(
                Placement.serializer(),
                """
                {"answered":0,"areas":[],"complete":false,"dayBudgetSpent":0.2,"dayBudgetUsed":false,"knownSkillIds":[],"needsItems":[],
                 "next":${next ?: "null"},"phases":[],"started":true,"status":"$status","trueFalseLabels":"trueFalse","focusTest":null,
                 "attempt":${attempt ?: "null"}}
                """.trimIndent(),
            )

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
                    """{"attemptId":"$ATTEMPT","finishedAt":"2026-11-21T14:00:00Z","lessonsSkipped":$skipped$held}"""
                } else {
                    "null"
                }}}
                """.trimIndent(),
            )
    }
}
