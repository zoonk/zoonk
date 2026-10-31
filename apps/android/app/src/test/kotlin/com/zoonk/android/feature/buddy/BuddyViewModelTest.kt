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
import com.zoonk.android.feature.today.FakeTodayApi
import com.zoonk.android.feature.today.TodayStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.BuddyStatus
import com.zoonk.api.models.LearningProfile
import com.zoonk.api.models.OpenStudyDayRequest
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.StudySessionSummary
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
                    "session" to
                        fixture(
                            "study-session",
                            "id" to SESSION.toString(),
                            "blocks" to JsonArray(listOf(fixture("study-block", "id" to BLOCK.toString()))),
                        ),
                )
            val today = FakeTodayApi(listOf(unopened, opened))
            val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
            val vm =
                BuddyViewModel(
                    BuddyStore(NoBuddyApi, cache, { "UTC" }, cache.resource(Audience.SignedIn) { learnerSummary() }, backgroundScope),
                    LearningProfileStore(NoProfileApi, cache),
                    TodayStore(today, cache, backgroundScope, { "UTC" }),
                    StudyOpener(NoStudyApi, { _, _ -> error("Not used") }, cache, { "UTC" }, backgroundScope),
                )

            vm.openMission(MissionOpens.Block(blockId = BLOCK, position = null), GOAL)
            advanceUntilIdle()

            assertEquals(2, today.reads)
            assertEquals(AppRoute.QuestionBlock(SESSION.toString(), BLOCK.toString()), vm.routes.first())
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
        override suspend fun session(
            session: AuthenticatedSession,
            sessionId: UUID,
            timeZone: String,
        ): StudySession = error("Not used")

        override suspend fun prepare(
            session: AuthenticatedSession,
            sessionId: UUID,
        ) = Unit

        override suspend fun openDay(
            session: AuthenticatedSession,
            goalId: UUID,
            body: OpenStudyDayRequest,
        ): OpenedStudyDay = error("Not used")

        override suspend fun stop(
            session: AuthenticatedSession,
            sessionId: UUID,
            timeZone: String,
        ) = Unit

        override suspend fun summary(
            session: AuthenticatedSession,
            sessionId: UUID,
            timeZone: String,
        ): StudySessionSummary = error("Not used")

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
        val SESSION: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d55")
        val BLOCK: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d77")
    }
}
