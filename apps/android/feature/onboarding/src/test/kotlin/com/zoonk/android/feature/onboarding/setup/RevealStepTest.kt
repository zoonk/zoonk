package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModelStore
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.revealTodayOf
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.DayView
import com.zoonk.android.feature.session.toDayView
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
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

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class RevealStepTest {
    private val here = AppRoute.GoalSetup(GOAL_ID)
    private val lesson = AppRoute.Lesson(UUID.randomUUID().toString())

    private fun check(
        mark: suspend () -> Unit = {},
        prepareToday: suspend () -> Unit = {},
        open: suspend (DayView, DayStep, UUID) -> MutationResult<AppRoute?> = { _, _, _ -> MutationResult.Done(lesson) },
        body: suspend TestScope.(GoalSetupViewModel, DayView) -> Unit,
    ) = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val models = ViewModelStore()
        try {
            val api =
                object : OnboardingApi by FakeOnboardingApi() {
                    override suspend fun markPlanRevealed(
                        session: AuthenticatedSession,
                        goalId: String,
                    ) = mark()
                }
            val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
            val store = OnboardingStore(api, AppCache(session, backgroundScope), session) { SignInResult.SignedIn }
            val vm = GoalSetupViewModel(store, null, SavedStateHandle(), GOAL_ID, doors = RevealDoors(prepareToday, open))
            models.put("reveal", vm)
            body(vm, revealTodayOf().today.toDayView())
        } finally {
            models.clear()
            Dispatchers.resetMain()
        }
    }

    private fun navigator() =
        AppNavigator(
            stacks = AppTab.entries.associateWith { NavBackStack<NavKey>(it.root) },
            selected = mutableStateOf(AppTab.Today),
            tasks = NavBackStack(),
            openWebPage = {},
        ).also { it.open(here) }

    /** What the setup's screen does on its next frame (`ActOn`): leads where the reveal owes, then says so. */
    private fun GoalSetupViewModel.act(navigator: AppNavigator) =
        revealed.value?.let {
            leadToRevealed(navigator, it)
            revealed.acted(it)
        }

    @Test
    fun aStepOpenedFromAVisitThatEndedOpensNothingOnReturn() {
        val marked = CompletableDeferred<Unit>()
        var opens = 0
        check(mark = { marked.await() }, open = { _, _, _ -> MutationResult.Done(lesson).also { opens++ } }) { vm, day ->
            val navigator = navigator()

            vm.openRevealStep(day, day.steps.first())
            runCurrent()
            navigator.select(AppTab.Plan)
            vm.visit.end()
            navigator.select(AppTab.Today)
            marked.complete(Unit)
            runCurrent()
            vm.act(navigator)

            assertEquals(here, navigator.currentRoute)
            assertEquals("no step of an ended visit is started", 0, opens)
        }
    }

    @Test
    fun aStepOpenedWhileTheSetupIsRecreatedLeadsThereOnce() {
        val marked = CompletableDeferred<Unit>()
        check(mark = { marked.await() }) { vm, day ->
            val navigator = navigator()

            // A recreation: no frame acts while it marks and opens; the next one does.
            vm.openRevealStep(day, day.steps.first())
            marked.complete(Unit)
            runCurrent()
            vm.act(navigator)

            assertEquals(lesson, navigator.currentRoute)
            assertNull(vm.revealed.value)
            navigator.back()
            assertEquals(AppRoute.Today, navigator.currentRoute)
        }
    }

    @Test
    fun startFromAVisitThatEndedLeadsNowhereOnReturn() {
        val marked = CompletableDeferred<Unit>()
        check(mark = { marked.await() }) { vm, _ ->
            val navigator = navigator()

            vm.reveal()
            runCurrent()
            vm.visit.end()
            marked.complete(Unit)
            runCurrent()
            vm.act(navigator)

            assertEquals(here, navigator.currentRoute)
        }
    }

    @Test
    fun startWhileTheSetupIsRecreatedLeadsToTodayOnce() {
        val prepared = CompletableDeferred<Unit>()
        check(prepareToday = { prepared.await() }) { vm, _ ->
            val navigator = navigator()

            // A recreation: no frame acts while it marks and reads Today; the next one does.
            vm.reveal()
            prepared.complete(Unit)
            runCurrent()
            vm.act(navigator)

            assertEquals(AppRoute.Today, navigator.currentRoute)
            assertNull(vm.revealed.value)
        }
    }

    @Test
    fun markingFinishesBeforeOpeningAndRepeatedTapsDoNoWork() {
        val marked = CompletableDeferred<Unit>()
        var marks = 0
        var opens = 0
        check(
            mark = {
                marks++
                marked.await()
            },
            open = { _, _, goal ->
                assertEquals(UUID.fromString(GOAL_ID), goal)
                opens++
                MutationResult.Done(AppRoute.Today)
            },
        ) { vm, day ->
            val step = day.steps.first()
            vm.openRevealStep(day, step)
            vm.openRevealStep(day, step)
            runCurrent()
            assertEquals(1, marks)
            assertEquals(0, opens)
            assertEquals(step.position, vm.openingStep)
            marked.complete(Unit)
            runCurrent()
            assertEquals(1, opens)
            assertEquals(Revealed(AppRoute.Today), vm.revealed.value)
            assertFalse(vm.isSaving)
            assertEquals(null, vm.openingStep)
        }
    }

    @Test
    fun markAndOpenFailuresStayOnTheRowAndCanBeRetried() {
        var markFails = true
        var opens = 0
        var openFails = true
        check(
            mark = { if (markFails) throw ApiException(ApiError.Network) },
            open = { _, _, _ ->
                opens++
                if (openFails) MutationResult.Failed(ApiError.Network) else MutationResult.Done(AppRoute.Today)
            },
        ) { vm, day ->
            val step = day.steps.first()

            vm.openRevealStep(day, step)
            runCurrent()
            assertEquals(0, opens)
            assertEquals(step.position, vm.failedStep)
            assertFalse(vm.saveFailed)
            assertNull(vm.revealed.value)
            markFails = false
            vm.openRevealStep(day, step)
            runCurrent()
            assertEquals(1, opens)
            assertEquals(step.position, vm.failedStep)
            assertNull(vm.revealed.value)
            openFails = false
            vm.openRevealStep(day, step)
            runCurrent()
            assertEquals(Revealed(AppRoute.Today), vm.revealed.value)
            assertEquals(null, vm.failedStep)
        }
    }

    @Test
    fun aRefreshOnlyOpenLeadsNowhereAndStopsBeingBusy() {
        check(open = { _, _, _ -> MutationResult.Done(null) }) { vm, day ->
            vm.openRevealStep(day, day.steps.first())
            runCurrent()

            assertNull(vm.revealed.value)
            assertFalse(vm.isSaving)
            assertEquals(null, vm.openingStep)
            assertEquals(null, vm.failedStep)
        }
    }

    @Test
    fun aStepWaitsForTodayBeforeLeadingThereAndKeepsALaterBack() {
        val prepared = CompletableDeferred<Unit>()
        check(prepareToday = { prepared.await() }) { vm, day ->
            val navigator = navigator()
            val step = day.steps.first()

            vm.openRevealStep(day, step)
            runCurrent()
            vm.act(navigator)
            assertEquals(here, navigator.currentRoute)
            assertTrue(vm.isSaving)
            assertEquals(step.position, vm.openingStep)
            prepared.complete(Unit)
            runCurrent()
            vm.act(navigator)

            assertEquals(lesson, navigator.currentRoute)
            assertFalse(vm.isSaving)
            navigator.back()
            assertEquals(AppRoute.Today, navigator.currentRoute)
        }
    }
}
