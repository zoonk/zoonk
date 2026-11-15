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
import com.zoonk.android.feature.onboarding.focusSittingOf
import com.zoonk.android.feature.onboarding.focusTestOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementAnswer
import com.zoonk.api.models.PlacementAnswerAnyOf
import com.zoonk.api.models.PlacementAnswerInput
import com.zoonk.api.models.PlacementAnswerResult
import com.zoonk.api.models.PlacementCompletion
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Leaving the test, and a save that fails, belong to the visit that asked: a recreation lands the
 * request while no frame acts, and the next frame acts on it once; leaving ends the visit before it
 * lands, and nothing is owed on return. The host's save still runs: the learner finished the test.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class FocusTestOutcomesTest {
    private val gate = CompletableDeferred<Unit>()
    private var saves = 0

    /** Starting, answering and closing wait for [gate], then fail when [fails]; the host's save waits for [hostGate]. */
    private fun check(
        fails: Boolean = false,
        hostGate: CompletableDeferred<Unit>? = null,
        body: suspend TestScope.(FocusTestViewModel) -> Unit,
    ) = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val models = ViewModelStore()
        try {
            val fake = FakeOnboardingApi()
            val api =
                object : OnboardingApi by fake {
                    override suspend fun startPlacementSitting(
                        session: AuthenticatedSession,
                        goalId: String,
                    ): Placement {
                        gate.await()
                        if (fails) throw ApiException(ApiError.Network)
                        return fake.startPlacementSitting(session, goalId)
                    }

                    override suspend fun answerPlacement(
                        session: AuthenticatedSession,
                        goalId: String,
                        input: PlacementAnswerInput,
                    ): PlacementAnswerResult {
                        gate.await()
                        if (fails) throw ApiException(ApiError.Network)
                        return fake.answerPlacement(session, goalId, input)
                    }

                    override suspend fun finishPlacement(
                        session: AuthenticatedSession,
                        goalId: String,
                        fromScratch: Boolean,
                    ): PlacementCompletion {
                        gate.await()
                        if (fails) throw ApiException(ApiError.Network)
                        return fake.finishPlacement(session, goalId, fromScratch)
                    }
                }
            val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
            val cache = AppCache(session, backgroundScope)
            val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
            val vm =
                FocusTestViewModel(GOAL_ID, store, PlanStore(FakePlanApi(), cache), null, SavedStateHandle()) {
                    hostGate?.await()
                    saves++
                    WriteOutcome.Done(Unit)
                }
            models.put("focus-test", vm)
            body(vm)
        } finally {
            models.clear()
            Dispatchers.resetMain()
        }
    }

    /** The host's next frame (`ActOn`): goes on once for each leaving owed, then says so. */
    private fun FocusTestViewModel.goOn(): Int {
        var times = 0
        repeat(2) {
            left.value?.let {
                times++
                left.acted(it)
            }
        }
        return times
    }

    /** A question of an open sitting, as the screen shows it once the learner is in it. */
    private fun FocusTestViewModel.question(): FocusTestPhase.Question {
        resume()
        return phase(
            LoadState.Loaded(placementOf(focusTest = focusTestOf(sitting = focusSittingOf(questions = 2)))),
        ) as FocusTestPhase.Question
    }

    private val typed = PlacementAnswer.PlacementAnswerAnyOfValue(PlacementAnswerAnyOf("hearsay"))

    /** Starts [request], ends the visit while it's out, then lets it land. */
    private fun TestScope.leaveWhile(
        vm: FocusTestViewModel,
        landing: CompletableDeferred<Unit> = gate,
        request: () -> Unit,
    ) {
        request()
        runCurrent()
        vm.visit.end()
        landing.complete(Unit)
        runCurrent()
    }

    /** Starts [request] and lets it land while no frame acts, as during a recreation. */
    private fun TestScope.recreateWhile(
        landing: CompletableDeferred<Unit> = gate,
        request: () -> Unit,
    ) {
        request()
        landing.complete(Unit)
        runCurrent()
    }

    @Test
    fun aResultSeenAfterThePlanTestWasLeftGoesNowhereOnReturn() =
        check { vm ->
            leaveWhile(vm) { vm.finish() }

            assertNull(vm.left.value)
            assertEquals("the host still saves the test it finished", 1, saves)
        }

    @Test
    fun aResultSeenWhileTheTestIsRecreatedGoesOnOnce() =
        check { vm ->
            recreateWhile { vm.finish() }

            assertEquals(1, vm.goOn())
        }

    @Test
    fun aSkipThatSavesAfterTheTestWasLeftOpensNothing() {
        val host = CompletableDeferred<Unit>()
        check(hostGate = host) { vm ->
            leaveWhile(vm, landing = host) { vm.leave(closes = false) }

            assertNull(vm.left.value)
        }
    }

    @Test
    fun aSkipThatClosesWhileTheTestIsRecreatedGoesOnOnce() =
        check { vm ->
            recreateWhile { vm.leave(closes = true) }

            assertEquals(1, vm.goOn())
        }

    @Test
    fun aDoneThatSavesAfterTheTestWasLeftGoesNowhereOnReturn() {
        val host = CompletableDeferred<Unit>()
        check(hostGate = host) { vm ->
            leaveWhile(vm, landing = host) { vm.done() }

            assertNull(vm.left.value)
        }
    }

    @Test
    fun aDoneThatSavesWhileTheTestIsRecreatedGoesOnOnce() {
        val host = CompletableDeferred<Unit>()
        check(hostGate = host) { vm ->
            recreateWhile(landing = host) { vm.done() }

            assertEquals(1, vm.goOn())
        }
    }

    @Test
    fun aStartThatFailsAfterTheTestWasLeftSaysNothingOnReturn() =
        check(fails = true) { vm ->
            leaveWhile(vm) { vm.start() }

            assertFalse(vm.failed)
        }

    @Test
    fun aStartThatFailsWhileTheTestIsRecreatedSaysSo() =
        check(fails = true) { vm ->
            recreateWhile { vm.start() }

            assertTrue(vm.failed)
        }

    @Test
    fun anAnswerThatFailsAfterTheTestWasLeftSaysNothingOnReturn() =
        check(fails = true) { vm ->
            val question = vm.question()
            leaveWhile(vm) { vm.answer(question, typed, durationMs = 1_000) }

            assertEquals(0, vm.saveFailures)
        }

    @Test
    fun anAnswerThatFailsWhileTheTestIsRecreatedSaysSoOnItsQuestion() =
        check(fails = true) { vm ->
            val question = vm.question()
            recreateWhile { vm.answer(question, typed, durationMs = 1_000) }

            assertEquals(1, vm.saveFailures)
        }

    @Test
    fun aStopThatFailsAfterTheTestWasLeftSaysNothingOnReturn() =
        check(fails = true) { vm ->
            leaveWhile(vm) { vm.stop() }

            assertEquals(0, vm.saveFailures)
        }

    @Test
    fun aStopThatFailsWhileTheTestIsRecreatedSaysSoOnItsQuestion() =
        check(fails = true) { vm ->
            recreateWhile { vm.stop() }

            assertEquals(1, vm.saveFailures)
        }
}
