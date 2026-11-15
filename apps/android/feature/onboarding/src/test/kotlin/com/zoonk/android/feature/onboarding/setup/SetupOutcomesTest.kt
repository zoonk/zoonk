package com.zoonk.android.feature.onboarding.setup

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.VisitOutcome
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.completionOf
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanOp
import com.zoonk.android.feature.plan.PlanStore
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
 * What the setup's requests lead to belongs to the visit that asked: a recreation lands the request
 * while no frame acts, and the next frame acts on it once; leaving ends the visit before it lands,
 * and nothing is owed on return.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class SetupOutcomesTest {
    private val gate = CompletableDeferred<Unit>()
    private val models = ViewModelStore()

    /** Archiving and finishing a test wait for [gate]; a finish that [fails] fails once it opens. */
    private fun check(
        fails: Boolean = false,
        body: suspend TestScope.(OnboardingStore, AppCache) -> Unit,
    ) = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        try {
            val api =
                object : OnboardingApi by FakeOnboardingApi() {
                    override suspend fun archive(
                        session: AuthenticatedSession,
                        goalId: String,
                    ) = gate.await()

                    override suspend fun finishLevelTest(
                        session: AuthenticatedSession,
                        goalId: String,
                    ) {
                        gate.await()
                        if (fails) throw ApiException(ApiError.Network)
                    }

                    override suspend fun finishPlacement(
                        session: AuthenticatedSession,
                        goalId: String,
                        fromScratch: Boolean,
                    ): PlacementCompletion {
                        gate.await()
                        if (fails) throw ApiException(ApiError.Network)
                        return completionOf()
                    }
                }
            val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
            val cache = AppCache(session, backgroundScope)
            body(OnboardingStore(api, cache, session) { SignInResult.SignedIn }, cache)
        } finally {
            models.clear()
            Dispatchers.resetMain()
        }
    }

    private fun <T : ViewModel> T.kept() = also { models.put("$it", it) }

    /** What the screen's next frame does (`ActOn`): acts on what's owed, then says so. */
    private fun <T : Any> VisitOutcome<T>.act(onIt: (T) -> Unit) =
        value?.let {
            onIt(it)
            acted(it)
        }

    private fun setup(store: OnboardingStore) = GoalSetupViewModel(store, null, SavedStateHandle(), GOAL_ID).kept()

    private fun aimPlans(cache: AppCache) = PlanStore(FakePlanApi().apply { gates[PlanOp.Aim("B1")] = gate }, cache)

    @Test
    fun anAimSavedAfterTheSetupWasLeftClosesNothingOnReturn() =
        check { store, cache ->
            val vm = setup(store)
            vm.changeAim(aimPlans(cache), "B1")
            runCurrent()
            vm.visit.end()
            gate.complete(Unit)
            runCurrent()

            assertNull(vm.aimSaved.value)
        }

    @Test
    fun anAimFromAnEarlierSheetOpeningClosesNothingInTheNext() =
        check { store, cache ->
            val vm = setup(store)
            vm.changeAim(aimPlans(cache), "B1")
            runCurrent()
            // The learner closed the sheet while it saved, then opened it again.
            vm.aimSheet.end()
            gate.complete(Unit)
            runCurrent()

            assertNull(vm.aimSaved.value)
        }

    @Test
    fun anAimSavedWhileTheSetupIsRecreatedClosesItsSheetOnce() =
        check { store, cache ->
            val vm = setup(store)
            var closes = 0
            vm.changeAim(aimPlans(cache), "B1")
            gate.complete(Unit)
            runCurrent()
            repeat(2) { vm.aimSaved.act { closes++ } }

            assertEquals(1, closes)
        }

    @Test
    fun aStartOverThatLandsAfterTheSetupWasLeftOpensNothingOnReturn() =
        check { store, _ ->
            val vm = setup(store)
            vm.startOver(listOf(GOAL_ID))
            runCurrent()
            vm.visit.end()
            gate.complete(Unit)
            runCurrent()

            assertNull(vm.startedOver.value)
        }

    @Test
    fun aStartOverThatLandsWhileTheSetupIsRecreatedOpensTheStartOnce() =
        check { store, _ ->
            val vm = setup(store)
            var opens = 0
            vm.startOver(listOf(GOAL_ID))
            gate.complete(Unit)
            runCurrent()
            repeat(2) { vm.startedOver.act { opens++ } }

            assertEquals(1, opens)
        }

    @Test
    fun aLevelTestFinishThatFailsAfterTheSetupWasLeftSaysNothingOnReturn() =
        check(fails = true) { store, _ ->
            val vm = LevelTestViewModel(GOAL_ID, store, SavedStateHandle()) { WriteOutcome.Done(Unit) }.kept()
            vm.finish()
            runCurrent()
            vm.visit.end()
            gate.complete(Unit)
            runCurrent()

            assertFalse(vm.finishFailed)
        }

    @Test
    fun aLevelTestFinishThatFailsWhileTheSetupIsRecreatedSaysSo() =
        check(fails = true) { store, _ ->
            val vm = LevelTestViewModel(GOAL_ID, store, SavedStateHandle()) { WriteOutcome.Done(Unit) }.kept()
            vm.finish()
            gate.complete(Unit)
            runCurrent()

            assertTrue(vm.finishFailed)
        }

    @Test
    fun aLevelTestFinishSavesTheSetupsStepItWasGiven() =
        check { store, _ ->
            var saved = 0
            val vm =
                LevelTestViewModel(GOAL_ID, store, SavedStateHandle()) {
                    saved++
                    WriteOutcome.Done(Unit)
                }.kept()
            vm.finish()
            gate.complete(Unit)
            runCurrent()

            assertEquals(1, saved)
            assertFalse(vm.finishFailed)
        }

    @Test
    fun aPlacementFinishThatFailsAfterTheSetupWasLeftSaysNothingOnReturn() =
        check(fails = true) { store, _ ->
            val vm = PlacementViewModel(GOAL_ID, store, null, SavedStateHandle()) { WriteOutcome.Done(Unit) }.kept()
            vm.finish(fromScratch = false)
            runCurrent()
            vm.visit.end()
            gate.complete(Unit)
            runCurrent()

            assertFalse(vm.finishFailed)
        }

    @Test
    fun aPlacementStopThatFailsWhileTheSetupIsRecreatedSaysSoOnItsQuestion() =
        check(fails = true) { store, _ ->
            val vm = PlacementViewModel(GOAL_ID, store, null, SavedStateHandle()) { WriteOutcome.Done(Unit) }.kept()
            vm.finish(fromScratch = false, fromQuestion = true)
            gate.complete(Unit)
            runCurrent()

            assertEquals(1, vm.saveFailures)
        }

    @Test
    fun aPlacementFinishSavesTheSetupsStepItWasGiven() =
        check { store, _ ->
            var saved = 0
            val vm =
                PlacementViewModel(GOAL_ID, store, null, SavedStateHandle()) {
                    saved++
                    WriteOutcome.Done(Unit)
                }.kept()
            vm.finish(fromScratch = true)
            gate.complete(Unit)
            runCurrent()

            assertEquals(1, saved)
            assertFalse(vm.finishFailed)
        }
}
