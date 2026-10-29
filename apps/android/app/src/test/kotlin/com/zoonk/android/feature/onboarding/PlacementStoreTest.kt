package com.zoonk.android.feature.onboarding

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.value
import com.zoonk.api.models.ChoiceAnswer
import com.zoonk.api.models.ChoiceAnswerAnyOf3
import com.zoonk.api.models.PlacementAnswer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlacementStoreTest {
    private val api = FakeOnboardingApi()

    private fun TestScope.store(): OnboardingStore {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        return OnboardingStore(
            api,
            AppCache(session, CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))),
            session,
        ) { true }
    }

    @Test
    fun anAnswerShowsThePlacementItReturnsWithoutReadingItAgain() =
        runTest {
            val store = store()
            store.placements[GOAL_ID].load()
            api.answered = { placementOf(answered = 1, next = trueFalseQuestion(NEXT_ITEM_ID)) }

            val outcome = store.answerPlacement(GOAL_ID, ITEM_ID, DONT_KNOW, durationMs = 4_000)

            assertTrue(outcome is WriteOutcome.Done)
            assertEquals(1, api.placementReads)
            assertEquals(
                1L,
                store.placements[GOAL_ID]
                    .state.value.value
                    ?.answered,
            )
            assertEquals(
                ITEM_ID,
                api.placementAnswers
                    .single()
                    .itemId
                    .toString(),
            )
        }

    @Test
    fun aGoalThatIsNotAnExamHasNoMockOptions() =
        runTest {
            val store = store()
            store.placementMocks[GOAL_ID].load()

            assertEquals(LoadState.Empty, store.placementMocks[GOAL_ID].state.value)
        }

    private companion object {
        val DONT_KNOW = PlacementAnswer.ChoiceAnswerValue(ChoiceAnswer.ChoiceAnswerAnyOf3Value(ChoiceAnswerAnyOf3(dontKnow = true)))
    }
}
