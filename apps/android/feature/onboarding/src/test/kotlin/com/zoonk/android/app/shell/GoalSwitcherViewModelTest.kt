package com.zoonk.android.app.shell

import androidx.lifecycle.ViewModelStore
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.VisitOutcome
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearnerSummaryWaitingGoal
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
import java.util.UUID

/**
 * A waiting goal started from the switcher opens its setup, or the Make room sheet says it failed,
 * only on the visit that asked: a recreation lands it while no frame acts, and the next frame acts
 * once; leaving the tab ends the visit before it lands, and nothing is owed on return.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class GoalSwitcherViewModelTest {
    private val gate = CompletableDeferred<Unit>()
    private val paused = UUID.randomUUID()

    /** Starting a goal waits for [gate]; [fails] makes it a busy moment. */
    private fun check(
        fails: Boolean = false,
        body: suspend TestScope.(GoalSwitcherViewModel) -> Unit,
    ) = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val models = ViewModelStore()
        try {
            val api =
                FakeOnboardingApi().apply {
                    createGate = gate
                    if (fails) refusal = ApiException(ApiError.Network)
                }
            val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
            val store = OnboardingStore(api, AppCache(session, backgroundScope), session) { SignInResult.SignedIn }
            val app = AppContainer.preview(ApplicationProvider.getApplicationContext())
            body(GoalSwitcherViewModel(app, store).also { models.put("switcher", it) })
        } finally {
            models.clear()
            Dispatchers.resetMain()
        }
    }

    /** What the next frame does (`ActOn`): opens what's owed, then says so, as often as it's owed. */
    private fun VisitOutcome<String>.actTwice(): List<String> {
        val opened = mutableListOf<String>()
        repeat(2) {
            value?.let {
                opened += it
                acted(it)
            }
        }
        return opened
    }

    private fun TestScope.leaveWhile(
        vm: GoalSwitcherViewModel,
        request: () -> Unit,
    ) {
        request()
        runCurrent()
        vm.visit.end()
        gate.complete(Unit)
        runCurrent()
    }

    private fun TestScope.recreateWhile(request: () -> Unit) {
        request()
        gate.complete(Unit)
        runCurrent()
    }

    @Test
    fun aWaitingGoalStartedAfterTheTabWasLeftOpensNothingOnReturn() =
        check { vm ->
            leaveWhile(vm) { vm.start(WAITING) }

            assertNull(vm.started.value)
        }

    @Test
    fun aWaitingGoalStartedWhileTheTabIsRecreatedOpensItsSetupOnce() =
        check { vm ->
            recreateWhile { vm.start(WAITING) }

            assertEquals(listOf(GOAL_ID), vm.started.actTwice())
        }

    @Test
    fun aGoalStartedFromMakeRoomWhileTheTabIsRecreatedClosesTheSheetAndOpensItsSetupOnce() =
        check { vm ->
            recreateWhile { vm.start(WAITING, pauseGoalId = paused) }

            assertEquals(listOf(GOAL_ID), vm.startedFromSheet.actTwice())
            assertNull(vm.started.value)
        }

    @Test
    fun aWaitingGoalThatFailsToStartAfterTheTabWasLeftSaysNothingAnywhere() =
        check(fails = true) { vm ->
            leaveWhile(vm) { vm.start(WAITING) }

            assertNull(vm.failed.value)
        }

    @Test
    fun aWaitingGoalThatFailsToStartWhileTheTabIsRecreatedSaysSoOnce() =
        check(fails = true) { vm ->
            recreateWhile { vm.start(WAITING) }

            assertEquals(SwitcherFailure.Start, vm.failed.value)
            vm.failed.value?.let(vm.failed::acted)
            assertNull(vm.failed.value)
        }

    @Test
    fun aMakeRoomThatFailsAfterTheTabWasLeftSaysNothingOnReturn() =
        check(fails = true) { vm ->
            leaveWhile(vm) { vm.start(WAITING, pauseGoalId = paused) }

            assertFalse(vm.makeRoomFailed)
        }

    @Test
    fun aMakeRoomFromAnEarlierSheetOpeningSaysNothingInTheNext() =
        check(fails = true) { vm ->
            vm.start(WAITING, pauseGoalId = paused)
            runCurrent()
            // The learner closed the sheet while it saved, then opened it again.
            vm.makeRoomSheet.end()
            gate.complete(Unit)
            runCurrent()

            assertFalse(vm.makeRoomFailed)
        }

    @Test
    fun aGoalStartedFromAnEarlierMakeRoomSheetOpensNothingAnywhere() =
        check { vm ->
            vm.start(WAITING, pauseGoalId = paused)
            runCurrent()
            // The learner closed the sheet while it saved.
            vm.makeRoomSheet.end()
            gate.complete(Unit)
            runCurrent()

            assertNull(vm.startedFromSheet.value)
            assertNull(vm.started.value)
        }

    @Test
    fun aMakeRoomThatFailsWhileTheTabIsRecreatedSaysSo() =
        check(fails = true) { vm ->
            recreateWhile { vm.start(WAITING, pauseGoalId = paused) }

            assertTrue(vm.makeRoomFailed)
        }
}

private val WAITING: LearnerSummaryWaitingGoal =
    ApiJson.decodeFromString(
        """
        {"displayName":"Bar exam","id":"waiting-1","languageFlag":null,"locked":false,
         "input":{"dailyMinutes":15,"goals":[{"kind":"exam","language":"en","prompt":"pass the bar exam","title":"Bar exam"}]}}
        """.trimIndent(),
    )
