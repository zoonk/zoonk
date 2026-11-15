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
import com.zoonk.android.data.VisitOutcome
import com.zoonk.android.feature.onboarding.DRAFT_ID
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.GoalError
import com.zoonk.android.feature.onboarding.OnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.understoodDraft
import com.zoonk.api.models.OnboardingDraft
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
 * A goal sent or made on a visit opens, or says it failed, only on that visit: a recreation lands the
 * request while no frame acts, and the next frame acts on it once; leaving ends the visit before it
 * lands, and nothing is owed on return.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class StartOutcomesTest {
    private val gate = CompletableDeferred<Unit>()
    private val models = ViewModelStore()
    private val fake = FakeOnboardingApi().apply { createGate = gate }

    /** Reading words and creating goals wait for [gate]; [fails] refuses them as a busy moment. */
    private fun check(
        fails: Boolean = false,
        body: suspend TestScope.(OnboardingStore) -> Unit,
    ) = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        try {
            if (fails) fake.refusal = ApiException(ApiError.Network)
            val api =
                object : OnboardingApi by fake {
                    override suspend fun understand(
                        session: AuthenticatedSession,
                        goal: String,
                        language: String,
                    ): OnboardingDraft {
                        gate.await()
                        return fake.understand(session, goal, language)
                    }
                }
            val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
            body(OnboardingStore(api, AppCache(session, backgroundScope), session) { SignInResult.SignedIn })
        } finally {
            models.clear()
            Dispatchers.resetMain()
        }
    }

    private fun <T : ViewModel> T.kept() = also { models.put("$it", it) }

    /** What the screen's next frame does (`ActOn`): acts on what's owed, then says so, as often as it's owed. */
    private fun <T : Any> VisitOutcome<T>.actTwice(): List<T> {
        val acted = mutableListOf<T>()
        repeat(2) {
            value?.let {
                acted += it
                acted(it)
            }
        }
        return acted
    }

    private fun TestScope.leaveWhile(
        visit: Visit,
        request: () -> Unit,
    ) {
        request()
        runCurrent()
        visit.end()
        gate.complete(Unit)
        runCurrent()
    }

    private fun TestScope.recreateWhile(request: () -> Unit) {
        request()
        gate.complete(Unit)
        runCurrent()
    }

    private fun startGoal(store: OnboardingStore) = StartGoalViewModel(store, SavedStateHandle(), null, null, null).kept()

    private val question = understoodDraft(understanding = """{"status":"explain","question":"What is a tort?"}""")

    private fun explanation() = explanationInput(question, "What is a tort?", "en")

    @Test
    fun wordsSentAfterTheWelcomeWasLeftOpenNothingOnReturn() =
        check { store ->
            val vm = GoalSenderViewModel(store).kept()
            leaveWhile(vm.visit) { vm.send("pass the bar exam", "en") }

            assertNull(vm.sent.value)
        }

    @Test
    fun wordsSentWhileTheWelcomeIsRecreatedOpenTheirDraftOnce() =
        check { store ->
            val vm = GoalSenderViewModel(store).kept()
            recreateWhile { vm.send("pass the bar exam", "en") }

            assertEquals(listOf(DRAFT_ID), vm.sent.actTwice())
        }

    @Test
    fun wordsThatFailAfterTheWelcomeWasLeftSayNothingOnReturn() =
        check(fails = true) { store ->
            val vm = GoalSenderViewModel(store).kept()
            leaveWhile(vm.visit) { vm.send("pass the bar exam", "en") }

            assertNull(vm.error)
        }

    @Test
    fun aGoalMadeAfterTheStartWasLeftOpensNothingOnReturn() =
        check { store ->
            val vm = startGoal(store)
            leaveWhile(vm.visit) { vm.create(explanation(), GoalOpens.Explanation) }

            assertNull(vm.created.value)
        }

    @Test
    fun aGoalMadeWhileTheStartIsRecreatedOpensWhatItsCardChoseOnce() =
        check { store ->
            val vm = startGoal(store)
            recreateWhile { vm.create(explanation(), GoalOpens.Explanation) }

            assertEquals(listOf(CreatedGoal(GOAL_ID, GoalOpens.Explanation)), vm.created.actTwice())
        }

    @Test
    fun aCreateThatFailsAfterTheStartWasLeftSaysNothingOnReturn() =
        check(fails = true) { store ->
            val vm = startGoal(store)
            leaveWhile(vm.visit) { vm.create(explanation(), GoalOpens.Explanation) }

            assertNull(vm.creationError)
        }

    @Test
    fun aCreateThatFailsWhileTheStartIsRecreatedSaysSo() =
        check(fails = true) { store ->
            val vm = startGoal(store)
            recreateWhile { vm.create(explanation(), GoalOpens.Explanation) }

            assertEquals(GoalError.CouldNotSave, vm.creationError)
        }

    @Test
    fun aConfirmedCardMadeAfterTheStartWasLeftOpensNothingOnReturn() =
        check { store ->
            val vm = startGoal(store)
            leaveWhile(vm.visit) { vm.confirm(explanation()) }

            assertNull(vm.created.value)
        }

    @Test
    fun aConfirmedCardMadeWhileTheStartIsRecreatedOpensItsSetupOnce() =
        check { store ->
            val vm = startGoal(store)
            recreateWhile { vm.confirm(explanation()) }

            assertEquals(listOf(CreatedGoal(GOAL_ID, GoalOpens.Setup)), vm.created.actTwice())
        }

    @Test
    fun aQuestionSettledAfterTheStartWasLeftOpensNothingOnReturn() =
        check { store ->
            gate.complete(Unit)
            store.sendGoal("what is a tort", "en")
            val vm = startGoal(store)
            val made = CompletableDeferred<Unit>()
            fake.createGate = made
            vm.settle(question) { draft, read -> explanationInput(draft, read, "en") }
            runCurrent()
            vm.visit.end()
            made.complete(Unit)
            runCurrent()

            assertNull(vm.created.value)
        }

    @Test
    fun aQuestionSettledWhileTheStartIsRecreatedOpensItsExplanationOnce() =
        check { store ->
            gate.complete(Unit)
            store.sendGoal("what is a tort", "en")
            val vm = startGoal(store)
            vm.settle(question) { draft, read -> explanationInput(draft, read, "en") }
            runCurrent()

            assertEquals(listOf(CreatedGoal(GOAL_ID, GoalOpens.Explanation)), vm.created.actTwice())
        }
}
