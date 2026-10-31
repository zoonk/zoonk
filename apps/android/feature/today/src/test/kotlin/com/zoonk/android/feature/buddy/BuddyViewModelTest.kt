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
import com.zoonk.android.feature.session.opening
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.BuddyStatus
import com.zoonk.api.models.LearningProfile
import com.zoonk.api.models.StudyBlockOpeningTarget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
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
    fun aMissionsBlockOpensInTheSessionItsOpeningNames() =
        runTest(dispatcher) {
            val study = FakeStudyApi()
            study.openings = listOf(opening("session", "blockId" to BLOCK.toString(), "sessionId" to SESSION.toString()))
            val vm = buddy(study, NoBuddyApi)

            vm.openMission(MissionOpens.Block(blockId = BLOCK, position = null), GOAL)
            advanceUntilIdle()

            assertEquals(listOf(BLOCK), study.targets.map { (it as StudyBlockOpeningTarget.MissionWrapper).value.blockId })
            assertEquals(AppRoute.QuestionBlock(SESSION.toString(), BLOCK.toString()), vm.routes.first())
        }

    @Test
    fun aMissionNoLongerFreeToStartReadsTheCardsAgain() =
        runTest(dispatcher) {
            val study = FakeStudyApi()
            study.openings = listOf(opening("changed"))
            var statusReads = 0
            val status =
                object : BuddyApi {
                    override suspend fun status(
                        session: AuthenticatedSession,
                        timeZone: String,
                    ): BuddyStatus {
                        statusReads++
                        throw ApiException(ApiError.Unavailable)
                    }
                }
            val vm = buddy(study, status)

            vm.openMission(MissionOpens.Block(blockId = BLOCK, position = null), GOAL)
            advanceUntilIdle()

            assertEquals(1, study.targets.size)
            assertEquals(1, statusReads)
        }

    private fun TestScope.buddy(
        study: FakeStudyApi,
        status: BuddyApi,
    ): BuddyViewModel {
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        return BuddyViewModel(
            BuddyStore(status, cache, { "UTC" }, cache.resource(Audience.SignedIn) { learnerSummary() }, backgroundScope),
            LearningProfileStore(NoProfileApi, cache),
            StudyOpener(study, { _, _ -> error("Not used") }, cache, { "UTC" }),
        )
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
