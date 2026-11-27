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
import com.zoonk.android.feature.onboarding.orderQuestion
import com.zoonk.android.feature.questions.Answer
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementCompletion
import com.zoonk.api.models.PlacementLength
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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
    fun anOpenAttemptGoesOnAtItsQuestionAndOneWithNothingLeftToAskIsOver() {
        assertEquals(PlacementTestPhase.Choose, placementTestPhase(LoadState.Loaded(placement(attempt = null)), closed = null))
        assertTrue(placementTestPhase(LoadState.Loaded(placement(OPEN)), closed = null) is PlacementTestPhase.Question)
        assertEquals(
            PlacementTestPhase.Waiting,
            placementTestPhase(LoadState.Loaded(placement(OPEN, status = "waitingForQuestions")), closed = null),
        )
        assertTrue(
            placementTestPhase(LoadState.Loaded(placement(OPEN, next = null, status = "done")), closed = null) is PlacementTestPhase.Over,
        )
    }

    @Test
    fun aTestTheLearnerAskedForWaitsWhileTheCourseIsBuiltThenOpensAtItsFirstQuestion() =
        runTest {
            val cold = placement(attempt = null, next = null, status = "preparing")
            val api =
                FakeOnboardingApi().apply {
                    placement = cold
                    sitting = { placement }
                }
            val (vm, store) = viewModel(api)
            store.placements[GOAL_ID].load()
            assertEquals(PlacementTestPhase.Choose, shown(vm, store))

            vm.start()
            assertEquals(PlacementTestPhase.Waiting, shown(vm, store))

            api.placement = placement(attempt = null)
            store.placements[GOAL_ID].refresh()
            assertEquals(PlacementTestPhase.Arrived, shown(vm, store))

            api.sitting = { placement(OPEN) }
            vm.start()
            runCurrent()
            assertEquals(listOf<PlacementLength?>(PlacementLength.QUICK, PlacementLength.QUICK), api.sittingLengths)
            assertTrue(shown(vm, store) is PlacementTestPhase.Question)
        }

    @Test
    fun aStartThatDidNotGoThroughKeepsTheOfferAndSaysSo() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(attempt = null, next = null, status = "preparing")
                    writeFailure = ApiException(ApiError.Network)
                }
            val (vm, store) = viewModel(api)
            store.placements[GOAL_ID].load()

            vm.start()
            assertEquals(PlacementTestPhase.Choose, shown(vm, store))
            assertTrue(vm.failed)

            api.writeFailure = null
            api.sitting = { placement(OPEN) }
            vm.start()
            assertTrue(shown(vm, store) is PlacementTestPhase.Question)
            assertFalse(vm.failed)
        }

    @Test
    fun anAskedStartThatFailedStartsAgainWhenTheAppComesBackFromProcessDeath() =
        askedStartFailed { _, handle, store ->
            PlacementTestViewModel(GOAL_ID, store, SavedStateHandle.createHandle(handle.savedStateProvider().saveState(), null))
        }

    @Test
    fun anAskedStartThatFailedStartsAgainWhenTheLearnerComesBack() = askedStartFailed { vm, _, _ -> vm.also { it.visit.end() } }

    /** A learner who asked for the test on the level question never comes back to a spinner with nothing on its way. */
    private fun askedStartFailed(comeBack: (PlacementTestViewModel, SavedStateHandle, OnboardingStore) -> PlacementTestViewModel) =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(attempt = null)
                    writeFailure = ApiException(ApiError.Network)
                }
            val handle = SavedStateHandle()
            val (vm, store) = viewModel(api, handle)
            store.placements[GOAL_ID].load()
            vm.startAsked()
            assertEquals(PlacementTestPhase.Choose, shown(vm, store))
            assertTrue(vm.failed)

            api.writeFailure = null
            api.sitting = { placement(OPEN) }
            val back = comeBack(vm, handle, store)
            back.startAsked()

            assertTrue(shown(back, store) is PlacementTestPhase.Question)
            assertEquals(2, api.sittingsStarted)
        }

    @Test
    fun anAskedStartStillOnItsWayWhenTheLearnerCameBackStartsAgainOnceItFails() =
        runTest {
            val fake = FakeOnboardingApi().apply { placement = placement(attempt = null) }
            val answer = CompletableDeferred<Unit>()
            val api =
                object : OnboardingApi by fake {
                    override suspend fun startPlacementSitting(
                        session: AuthenticatedSession,
                        goalId: String,
                        length: PlacementLength?,
                    ): Placement {
                        answer.await()
                        return fake.startPlacementSitting(session, goalId, length)
                    }
                }
            val (vm, store) = viewModel(api)
            store.placements[GOAL_ID].load()
            vm.startAsked()
            runCurrent()

            vm.visit.end()
            vm.startAsked()
            fake.writeFailure = ApiException(ApiError.Network)
            answer.complete(Unit)
            assertEquals(PlacementTestPhase.Choose, shown(vm, store))
            assertFalse(vm.failed)

            fake.writeFailure = null
            fake.sitting = { placement(OPEN) }
            vm.startAsked()
            assertTrue(shown(vm, store) is PlacementTestPhase.Question)
        }

    @Test
    fun aTestTheLearnerAskedForSaysWhenItsCourseCouldNotBeBuiltOrHasNothingToTest() =
        runTest {
            val api = FakeOnboardingApi().apply { placement = placement(attempt = null, next = null, status = "failed") }
            val (vm, store) = viewModel(api)
            store.placements[GOAL_ID].load()
            vm.start()
            assertEquals(PlacementTestPhase.PreparationFailed(attempt = null), shown(vm, store))

            api.placement = placement(attempt = null, next = null, status = "done")
            vm.start()
            assertEquals(PlacementTestPhase.Unavailable, shown(vm, store))
        }

    @Test
    fun anOpenTestWhoseNextQuestionCannotBeHadOrFailedIsNeverClosedAsOver() {
        val unavailable = placement(OPEN, next = null, status = "unavailable")
        val failed = placement(OPEN, next = null, status = "failed")

        assertEquals(PlacementTestPhase.Unavailable, placementTestPhase(LoadState.Loaded(unavailable), closed = null))
        assertTrue(placementTestPhase(LoadState.Loaded(failed), closed = null) is PlacementTestPhase.PreparationFailed)
        assertNull(unavailable.over())
        assertNull(failed.over())
    }

    @Test
    fun theLastAnswerClosesTheTestAndShowsWhereTheLearnerStarts() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(OPEN)
                    answered = { placement(OPEN, next = null, status = "done") }
                    completion = completion(skipped = 4, result = RESULT)
                }
            val (vm, store) = viewModel(api)
            val question = shown(vm, store.also { it.placements[GOAL_ID].load() }) as PlacementTestPhase.Question

            vm.answer(question, Answer.Order(listOf(0, 1, 2, 3)), durationMs = 2_000)
            runCurrent()

            assertEquals(ATTEMPT, api.placementAnswers.single().attemptId)
            assertNull(api.placementAnswers.single().part)
            assertEquals(listOf<UUID?>(ATTEMPT), api.finishedAttempts)
            val result = vm.phase(store.placements[GOAL_ID].state.value) as PlacementTestPhase.Result
            assertEquals("Why prices move", result.chapter)
            assertEquals("News, results and expectations", result.nextLesson)
            assertEquals(5, result.nextMinutes)
            assertEquals(CHANGE, result.changeId)
            assertEquals(
                PlacementTestPhase.Course(
                    lessons = 9,
                    chapters =
                        listOf(
                            PlacementTestPhase.Chapter(2, 2, start = false),
                            PlacementTestPhase.Chapter(3, 2, start = true),
                            PlacementTestPhase.Chapter(4, 0, start = false),
                        ),
                ),
                result.course,
            )
            assertFalse(vm.failed)
        }

    @Test
    fun aResultThatSkippedNothingOffersNoUndo() {
        val nothing = completion(skipped = 0, result = RESULT.replace("\"lessonsSkipped\":4", "\"lessonsSkipped\":0"))
        val opened = placement(OPEN).attempt!!

        assertNull(nothing.closed(opened).result.changeId)
    }

    @Test
    fun stoppingClosesTheTestWithTheAnswersTheLearnerSaw() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(OPEN_FOURTH)
                    completion = completion(skipped = 4, result = RESULT)
                }
            val (vm, store) = viewModel(api)
            val question = shown(vm, store.also { it.placements[GOAL_ID].load() }) as PlacementTestPhase.Question

            vm.stop(question)
            runCurrent()

            assertEquals(listOf(3L), api.finishedAnswered)
            assertEquals("Why prices move", (vm.phase(store.placements[GOAL_ID].state.value) as PlacementTestPhase.Result).chapter)
        }

    @Test
    fun aTestAnotherDeviceClosedFirstShowsItsResultInsteadOfAFailure() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(OPEN, next = null, status = "done")
                    writeFailure = ApiException(ApiError.Unavailable)
                }
            val (vm, store) = viewModel(api)
            val over = shown(vm, store.also { it.placements[GOAL_ID].load() }) as PlacementTestPhase.Over
            api.placement = placement(attempt = null, next = null, status = "done", result = RESULT)

            vm.finish(over.attempt)
            runCurrent()

            assertFalse(vm.failed)
            assertTrue(vm.phase(store.placements[GOAL_ID].state.value, finished = true) is PlacementTestPhase.Result)
        }

    @Test
    fun aStopRefusedBecauseAnotherDeviceAnsweredMoreShowsWhereTheTestIsInsteadOfAFailure() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(OPEN_FOURTH)
                    writeFailure = ApiException(ApiError.Unavailable, status = 409)
                }
            val (vm, store) = viewModel(api)
            val question = shown(vm, store.also { it.placements[GOAL_ID].load() }) as PlacementTestPhase.Question
            api.placement = placement(attemptOf(answered = 5))

            vm.stop(question)
            runCurrent()

            assertEquals(listOf(3L), api.finishedAnswered)
            assertEquals(0, vm.saveFailures)
            assertEquals(6, (vm.phase(store.placements[GOAL_ID].state.value) as PlacementTestPhase.Question).number)
        }

    @Test
    fun aCloseThatFailsWhileTheTestIsStillOpenSaysSo() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(OPEN, next = null, status = "done")
                    writeFailure = ApiException(ApiError.Unavailable)
                }
            val (vm, store) = viewModel(api)
            val over = shown(vm, store.also { it.placements[GOAL_ID].load() }) as PlacementTestPhase.Over

            vm.finish(over.attempt)
            runCurrent()

            assertTrue(vm.failed)
        }

    @Test
    fun aClosedTestStillShowsItsResultAfterTheProcessIsReclaimed() =
        runTest {
            val api =
                FakeOnboardingApi().apply {
                    placement = placement(attempt = null)
                    sitting = { placement(OPEN, next = null, status = "done") }
                    completion = completion(skipped = 4, result = RESULT)
                }
            val handle = SavedStateHandle()
            val (vm, store) = viewModel(api, handle)
            store.placements[GOAL_ID].load()
            vm.start()
            runCurrent()
            val shown = vm.phase(store.placements[GOAL_ID].state.value)

            val restored =
                PlacementTestViewModel(GOAL_ID, store, SavedStateHandle.createHandle(handle.savedStateProvider().saveState(), null))

            assertEquals(4, (shown as PlacementTestPhase.Result).lessonsSkipped)
            assertEquals(shown, restored.phase(LoadState.Loaded(placement(attempt = null, next = null, status = "done", result = RESULT))))
            assertEquals(PlacementTestPhase.Loading, restored.phase(LoadState.Loading))
            // Another device started a new test while the process was gone.
            val newer = placement(OPEN.replace(ATTEMPT.toString(), "9a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d"))
            assertTrue(restored.phase(LoadState.Loaded(newer)) is PlacementTestPhase.Question)
        }

    private companion object {
        val ATTEMPT: UUID = UUID.fromString("0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d")
        val CHANGE: UUID = UUID.fromString("5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b")

        fun attemptOf(answered: Int = 0) =
            """{"id":"$ATTEMPT","length":"quick","part":1,"partComplete":false,"estimatedMinutes":4,"answered":$answered,
            |"chapter":"Loops","questions":8}
            """.trimMargin()

        val OPEN = attemptOf()
        val OPEN_FOURTH = attemptOf(answered = 3)

        const val RESULT =
            """{"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","finishedAt":"2026-11-27T14:00:00Z","lessonsSkipped":4,
            "changeId":"5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b","chapter":"Why prices move",
            "course":{"lessons":9,"chapters":[{"lessons":2,"skipped":2,"start":false},{"lessons":3,"skipped":2,"start":true},
            {"lessons":4,"skipped":0,"start":false}]},
            "nextLesson":{"id":"1a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","title":"News, results and expectations","estimatedMinutes":5,
            "chapter":"Why prices move"}}"""

        fun placement(
            attempt: String?,
            next: String? = orderQuestion(),
            status: String = "asking",
            result: String? = null,
        ): Placement =
            ApiJson.decodeFromString(
                Placement.serializer(),
                """
                {"answered":0,"areas":[],"complete":false,"dayBudgetSpent":0.2,"dayBudgetUsed":false,"knownSkillIds":[],"needsItems":[],
                 "next":${next ?: "null"},"phases":[],"started":true,"status":"$status","trueFalseLabels":"trueFalse","focusTest":null,
                 "attempt":${attempt ?: "null"},"result":${result ?: "null"}}
                """.trimIndent(),
            )

        fun completion(
            skipped: Int,
            result: String?,
        ): PlacementCompletion =
            ApiJson.decodeFromString(
                PlacementCompletion.serializer(),
                """
                {"areas":[],"complete":true,"knownSkillIds":[],"phases":[],"testedOutPlanItemIds":[],"focusTest":null,
                 "attempt":null,"lessonsSkipped":$skipped,"changeId":"$CHANGE","result":${result ?: "null"}}
                """.trimIndent(),
            )
    }
}
