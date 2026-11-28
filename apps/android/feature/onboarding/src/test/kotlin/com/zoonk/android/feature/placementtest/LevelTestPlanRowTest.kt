package com.zoonk.android.feature.placementtest

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

/** The Plan's level test row counts the answers given since it was read, once the learner is back on the Plan. */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class LevelTestPlanRowTest {
    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun anAnswerMakesThePlanReadAgainWhenItShows() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
            val cache = AppCache(session, backgroundScope)
            val planApi = FakePlanApi()
            val plans = PlanStore(planApi, cache)
            val store = OnboardingStore(FakeOnboardingApi(), cache, session) { SignInResult.SignedIn }
            val plan = plans.plan[UUID.fromString(GOAL_ID)]
            plan.load()
            val reads = planApi.plans

            store.answerLevelTest(GOAL_ID, "reading-1", answerIndex = 0, durationMs = 1_000, skipped = false, attemptId = ATTEMPT)
            plan.load()

            assertEquals(reads + 1, planApi.plans)
        }

    private companion object {
        val ATTEMPT: UUID = UUID.fromString("6f1c2e2a-6d1b-4c8e-9a51-2f4b8f0c7a11")
    }
}
