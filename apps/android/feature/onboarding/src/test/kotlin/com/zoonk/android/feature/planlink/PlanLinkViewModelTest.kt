package com.zoonk.android.feature.planlink

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModelStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.api.models.Goal
import com.zoonk.api.models.PlanLinkStartInput
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
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A goal started from a shared plan opens the Plan, or says it failed, only on the visit that tapped
 * Start: a recreation lands it while no frame acts, and the next frame acts once; leaving ends the
 * visit before it lands, and nothing is owed on return.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class PlanLinkViewModelTest {
    private val gate = CompletableDeferred<Unit>()

    /** The start waits for [gate]; [fails] makes it a busy moment. */
    private fun check(
        fails: Boolean = false,
        body: suspend TestScope.(PlanLinkViewModel) -> Unit,
    ) = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val models = ViewModelStore()
        try {
            val fake = FakeOnboardingApi().apply { if (fails) refusal = ApiException(ApiError.Network) }
            val api =
                object : OnboardingApi by fake {
                    override suspend fun createFromPlanLink(
                        session: AuthenticatedSession,
                        planId: String,
                        input: PlanLinkStartInput,
                    ): Goal {
                        gate.await()
                        return fake.createFromPlanLink(session, planId, input)
                    }
                }
            val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
            val store = OnboardingStore(api, AppCache(session, backgroundScope), session) { SignInResult.SignedIn }
            body(PlanLinkViewModel(store, SavedStateHandle()).also { models.put("plan-link", it) })
        } finally {
            models.clear()
            Dispatchers.resetMain()
        }
    }

    private fun TestScope.leaveWhileStarting(vm: PlanLinkViewModel) {
        vm.start(PLAN_ID)
        runCurrent()
        vm.visit.end()
        gate.complete(Unit)
        runCurrent()
    }

    private fun TestScope.recreateWhileStarting(vm: PlanLinkViewModel) {
        vm.start(PLAN_ID)
        gate.complete(Unit)
        runCurrent()
    }

    @Test
    fun aPlanStartedAfterTheLinkWasLeftOpensNothingOnReturn() =
        check { vm ->
            leaveWhileStarting(vm)

            assertNull(vm.started.value)
        }

    @Test
    fun aPlanStartedWhileTheLinkIsRecreatedOpensThePlanOnce() =
        check { vm ->
            recreateWhileStarting(vm)
            var opens = 0
            repeat(2) {
                vm.started.value?.let {
                    opens++
                    vm.started.acted(it)
                }
            }

            assertEquals(1, opens)
        }

    @Test
    fun aStartThatFailsAfterTheLinkWasLeftSaysNothingOnReturn() =
        check(fails = true) { vm ->
            leaveWhileStarting(vm)

            assertNull(vm.failure)
        }

    @Test
    fun aStartThatFailsWhileTheLinkIsRecreatedSaysSo() =
        check(fails = true) { vm ->
            recreateWhileStarting(vm)

            assertEquals(StartFailure.Failed, vm.failure)
        }
}

private const val PLAN_ID = "plan-1"
