package com.zoonk.android.data

import com.zoonk.api.models.Generation
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class LiveGenerationSourceTest {
    private val server = MockWebServer()
    private val ana = AuthenticatedSession(ANA, "token-a", "local-a")
    private lateinit var source: LiveGenerationSource

    @Before
    fun start() {
        server.start()
        source = LiveGenerationSource(ApiClients(server.url("/v1/"), apiHttpClient()), ana)
    }

    @After
    fun stop() {
        server.close()
    }

    @Test
    fun aRunsStatusIsReadWithTheSessionsToken() =
        runTest {
            server.enqueue(json("""{"id":"run-1","status":"running"}"""))

            assertEquals(Generation.Status.RUNNING, source.status("run-1"))
            val request = server.takeRequest()
            assertEquals("/v1/generations/run-1", request.url.encodedPath)
            assertEquals("Bearer token-a", request.headers["Authorization"])
        }

    @Test
    fun aRunsEventsStreamWithTheSessionsToken() =
        runTest {
            server.enqueue(
                MockResponse
                    .Builder()
                    .addHeader("Content-Type", "text/event-stream")
                    .body(
                        "data: {\"status\":\"started\",\"step\":\"createPlan\"}\n\ndata: {\"status\":\"completed\",\"step\":\"createPlan\"}\n\n",
                    ).build(),
            )

            val events = source.events("run-1").toList()

            assertEquals(listOf("started", "completed"), events.map { it.status })
            val request = server.takeRequest()
            assertEquals("/v1/generations/run-1/events", request.url.encodedPath)
            assertEquals("Bearer token-a", request.headers["Authorization"])
        }

    private fun json(body: String) =
        MockResponse
            .Builder()
            .addHeader("Content-Type", "application/json")
            .body(body)
            .build()
}
