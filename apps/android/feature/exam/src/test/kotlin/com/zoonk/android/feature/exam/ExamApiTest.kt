package com.zoonk.android.feature.exam

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.data.startOnLoopback
import com.zoonk.android.feature.mock.LiveMockApi
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class ExamApiTest {
    private val server = MockWebServer()
    private lateinit var clients: ApiClients
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")

    @Before
    fun start() {
        server.startOnLoopback()
        clients = ApiClients(server.url("/v1/"), apiHttpClient())
    }

    @After
    fun stop() = server.close()

    @Test
    fun aGoalThatIsntAnExamHasNoExamNorMocks() =
        runTest {
            server.enqueue(error(422, "NOT_AN_EXAM"))
            server.enqueue(error(404, "NOT_FOUND"))

            assertNull(LiveExamApi(clients).exam(ana, GOAL, "UTC"))
            assertNull(LiveMockApi(clients).options(ana, GOAL))
        }

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
