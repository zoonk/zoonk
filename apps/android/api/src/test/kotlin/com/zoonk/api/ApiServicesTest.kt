package com.zoonk.api

import com.zoonk.api.models.GetChapterTestOut200Response
import com.zoonk.api.models.LearningProfileUpdate
import com.zoonk.api.models.Milestone
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.util.UUID

class ApiServicesTest {
    private val server = MockWebServer()
    private lateinit var services: ApiServices
    private val goalId = UUID.fromString("0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c001")

    @Before
    fun start() {
        server.start()
        services = ApiServices(server.url("/v1/"), OkHttpClient())
    }

    @After
    fun stop() {
        server.close()
    }

    @Test
    fun decodesAResponseWithAUuidATimestampAndAnEnum() =
        runTest {
            server.enqueue(
                json(
                    """{"earnedAt":"2026-10-28T09:00:00.000Z","id":"$goalId","key":"belt-yellow","kind":"belt","shownAt":null}""",
                ),
            )
            val milestone = services.milestones.createMilestoneView(goalId).body()!!
            assertEquals("/v1/me/milestones/$goalId/views", server.takeRequest().url.encodedPath)
            assertEquals(goalId, milestone.id)
            assertEquals("2026-10-28T09:00:00Z", milestone.earnedAt.toString())
            assertEquals(Milestone.Kind.BELT, milestone.kind)
            assertNull(milestone.shownAt)
        }

    @Test
    fun decodesAUnionIntoTheBranchItMatches() =
        runTest {
            server.enqueue(json("""{"status":"nothingToSkip"}"""))
            val result = services.learner.getChapterTestOut(goalId, goalId).body()!!
            assertEquals(GetChapterTestOut200Response.NothingToSkipValue::class, result::class)
        }

    @Test
    fun aPatchSendsOnlyTheFieldsItSets() =
        runTest {
            server.enqueue(MockResponse.Builder().code(500).build())
            server.enqueue(MockResponse.Builder().code(500).build())
            services.account.updateCurrentUserLearningProfile(LearningProfileUpdate(soundsEnabled = false))
            services.account.updateCurrentUserLearningProfile(LearningProfileUpdate(activeGoalId = goalId))
            assertEquals("""{"soundsEnabled":false}""", server.takeRequest().body?.utf8())
            assertEquals("""{"activeGoalId":"$goalId"}""", server.takeRequest().body?.utf8())
        }

    private fun json(body: String) =
        MockResponse
            .Builder()
            .addHeader("Content-Type", "application/json")
            .body(body)
            .build()
}
