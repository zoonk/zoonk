package com.zoonk.android.feature.placementtest

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
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.levelTestOf
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
class LevelTestPlanViewModelTest {
    private val models = ViewModelStore()

    @After
    fun tearDown() {
        models.clear()
        Dispatchers.resetMain()
    }

    private fun TestScope.viewModel(
        api: FakeOnboardingApi,
        handle: SavedStateHandle,
    ): LevelTestPlanViewModel {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val store = OnboardingStore(api, AppCache(session, backgroundScope), session) { SignInResult.SignedIn }
        return LevelTestPlanViewModel(GOAL_ID, store, handle).also { models.put("$it", it) }
    }

    @Test
    fun anAskedStartThatFailedStartsAgainWhenTheAppComesBackFromProcessDeath() =
        askedStartFailed { api, _, handle ->
            models.clear()
            viewModel(api, SavedStateHandle.createHandle(handle.savedStateProvider().saveState(), null))
        }

    @Test
    fun anAskedStartThatFailedStartsAgainWhenTheLearnerComesBack() = askedStartFailed { _, vm, _ -> vm.also { it.visit.end() } }

    /** A learner who asked for the test on the level question never comes back to a spinner with nothing on its way. */
    private fun askedStartFailed(
        comeBack: TestScope.(FakeOnboardingApi, LevelTestPlanViewModel, SavedStateHandle) -> LevelTestPlanViewModel,
    ) = runTest {
        val api = FakeOnboardingApi().apply { writeFailure = ApiException(ApiError.Network) }
        val handle = SavedStateHandle()
        val first = viewModel(api, handle)
        first.startAsked()
        runCurrent()
        assertTrue(first.failed)
        assertNull(first.attemptId)

        api.writeFailure = null
        api.startedLevelTest = { levelTestOf(attemptId = ATTEMPT.toString()) }
        val back = comeBack(api, first, handle)
        back.startAsked()
        runCurrent()

        assertEquals(2, api.levelTestStarts)
        assertEquals(ATTEMPT, back.attemptId)
        assertFalse(back.failed)
    }

    private companion object {
        val ATTEMPT: UUID = UUID.fromString("7d1f6a3e-2b8c-4f0a-9e5d-1c2b3a4d5e6f")
    }
}
