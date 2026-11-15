package com.zoonk.android.feature.settings

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModelStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.profile.ProfileDraft
import com.zoonk.android.feature.profile.ProfileQuestionsApi
import com.zoonk.android.feature.profile.ProfileQuestionsStore
import com.zoonk.api.models.ProfileAnswerInput
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
import com.zoonk.api.models.ProfileQuestionViewSaved
import com.zoonk.api.models.ProfileQuestions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class ProfileQuestionViewModelTest {
    private fun question(picks: List<String>) =
        ProfileQuestionView(ProfileQuestion.TOOLS, emptyList(), ProfileQuestionViewSaved(picks, emptyList(), ""), null, 1)

    @Test
    fun aFreshReadRemovesDeletedFactsAndAddsNewAnswersBeforeSaving() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val models = ViewModelStore()
            try {
                val api = FakeProfileApi()
                val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                val store = ProfileQuestionsStore(api, AppCache(session, backgroundScope))
                for ((old, fresh) in listOf(listOf("figma", "vsCode") to listOf("vsCode"), emptyList<String>() to listOf("figma"))) {
                    val editor = ProfileQuestionViewModel(store, question(old), SavedStateHandle())
                    models.put("editor", editor)
                    editor.read(question(fresh))
                    editor.save(ProfileQuestion.TOOLS, true)
                    advanceUntilIdle()
                    assertEquals(ProfileDraft(picks = fresh).input(ProfileQuestion.TOOLS, true), api.saved)
                }
            } finally {
                models.clear()
                Dispatchers.resetMain()
            }
        }

    @Test
    fun aFreshReadKeepsTheLearnersEditsIncludingAfterRestoration() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val models = ViewModelStore()
            try {
                val api = FakeProfileApi()
                val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                val store = ProfileQuestionsStore(api, AppCache(session, backgroundScope))
                val handle = SavedStateHandle()
                val editor = ProfileQuestionViewModel(store, question(listOf("figma")), handle)
                models.put("editor", editor)
                val draft = ProfileDraft(picks = listOf("vsCode"), text = "Python")
                editor.change(draft)
                editor.read(question(emptyList()))
                assertEquals(draft, editor.draft)
                val restoredHandle = SavedStateHandle.createHandle(handle.savedStateProvider().saveState(), null)
                val restored = ProfileQuestionViewModel(store, question(emptyList()), restoredHandle)
                models.put("restored", restored)
                restored.read(question(listOf("figma")))
                assertEquals(draft, restored.draft)
            } finally {
                models.clear()
                Dispatchers.resetMain()
            }
        }

    @Test
    fun anAnswerSavedWhileThePageIsRecreatedGoesBackOnce() =
        editing { editor, _ ->
            // No page shows while the save is out, as when the window is recreated.
            editor.save(ProfileQuestion.TOOLS, true)
            advanceUntilIdle()

            assertEquals(Unit, editor.answered.value?.also(editor.answered::acted))
            assertNull(editor.answered.value)
        }

    @Test
    fun anAnswerSavedAfterThePageLeftLeadsNowhereOnReturn() =
        editing { editor, api ->
            editor.save(ProfileQuestion.TOOLS, true)
            editor.visit.end()
            advanceUntilIdle()

            assertNotNull(api.saved)
            assertNull(editor.answered.value)
        }

    @Test
    fun anAnswerThatFailsAfterThePageLeftSaysNothingOnReturn() =
        editing { editor, api ->
            api.failure = ApiException(ApiError.Network)

            editor.save(ProfileQuestion.TOOLS, true)
            editor.visit.end()
            advanceUntilIdle()

            assertFalse(editor.failed)
            assertFalse(editor.saving)
        }

    /** An editor of the tools question with Figma picked, its save run by [test]'s scheduler. */
    private fun editing(test: suspend TestScope.(ProfileQuestionViewModel, FakeProfileApi) -> Unit) =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val models = ViewModelStore()
            try {
                val api = FakeProfileApi()
                val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
                val editor =
                    ProfileQuestionViewModel(
                        ProfileQuestionsStore(api, AppCache(session, backgroundScope)),
                        question(listOf("figma")),
                        SavedStateHandle(),
                    )
                models.put("editor", editor)
                test(editor, api)
            } finally {
                models.clear()
                Dispatchers.resetMain()
            }
        }

    private class FakeProfileApi : ProfileQuestionsApi {
        var saved: ProfileAnswerInput? = null
        var failure: ApiException? = null

        override suspend fun questions(session: AuthenticatedSession) = ProfileQuestions(true, emptyList())

        override suspend fun answer(
            session: AuthenticatedSession,
            input: ProfileAnswerInput,
        ): ProfileQuestionView {
            failure?.let { throw it }
            saved = input
            return ProfileQuestionView(ProfileQuestion.TOOLS, emptyList(), ProfileQuestionViewSaved(emptyList(), emptyList(), ""), null, 1)
        }
    }
}
