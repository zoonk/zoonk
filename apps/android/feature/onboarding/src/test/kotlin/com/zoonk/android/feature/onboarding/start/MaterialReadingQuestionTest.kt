package com.zoonk.android.feature.onboarding.start

import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModelStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.AttachedSource
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.api.models.SourceReadStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/** The server still reading the material is the guard: the question stays asked, waits a moment and goes again. */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class MaterialReadingQuestionTest {
    private val photo = AttachedSource("3f9d2c1e-3b4a-4c5d-8e6f-7a8b9c0d1e2f", "IMG_2041.jpg", SourceReadStatus.READABLE)

    @Test
    fun aQuestionTheServerStillReadsForGoesAgainOnceItsRead() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val models = ViewModelStore()
            try {
                val api = FakeOnboardingApi().apply { askFailure = ApiException(ApiError.Unavailable, "materialReading", status = 409) }
                val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                val store = OnboardingStore(api, AppCache(session, backgroundScope), session) { SignInResult.SignedIn }
                val vm = StartGoalViewModel(store, SavedStateHandle(), null, null, null).also { models.put("start", it) }
                vm.setAttached(listOf(photo))

                vm.question.setTextAndPlaceCursorAtEnd("What is the mitotic spindle?")
                vm.ask("en")
                runCurrent()

                assertEquals(listOf("What is the mitotic spindle?"), api.asked)
                assertEquals("What is the mitotic spindle?", vm.asking)
                assertEquals("", vm.question.text.toString())
                assertEquals(emptyList<MaterialTurn>(), vm.turns)

                api.askFailure = ApiException(ApiError.Unavailable)
                advanceTimeBy(READ_CHECK.inWholeMilliseconds + 1)

                assertEquals(listOf("What is the mitotic spindle?", "What is the mitotic spindle?"), api.asked)
                assertNull(vm.asking)
                assertEquals(listOf("What is the mitotic spindle?"), vm.turns.map { it.question })
            } finally {
                models.clear()
                Dispatchers.resetMain()
            }
        }
}
