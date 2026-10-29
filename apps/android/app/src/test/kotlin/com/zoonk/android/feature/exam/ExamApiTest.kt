package com.zoonk.android.feature.exam

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.feature.mock.LiveMockApi
import com.zoonk.api.models.ExamResult
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.util.concurrent.TimeUnit

class ExamApiTest {
    private val server = MockWebServer()
    private lateinit var clients: ApiClients
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")

    @Before
    fun start() {
        server.start()
        clients = ApiClients(server.url("/v1/"), apiHttpClient())
    }

    @After
    fun stop() = server.close()

    @Test
    fun aResultSendsEveryKeyEvenWhenItsNull() =
        runTest {
            server.enqueue(json("""{"maxScore":null,"passed":true,"reportedAt":"2026-11-20T12:00:00Z","scale":null,"score":null}"""))

            val report = ExamResultReport(score = null, scale = null, maxScore = null, passed = true)
            LiveExamApi(clients).report(ana, GOAL, report, "America/Sao_Paulo")

            val request = server.takeRequest(5, TimeUnit.SECONDS)!!
            assertEquals("PUT", request.method)
            assertEquals("/v1/goals/$GOAL/exam-result", request.url.encodedPath)
            assertEquals("""{"maxScore":null,"passed":true,"scale":null,"score":null}""", request.body!!.utf8())
        }

    @Test
    fun aScoreGoesWithItsScale() =
        runTest {
            server.enqueue(json("""{"maxScore":null,"passed":null,"reportedAt":"2026-11-20T12:00:00Z","scale":"sat","score":1410}"""))

            val report = ExamResultReport(score = 1410.0, scale = ExamResult.Scale.SAT, maxScore = null, passed = null)
            LiveExamApi(clients).report(ana, GOAL, report, "UTC")

            assertEquals(
                """{"maxScore":null,"passed":null,"scale":"sat","score":1410.0}""",
                server.takeRequest(5, TimeUnit.SECONDS)!!.body!!.utf8(),
            )
        }

    @Test
    fun aGoalThatIsntAnExamHasNoExamNorMocks() =
        runTest {
            server.enqueue(error(422, "NOT_AN_EXAM"))
            server.enqueue(error(404, "NOT_FOUND"))

            assertNull(LiveExamApi(clients).exam(ana, GOAL, "UTC"))
            assertNull(LiveMockApi(clients).options(ana, GOAL))
        }

    private fun json(body: String) =
        MockResponse
            .Builder()
            .code(200)
            .addHeader("Content-Type", "application/json")
            .body(body)
            .build()

    private fun error(
        code: Int,
        errorCode: String,
    ) = MockResponse
        .Builder()
        .code(code)
        .addHeader("Content-Type", "application/json")
        .body("""{"error":{"code":"$errorCode","message":"No"}}""")
        .build()
}
