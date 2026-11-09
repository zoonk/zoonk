package com.zoonk.android.data

import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import mockwebserver3.Dispatcher
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.RecordedRequest
import mockwebserver3.SocketEffect
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.concurrent.CopyOnWriteArrayList

class GenerationEventsTest {
    private val server = MockWebServer()
    private lateinit var api: ApiClients
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val requests = CopyOnWriteArrayList<RecordedRequest>()

    @Volatile private var streams = emptyMap<String, MockResponse>()

    /**
     * Answers gen-1's events from each request's startIndex, as the API does. Other processes on the machine connect to
     * listening ports (an IDE detecting servers), so a response goes by what was asked, never by arrival order.
     */
    @Before
    fun start() {
        server.dispatcher =
            object : Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse {
                    if (request.url.encodedPath != "/v1/generations/gen-1/events") return MockResponse.Builder().code(404).build()
                    requests += request
                    return streams[request.url.queryParameter("startIndex")] ?: MockResponse.Builder().code(404).build()
                }
            }
        server.startOnLoopback()
        api = ApiClients(server.url("/v1/"), apiHttpClient())
    }

    @After
    fun stop() {
        server.close()
    }

    @Test
    fun eventsResumeAfterADroppedConnection() =
        runTest {
            streams =
                mapOf(
                    "0" to events(event("outline", "started"), event("outline", "completed"), drop = true),
                    "2" to events(event("lessons", "started"), drop = true),
                    "3" to events(event("lessons", "completed")),
                )

            val received = api.generationEvents("gen-1", ana).toList()

            assertEquals(
                listOf("outline started", "outline completed", "lessons started", "lessons completed"),
                received.map {
                    "${it.step} ${it.status}"
                },
            )
            assertEquals(listOf("0", "2", "3"), requests.map { it.url.queryParameter("startIndex") })
            assertEquals("Bearer token-a", requests.last().headers["Authorization"])
        }

    @Test
    fun eventsCarryTheSkillNameAGraphJustWrote() =
        runTest {
            streams =
                mapOf("0" to events("""data: {"skillName":"Variables","status":"started","step":"buildSkillGraph"}""" + "\n\n"))

            val received = api.generationEvents("gen-1", ana).toList()

            assertEquals(listOf(GenerationEvent(skillName = "Variables", status = "started", step = "buildSkillGraph")), received)
        }

    @Test
    fun eventsCarryTheGoalsWarmUpDeck() =
        runTest {
            streams =
                mapOf(
                    "0" to
                        events(
                            """data: {"status":"completed","step":"warmUpReady","warmUpId":"019a482c-6a00-7000-8000-000000000001"}""" +
                                "\n\n",
                        ),
                )

            val received = api.generationEvents("gen-1", ana).toList()

            assertEquals(
                listOf(GenerationEvent(status = "completed", step = "warmUpReady", warmUpId = "019a482c-6a00-7000-8000-000000000001")),
                received,
            )
        }

    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    @Test
    fun aReplayedStageUsesTheResponseClockRatherThanTheNewestEventsAge() =
        runTest {
            val serverTime = System.currentTimeMillis() / 1_000 * 1_000 - 5_000
            val started = serverTime - 220_000
            streams =
                mapOf(
                    "0" to
                        events(
                            "data: {\"at\":${started - 8_000},\"status\":\"completed\",\"step\":\"understandGoal\"}\n\n",
                            "data: {\"at\":$started,\"status\":\"started\",\"step\":\"buildSkillGraph\"}\n\n",
                            "data: {\"at\":${started + 31_000},\"status\":\"completed\",\"step\":\"warmUpReady\"}\n\n",
                            date = DateTimeFormatter.RFC_1123_DATE_TIME.format(Instant.ofEpochMilli(serverTime).atZone(ZoneOffset.UTC)),
                        ),
                )
            val replay = api.generationEvents("gen-1", ana).toList()
            val source =
                object : GenerationSource {
                    override fun events(id: String) =
                        flow {
                            replay.forEach { emit(it) }
                            awaitCancellation()
                        }

                    override suspend fun status(id: String) = com.zoonk.api.models.Generation.Status.RUNNING
                }
            val follower = GenerationFollower(GenerationKind.Curriculum, backgroundScope, source)
            follower.follow("gen-1")
            runCurrent()
            val activeSince = GenerationKind.Curriculum.progress(follower.run.value).activeSince!!
            assertEquals(220_000.0, (System.currentTimeMillis() - activeSince).toDouble(), 2_000.0)
            follower.stop()
        }

    @Test
    fun aReconnectUsesItsOwnResponseClockForEveryEvent() =
        runTest {
            val now = System.currentTimeMillis() / 1_000 * 1_000

            fun date(time: Long) = DateTimeFormatter.RFC_1123_DATE_TIME.format(Instant.ofEpochMilli(time).atZone(ZoneOffset.UTC))
            streams =
                mapOf(
                    "0" to events(event("outline", "started"), event("outline", "completed"), drop = true, date = date(now - 5_000)),
                    "2" to events(event("lessons", "started"), date = date(now - 35_000)),
                )
            val received = api.generationEvents("gen-1", ana).toList()
            assertEquals(received[0].clockOffsetMillis, received[1].clockOffsetMillis)
            assertEquals(30_000.0, (received[2].clockOffsetMillis!! - received[0].clockOffsetMillis!!).toDouble(), 2_000.0)
        }

    @Test
    fun eventsGiveUpAfterThreeDropsWithoutAnEvent() =
        runTest {
            streams = mapOf("0" to events(drop = true))
            val failure = runCatching { api.generationEvents("gen-1", ana).toList() }.exceptionOrNull()
            assertEquals(ApiError.Network, (failure as ApiException).error)
            assertEquals(4, requests.size)
        }

    @Test
    fun anUnknownGenerationIsNotFound() =
        runTest {
            val failure = runCatching { api.generationEvents("missing", ana).toList() }.exceptionOrNull()
            assertEquals(ApiError.NotFound, (failure as ApiException).error)
        }

    private fun event(
        step: String,
        status: String,
    ) = """data: {"at":1761650000000,"status":"$status","step":"$step"}""" + "\n\n"

    /** An event stream; a dropped one ends before the length it announced, as a lost connection does. */
    private fun events(
        vararg events: String,
        drop: Boolean = false,
        date: String? = null,
    ): MockResponse {
        val body = events.joinToString("")
        val builder =
            MockResponse
                .Builder()
                .addHeader("Content-Type", "text/event-stream")
                .body(body)
        date?.let { builder.setHeader("Date", it) }
        if (drop) builder.setHeader("Content-Length", body.length + 100).onResponseEnd(SocketEffect.CloseSocket())
        return builder.build()
    }
}
