package com.zoonk.android.feature.onboarding.start

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.onboarding.DRAFT_ID
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.course.CourseStartViewModel
import com.zoonk.api.models.CreateUploadRequest
import com.zoonk.api.models.Goal
import com.zoonk.api.models.OnboardingDraft
import com.zoonk.api.models.OnboardingDraftEdit
import com.zoonk.api.models.OnboardingDraftEditOneOf1
import com.zoonk.api.models.Source
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A start page's write says it didn't save only on the visit that asked: one that fails after the learner left says
 * nothing on return, and one already shown is gone once they leave and come back.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class StartVisitFailureTest {
    private val held = CompletableDeferred<Unit>()
    private val failure = ApiException(ApiError.Network)
    private val models = ViewModelStore()
    private val fake = FakeOnboardingApi()
    private val api =
        object : OnboardingApi by fake {
            override suspend fun attach(
                session: AuthenticatedSession,
                request: CreateUploadRequest,
            ): Source {
                held.await()
                throw failure
            }

            override suspend fun revise(
                session: AuthenticatedSession,
                id: String,
                edit: OnboardingDraftEdit,
            ): OnboardingDraft {
                held.await()
                throw failure
            }

            override suspend fun startCourse(
                session: AuthenticatedSession,
                courseId: String,
                body: JsonObject,
            ): Goal {
                held.await()
                throw failure
            }
        }

    private fun <T : ViewModel> T.kept() = also { models.put("$it", it) }

    private fun check(
        leaveFirst: Boolean,
        visit: (OnboardingStore) -> Pair<Visit, Pair<() -> Unit, () -> Any?>>,
    ) = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        try {
            val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
            val (asker, request) = visit(OnboardingStore(api, AppCache(session, backgroundScope), session) { SignInResult.SignedIn })
            val (ask, shown) = request
            ask()
            runCurrent()
            if (leaveFirst) asker.end()
            held.complete(Unit)
            advanceUntilIdle()
            if (!leaveFirst) {
                assertNotNull("it shows on the visit that asked", shown())
                asker.end()
            }
            assertNull(shown())
        } finally {
            models.clear()
            Dispatchers.resetMain()
        }
    }

    private fun attach(leaveFirst: Boolean) =
        check(leaveFirst) { store ->
            val vm = StartGoalViewModel(store, SavedStateHandle(), null, null, null).kept()
            vm.visit to ({ vm.attachText("notes", "en") } to { vm.attachFailure })
        }

    private fun edit(leaveFirst: Boolean) =
        check(leaveFirst) { store ->
            val vm = StartGoalViewModel(store, SavedStateHandle(), null, DRAFT_ID, null).kept()
            val edit =
                OnboardingDraftEdit.OnboardingDraftEditOneOf1Value(
                    OnboardingDraftEditOneOf1(OnboardingDraftEditOneOf1.Field.entries.first(), 0, "x"),
                )
            vm.visit to ({ vm.revise("title", edit) } to { vm.failedEdit })
        }

    private fun courseStart(leaveFirst: Boolean) =
        check(leaveFirst) { store ->
            val vm = CourseStartViewModel(store, SavedStateHandle()).kept()
            vm.visit to ({ vm.start("course", null, null) } to { vm.failure })
        }

    @Test
    fun anAttachThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = attach(leaveFirst = true)

    @Test
    fun anAttachFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = attach(leaveFirst = false)

    @Test
    fun aFactEditThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = edit(leaveFirst = true)

    @Test
    fun aFactEditFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = edit(leaveFirst = false)

    @Test
    fun aCourseStartThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = courseStart(leaveFirst = true)

    @Test
    fun aCourseStartFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = courseStart(leaveFirst = false)
}
