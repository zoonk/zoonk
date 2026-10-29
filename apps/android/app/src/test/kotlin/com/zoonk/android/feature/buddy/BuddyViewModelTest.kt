package com.zoonk.android.feature.buddy

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LearningProfileApi
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.feature.plan.learnerSummary
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.StudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.feature.today.TodayApi
import com.zoonk.android.feature.today.TodayStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.BuddyStatus
import com.zoonk.api.models.LanguageToday
import com.zoonk.api.models.LearningProfile
import com.zoonk.api.models.MistakeListAvailability
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.SuggestedGoal
import com.zoonk.api.models.Today
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class BuddyViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    @Test
    fun aMissionsBlockFromADayOpenedElsewhereReadsTodayAgainAndOpens() =
        runTest(dispatcher) {
            val unopened = decodeFixture<Today>("today", "session" to fixture("unstarted-study-day"))
            val opened =
                decodeFixture<Today>(
                    "today",
                    "session" to fixture("study-session", "blocks" to JsonArray(listOf(fixture("study-block", "id" to BLOCK.toString())))),
                )
            val today = FakeTodayApi(listOf(unopened, opened))
            val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
            val vm =
                BuddyViewModel(
                    BuddyStore(NoBuddyApi, cache, { "UTC" }, cache.resource(Audience.SignedIn) { learnerSummary() }, backgroundScope),
                    LearningProfileStore(NoProfileApi, cache),
                    TodayStore(today, cache, backgroundScope, { "UTC" }),
                    StudyOpener(NoStudyApi, cache, { "UTC" }),
                )

            vm.openMission(MissionOpens.Block(blockId = BLOCK, position = null), GOAL)
            advanceUntilIdle()

            assertEquals(2, today.reads)
            assertEquals(AppRoute.Session(blockId = BLOCK.toString()), vm.routes.first())
        }

    private class FakeTodayApi(
        private val answers: List<Today>,
    ) : TodayApi {
        var reads = 0

        override suspend fun today(
            session: AuthenticatedSession,
            timeZone: String,
        ) = answers[minOf(reads++, answers.lastIndex)]

        override suspend fun brainPower(session: AuthenticatedSession): Long? = null

        override suspend fun mistakes(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = MistakeListAvailability(ready = 0, tomorrow = 0)

        override suspend fun mocks(
            session: AuthenticatedSession,
            goalId: UUID,
        ): MockOptions = error("Not used")

        override suspend fun language(
            session: AuthenticatedSession,
            goalId: UUID,
        ): LanguageToday = error("Not used")

        override suspend fun resumePreview(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = false

        override suspend fun onboardingLeft(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = false

        override suspend fun resume(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = Unit

        override suspend fun answerInsight(
            session: AuthenticatedSession,
            insightId: UUID,
            accepted: Boolean,
        ) = Unit

        override suspend fun answerSuggestedGoal(
            session: AuthenticatedSession,
            suggestionId: UUID,
            accepted: Boolean,
        ): SuggestedGoal = error("Not used")
    }

    private object NoBuddyApi : BuddyApi {
        override suspend fun status(
            session: AuthenticatedSession,
            timeZone: String,
        ): BuddyStatus = error("Not read")
    }

    private object NoProfileApi : LearningProfileApi {
        override suspend fun profile(session: AuthenticatedSession): LearningProfile = error("Not used")

        override suspend fun update(
            session: AuthenticatedSession,
            change: JsonObject,
        ): LearningProfile = error("Not used")
    }

    private object NoStudyApi : StudyApi {
        override suspend fun openDay(
            session: AuthenticatedSession,
            goalId: UUID,
            body: JsonObject,
        ): OpenedStudyDay = error("Not used")

        override suspend fun addExtraBlock(
            session: AuthenticatedSession,
            sessionId: UUID,
        ): StudyBlock = error("Not used")

        override suspend fun catchUp(
            session: AuthenticatedSession,
            sessionId: UUID,
            timeZone: String,
        ) = Unit

        override suspend fun startBlock(
            session: AuthenticatedSession,
            sessionId: UUID,
            blockId: UUID,
            timeZone: String,
        ) = Unit
    }

    private companion object {
        const val GOAL = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00"
        val BLOCK: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d77")
    }
}
