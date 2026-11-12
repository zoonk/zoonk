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
import com.zoonk.android.feature.onboarding.focusTestOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.api.models.Placement
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
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Today's "Start the test" starts the sitting as the test opens; the app can be killed while it does. */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class FocusTestViewModelTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val models = ViewModelStore()

    @After
    fun tearDown() {
        models.clear()
        Dispatchers.resetMain()
    }

    private fun TestScope.viewModel(
        api: OnboardingApi,
        handle: SavedStateHandle,
    ): FocusTestViewModel {
        val session = FakeSession(ana)
        val cache = AppCache(session, backgroundScope)
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        return FocusTestViewModel(GOAL_ID, store, PlanStore(FakePlanApi(), cache), null, handle).also { models.put("$it", it) }
    }

    /** What the screen does after the app comes back from process death with what [handle] saved. */
    private fun TestScope.restored(
        api: OnboardingApi,
        handle: SavedStateHandle,
    ): FocusTestViewModel {
        val saved = handle.savedStateProvider().saveState()
        models.clear()
        return viewModel(api, SavedStateHandle.createHandle(saved, null)).also {
            it.start { WriteOutcome.Done(Unit) }
            runCurrent()
        }
    }

    @Test
    fun aStartCutOffByTheAppClosingStartsAgainWhenTheTestComesBack() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val fake = FakeOnboardingApi().apply { placement = placementOf(next = null, focusTest = focusTestOf()) }
            val answer = CompletableDeferred<Placement>()
            var starts = 0
            val api =
                object : OnboardingApi by fake {
                    override suspend fun startPlacementSitting(
                        session: AuthenticatedSession,
                        goalId: String,
                    ): Placement {
                        starts++
                        return answer.await()
                    }
                }
            val handle = SavedStateHandle()
            viewModel(api, handle).start { WriteOutcome.Done(Unit) }
            runCurrent()

            val back = restored(api, handle)

            assertTrue(back.phase(LoadState.Loaded(fake.placement)) is FocusTestPhase.Offer)
            assertEquals(2, starts)
            assertTrue(back.busy)
        }

    @Test
    fun aStartThatFailedBeforeTheAppClosedStartsAgainWhenTheTestComesBack() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val api =
                FakeOnboardingApi().apply {
                    placement = placementOf(next = null, focusTest = focusTestOf())
                    writeFailure = ApiException(ApiError.Network)
                }
            val handle = SavedStateHandle()
            val first = viewModel(api, handle)
            first.start { WriteOutcome.Done(Unit) }
            runCurrent()
            assertTrue(first.failed)
            api.writeFailure = null

            restored(api, handle)

            assertEquals(2, api.sittingsStarted)
        }
}
