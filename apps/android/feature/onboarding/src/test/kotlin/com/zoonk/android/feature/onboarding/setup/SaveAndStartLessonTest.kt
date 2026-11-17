package com.zoonk.android.feature.onboarding.setup

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModelStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.feature.profile.ProfileDraft
import com.zoonk.api.models.OnboardingStep
import com.zoonk.api.models.ProfileQuestion
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class SaveAndStartLessonTest {
    @Test
    fun goingBackToAnEarlierQuestionWhileSavingDoesNotOpenTheLesson() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val models = ViewModelStore()
            try {
                val held = CompletableDeferred<Unit>()
                val api =
                    FakeOnboardingApi().apply {
                        answerGate = held
                        reply = { _, _ -> setupView(listOf("plan")) }
                    }
                val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                val store = OnboardingStore(api, AppCache(session, backgroundScope), session) { SignInResult.SignedIn }
                val vm = GoalSetupViewModel(store, null, SavedStateHandle(), GOAL_ID)
                models.put("setup", vm)
                vm.begin(setupView(listOf("addressForm", "plan"), details = """{"answered":["purpose"]}"""))
                val draft = ProfileDraft(picks = listOf("neutral"))
                vm.answerThenStartLesson(draft.onboardingInput(ProfileQuestion.ADDRESS_FORM, true), draft)
                runCurrent()
                assertTrue(vm.isSaving)
                assertEquals(1, api.answers.size)

                vm.back()
                val reopened = vm.flow
                assertEquals(OnboardingStep.PURPOSE, reopened.current)
                held.complete(Unit)
                runCurrent()

                assertEquals(reopened, vm.flow)
                assertNull("Leaving the question must cancel its pending lesson start", vm.startLesson.value)
            } finally {
                models.clear()
                Dispatchers.resetMain()
            }
        }
}
