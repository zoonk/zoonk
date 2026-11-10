package com.zoonk.android.feature.onboarding.setup

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
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.feature.profile.ProfileDraft
import com.zoonk.android.feature.profile.profileSkip
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
import com.zoonk.api.models.ProfileQuestionViewSaved
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class ProfileAnswerRecoveryTest {
    @Test
    fun aFailedSkipKeepsTheAnswerAndASuccessfulSkipDiscardsIt() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val models = ViewModelStore()
            try {
                val api = FakeOnboardingApi()
                val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                val store = OnboardingStore(api, AppCache(session, backgroundScope), session) { SignInResult.SignedIn }
                val vm = GoalSetupViewModel(store, null, SavedStateHandle(), GOAL_ID)
                models.put("profile", vm)
                vm.begin(setupView(listOf("watch", "plan")))
                val question =
                    ProfileQuestionView(ProfileQuestion.WATCH, emptyList(), ProfileQuestionViewSaved(emptyList(), emptyList(), ""), null, 1)
                val draft = ProfileDraft(picks = listOf("sciFi"), text = "Star Trek")
                vm.changeProfile(ProfileQuestion.WATCH, draft)
                api.refusal = ApiException(ApiError.Network)
                vm.answer(profileSkip(ProfileQuestion.WATCH))!!.await()
                assertTrue(vm.saveFailed)
                assertEquals(draft, vm.profileDraft(question, null))
                api.refusal = null
                api.reply = { _, _ -> setupView(listOf("plan")) }
                vm.answer(profileSkip(ProfileQuestion.WATCH))!!.await()
                assertEquals(ProfileDraft(), vm.profileDraft(question, null))
            } finally {
                models.clear()
                Dispatchers.resetMain()
            }
        }
}
