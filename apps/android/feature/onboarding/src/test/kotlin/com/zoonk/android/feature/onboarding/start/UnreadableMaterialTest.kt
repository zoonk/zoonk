package com.zoonk.android.feature.onboarding.start

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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.putJsonArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

/** Material the server can't read anymore refuses the goal before anything is saved; the learner's start stays as they left it. */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class UnreadableMaterialTest {
    private val notes = AttachedSource("3f9d2c1e-3b4a-4c5d-8e6f-7a8b9c0d1e2f", "Cell cycle notes.pdf")
    private val slides = AttachedSource("4b0e3d2f-4c5b-4d6e-9f70-8b9c0d1e2f3a", "Mitosis slides.pptx")

    @Test
    fun materialThatCantBeReadIsMarkedAndTheGoalGoesWithoutItOnceRemoved() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val models = ViewModelStore()
            try {
                val api =
                    FakeOnboardingApi().apply {
                        refusal =
                            ApiException(
                                ApiError.Unavailable,
                                "MATERIAL_UNAVAILABLE",
                                status = 422,
                                details = buildJsonObject { putJsonArray("sourceIds") { add(notes.id) } },
                            )
                    }
                val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                val store = OnboardingStore(api, AppCache(session, backgroundScope), session) { SignInResult.SignedIn }
                val vm = StartGoalViewModel(store, SavedStateHandle(), null, null, null).also { models.put("start", it) }
                vm.setAttached(listOf(notes, slides))
                vm.setIntent(MaterialIntent.Exam)

                vm.submit("", "Prepare for an exam with Cell cycle notes.pdf, Mitosis slides.pptx", "en")
                advanceUntilIdle()

                assertEquals(StartScreen.Entry, vm.flow.screen)
                assertEquals("", vm.words.text.toString())
                assertEquals(listOf(notes, slides), vm.flow.attached)
                assertEquals(MaterialIntent.Exam, vm.flow.intent)
                assertEquals(setOf(notes.id), vm.gone)
                assertNull(vm.entryError)

                vm.removeAttached(notes.id)
                api.refusal = null
                vm.submit("", "Prepare for an exam with Mitosis slides.pptx", "en")
                advanceUntilIdle()

                assertEquals(emptySet<String>(), vm.gone)
                assertEquals(listOf(UUID.fromString(slides.id)), api.understandCalls.last().sourceIds)
                assertTrue(vm.flow.screen is StartScreen.Draft)
            } finally {
                models.clear()
                Dispatchers.resetMain()
            }
        }
}
