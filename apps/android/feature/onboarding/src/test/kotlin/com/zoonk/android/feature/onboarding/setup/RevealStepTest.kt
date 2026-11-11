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
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class RevealStepTest {
    private fun check(
        mark: suspend () -> Unit = {},
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
            val vm = GoalSetupViewModel(store, null, SavedStateHandle(), GOAL_ID)
            models.put("reveal", vm)
            body(vm, revealTodayOf().today.toDayView())
        } finally {
            models.clear()
            Dispatchers.resetMain()
        }
    }

    @Test
    fun markingFinishesBeforeOpeningAndRepeatedTapsDoNoWork() {
        val marked = CompletableDeferred<Unit>()
        var marks = 0
        check(mark = {
            marks++
            marked.await()
        }) { vm, day ->
            val step = day.steps.first()
            var opens = 0
            var destination: AppRoute? = null
            val open: suspend (DayView, DayStep, UUID) -> MutationResult<AppRoute?> = { _, _, goal ->
                assertEquals(UUID.fromString(GOAL_ID), goal)
                opens++
                MutationResult.Done(AppRoute.Today)
            }
            vm.openRevealStep(day, step, open) { destination = it }
            vm.openRevealStep(day, step, open) { destination = it }
            runCurrent()
            assertEquals(1, marks)
            assertEquals(0, opens)
            assertEquals(step.position, vm.openingStep)
            marked.complete(Unit)
            runCurrent()
            assertEquals(1, opens)
            assertEquals(AppRoute.Today, destination)
            assertFalse(vm.isSaving)
            assertEquals(null, vm.openingStep)
        }
    }

    @Test
    fun markAndOpenFailuresStayOnTheRowAndCanBeRetried() {
        var markFails = true
        check(mark = { if (markFails) throw ApiException(ApiError.Network) }) { vm, day ->
            val step = day.steps.first()
            var opens = 0
            var openFails = true
            val open: suspend (DayView, DayStep, UUID) -> MutationResult<AppRoute?> = { _, _, _ ->
                opens++
                if (openFails) MutationResult.Failed(ApiError.Network) else MutationResult.Done(AppRoute.Today)
            }
            var navigated = false

            fun tap() = vm.openRevealStep(day, step, open) { navigated = true }
            tap()
            runCurrent()
            assertEquals(0, opens)
            assertEquals(step.position, vm.failedStep)
            assertFalse(vm.saveFailed)
            assertFalse(navigated)
            markFails = false
            tap()
            runCurrent()
            assertEquals(1, opens)
            assertEquals(step.position, vm.failedStep)
            assertFalse(navigated)
            openFails = false
            tap()
            runCurrent()
            assertTrue(navigated)
            assertEquals(null, vm.failedStep)
        }
    }

    @Test
    fun leavingDuringTheMarkDoesNotOpenAndARefreshOnlyOpenStopsBeingBusy() {
        val marked = CompletableDeferred<Unit>()
        check(mark = { marked.await() }) { vm, day ->
            val step = day.steps.first()
            var current = true
            var opens = 0
            val open: suspend (DayView, DayStep, UUID) -> MutationResult<AppRoute?> = { _, _, _ ->
                opens++
                MutationResult.Done(null)
            }
            vm.openRevealStep(day, step, open, isCurrent = { current }) { error("Must not navigate") }
            runCurrent()
            current = false
            marked.complete(Unit)
            runCurrent()
            assertEquals(0, opens)
            assertFalse(vm.isSaving)
            assertEquals(null, vm.openingStep)
            current = true
            vm.openRevealStep(day, step, open) { error("Must not navigate") }
            runCurrent()
            assertEquals(1, opens)
            assertFalse(vm.isSaving)
            assertEquals(null, vm.openingStep)
            assertEquals(null, vm.failedStep)
        }
    }

    @Test
    fun rowWaitsForTodayBeforeNavigatingAndKeepsALaterBackNavigation() {
        check { vm, day ->
            val navigator =
                AppNavigator(
                    stacks = AppTab.entries.associateWith { NavBackStack<NavKey>(it.root) },
                    selected = mutableStateOf(AppTab.Today),
                    tasks = NavBackStack(),
                    openWebPage = {},
                )
            val here = AppRoute.GoalSetup(GOAL_ID)
            val lesson = AppRoute.Lesson(UUID.randomUUID().toString())
            val step = day.steps.first()
            for (leave in listOf(false, true)) {
                val prepared = CompletableDeferred<Unit>()
                navigator.open(here)
                vm.openRevealStep(day, step, { _, _, _ -> MutationResult.Done(lesson) }) { destination ->
                    openRevealedPlan(navigator, here, { prepared.await() }, destination)
                }
                runCurrent()
                assertEquals(here, navigator.currentRoute)
                assertTrue(vm.isSaving)
                assertEquals(step.position, vm.openingStep)
                if (leave) navigator.back()
                prepared.complete(Unit)
                runCurrent()
                assertEquals(if (leave) AppRoute.Today else lesson, navigator.currentRoute)
                assertFalse(vm.isSaving)
                if (!leave) {
                    navigator.back()
                    assertEquals(AppRoute.Today, navigator.currentRoute)
                }
            }
        }
    }
}
