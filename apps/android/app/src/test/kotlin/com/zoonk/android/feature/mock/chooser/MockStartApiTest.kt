package com.zoonk.android.feature.mock.chooser

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.api.models.MockShape
import com.zoonk.api.models.PlacementMockOption
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.util.UUID
import java.util.concurrent.TimeUnit

class MockStartApiTest {
    private val server = MockWebServer()
    private lateinit var api: LiveMockStartApi
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val goalId = UUID.fromString("c0bddf58-9c71-8b20-836b-152dbc39a61a")
    private val half = MockChoice.Practice(MockShape(area = null, day = null, kind = MockShape.Kind.HALF))

    @Before
    fun start() {
        server.start()
        api = LiveMockStartApi(ApiClients(server.url("/v1/"), apiHttpClient()))
    }

    @After
    fun stop() = server.close()

    @Test
    fun aPracticeMockSendsItsShapesNulls() =
        runTest {
            server.enqueue(json("""{"id":"$STARTED","status":"started"}"""))

            api.start(ana, goalId, half, acceptFewer = false)

            val request = server.takeRequest(5, TimeUnit.SECONDS)!!
            assertEquals("/v1/goals/$goalId/mocks", request.url.encodedPath)
            assertEquals(
                """{"purpose":"practice","shape":{"area":null,"day":null,"kind":"half"},"acceptFewer":false}""",
                request.body!!.utf8(),
            )
        }

    @Test
    fun aPlacementMockSendsItsLength() =
        runTest {
            server.enqueue(json("""{"id":"$STARTED","status":"started"}"""))

            api.start(ana, goalId, MockChoice.Placement(PlacementMockOption.Length.SHORT), acceptFewer = true)

            assertEquals(
                """{"length":"short","purpose":"placement","acceptFewer":true}""",
                server.takeRequest(5, TimeUnit.SECONDS)!!.body!!.utf8(),
            )
        }

    @Test
    fun writingQuestionsSendsTheShapesNulls() =
        runTest {
            server.enqueue(json("""{"generationId":null,"status":"ready"}"""))

            api.writeQuestions(ana, goalId, half)

            val request = server.takeRequest(5, TimeUnit.SECONDS)!!
            assertEquals("/v1/goals/$goalId/mocks/generations", request.url.encodedPath)
            assertEquals("""{"purpose":"practice","shape":{"area":null,"day":null,"kind":"half"}}""", request.body!!.utf8())
        }

    private fun json(body: String) =
        MockResponse
            .Builder()
            .code(201)
            .addHeader("Content-Type", "application/json")
            .body(body)
            .build()
}
