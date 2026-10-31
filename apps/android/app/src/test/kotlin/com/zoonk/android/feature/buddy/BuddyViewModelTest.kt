package com.zoonk.android.feature.buddy

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LearningProfileApi
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.feature.plan.learnerSummary
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.feature.session.opening
import com.zoonk.android.feature.today.FakeTodayApi
import com.zoonk.android.feature.today.TodayStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.BuddyStatus
import com.zoonk.api.models.LearningProfile
import com.zoonk.api.models.StudyBlockOpeningTarget
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
    fun aMissionsBlockFromADayOpenedElsewhereOpensInTheSessionTodayReadsAgain() =
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
            val study = FakeStudyApi()
            study.openings = listOf(opening("session", "blockId" to BLOCK.toString()))
            val vm =
                BuddyViewModel(
                    BuddyStore(NoBuddyApi, cache, { "UTC" }, cache.resource(Audience.SignedIn) { learnerSummary() }, backgroundScope),
                    LearningProfileStore(NoProfileApi, cache),
                    TodayStore(today, cache, backgroundScope, { "UTC" }),
                    StudyOpener(study, { _, _ -> error("Not used") }, cache, { "UTC" }),
                )

            vm.openMission(MissionOpens.Block(blockId = BLOCK, position = null), GOAL)
            advanceUntilIdle()

            assertEquals(2, today.reads)
            assertEquals(listOf(BLOCK), study.targets.map { (it as StudyBlockOpeningTarget.MissionWrapper).value.blockId })
            assertEquals(AppRoute.QuestionBlock(SESSION.toString(), BLOCK.toString()), vm.routes.first())
        }

    @Test
    fun aMissionsBlockTodayDoesntHoldOpensNothingAndReadsTheCardsAgain() =
        runTest(dispatcher) {
            val today = FakeTodayApi(listOf(decodeFixture<Today>("today", "session" to fixture("unstarted-study-day"))))
            val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
            val study = FakeStudyApi()
            var statusReads = 0
            val buddy =
                object : BuddyApi {
                    override suspend fun status(
                        session: AuthenticatedSession,
                        timeZone: String,
                    ): BuddyStatus {
                        statusReads++
                        throw ApiException(ApiError.Unavailable)
                    }
                }
            val vm =
                BuddyViewModel(
                    BuddyStore(buddy, cache, { "UTC" }, cache.resource(Audience.SignedIn) { learnerSummary() }, backgroundScope),
                    LearningProfileStore(NoProfileApi, cache),
                    TodayStore(today, cache, backgroundScope, { "UTC" }),
                    StudyOpener(study, { _, _ -> error("Not used") }, cache, { "UTC" }),
                )

            vm.openMission(MissionOpens.Block(blockId = BLOCK, position = null), GOAL)
            advanceUntilIdle()

            assertEquals(0, study.targets.size)
            assertEquals(1, statusReads)
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

    private companion object {
        const val GOAL = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00"
        val SESSION: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d55")
        val BLOCK: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d77")
    }
}
