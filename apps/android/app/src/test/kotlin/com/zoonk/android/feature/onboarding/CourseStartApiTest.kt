package com.zoonk.android.feature.onboarding

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.feature.onboarding.setup.LevelChoice
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.util.concurrent.TimeUnit

class CourseStartApiTest {
    private val server = MockWebServer()
    private lateinit var api: LiveOnboardingApi
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val courseId = "7d3c1c1e-5b0a-4d43-9f55-0c9a3c1c2f10"

    @Before
    fun start() {
        server.start()
        api = LiveOnboardingApi(ApiClients(server.url("/v1/"), apiHttpClient()))
    }

    @After
    fun stop() = server.close()

    @Test
    fun aQuickTestSendsItsLevelAsNull() =
        runTest {
            assertEquals("""{"level":null,"timeZone":"UTC"}""", sent(LevelChoice.QuickTest))
        }

    @Test
    fun leavingTheLevelToTheSetupLeavesItOut() =
        runTest {
            assertEquals("""{"timeZone":"UTC"}""", sent(level = null))
        }

    private suspend fun sent(level: LevelChoice?): String {
        server.enqueue(MockResponse.Builder().code(500).build())
        runCatching {
            api.startCourse(
                ana,
                courseId,
                courseStartBody(chapterId = null, dailyMinutes = null, level = level, timeZone = "UTC"),
            )
        }
        val request = server.takeRequest(5, TimeUnit.SECONDS)!!
        assertEquals("/v1/courses/$courseId/goals", request.url.encodedPath)
        return request.body!!.utf8()
    }
}
