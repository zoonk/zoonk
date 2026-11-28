package com.zoonk.android.feature.activities.code

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.data.startOnLoopback
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitTier
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import mockwebserver3.Dispatcher
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.RecordedRequest
import mockwebserver3.SocketEffect
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.CopyOnWriteArrayList

class CodeRunsTest {
    private val server = MockWebServer()
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val session = FakeSession(ana)
    private val requests = CopyOnWriteArrayList<RecordedRequest>()
    private val responses = ConcurrentLinkedQueue<MockResponse>()
    private val requestId = UUID.fromString("0b5c8f8e-4a59-4f4f-9a43-4f1f7d4a6f10")
    private lateinit var api: ApiClients

    /** Core's stream for one run that compiled and printed "hello", shared with web and iOS. */
    private val fixture =
        Json
            .parseToJsonElement(File(requireNotNull(System.getProperty("zoonk.codeRunEvents"))).readText())
            .jsonPrimitive
            .content

    private val fixtureResult = fixture.split("\n\n").first { it.startsWith("event: result") } + "\n\n"

    /** Answers each run with the next response; other processes on the machine connecting to the port get a 404. */
    @Before
    fun start() {
        server.dispatcher =
            object : Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse {
                    if (request.url.encodedPath != "/v1/code-runs") return MockResponse.Builder().code(404).build()
                    requests += request
                    return responses.poll() ?: MockResponse.Builder().code(500).build()
                }
            }
        server.startOnLoopback()
        api = ApiClients(server.url("/v1/"), apiHttpClient())
    }

    @After
    fun stop() {
        server.close()
    }

    private fun TestScope.runs() = LiveCodeRuns(api, AppCache(session, backgroundScope))

    private suspend fun TestScope.run(code: String = "class Main {}") = runs().run(requestId, CodeLanguage.Java, code).toList()

    @Test
    fun aRunStreamsHowFarItGotThenWhatItPrinted() =
        runTest {
            responses += stream(fixture)

            val updates = run("class Main { }")

            assertEquals(
                listOf(CodeRunPhase.Starting, CodeRunPhase.Compiling, CodeRunPhase.Running),
                updates.filterIsInstance<CodeRunUpdate.Phase>().map { it.phase },
            )
            assertEquals(
                MutationResult.Done(
                    ProgramRun(
                        error = null,
                        errorOutput = "",
                        output = "hello\n",
                        stop = ProgramStop.Done,
                        runId = "ec8eedd5-7adf-48aa-b686-ed38e40340b5",
                    ),
                ),
                (updates.last() as CodeRunUpdate.Ended).result,
            )
            val request = requests.single()
            val body = Json.parseToJsonElement(request.body!!.utf8()).jsonObject
            assertEquals("POST", request.method)
            assertEquals("Bearer token-a", request.headers["Authorization"])
            assertEquals("java", body.getValue("language").jsonPrimitive.content)
            assertEquals(requestId.toString(), body.getValue("requestId").jsonPrimitive.content)
            assertEquals("class Main { }", body.getValue("code").jsonPrimitive.content)
        }

    @Test
    fun aReplayedRunSendsOnlyItsResult() =
        runTest {
            responses += stream(fixtureResult)

            val updates = run()

            assertEquals(1, updates.size)
            assertEquals("hello\n", ((updates.single() as CodeRunUpdate.Ended).result as MutationResult.Done).value.output)
        }

    @Test
    fun everyStopReadsAsADeviceRunDoes() =
        runTest {
            val stops =
                mapOf(
                    "done" to ProgramStop.Done,
                    "error" to ProgramStop.Error,
                    "timeout" to ProgramStop.Timeout,
                    "tooMuchOutput" to ProgramStop.TooMuchOutput,
                    "unavailable" to ProgramStop.Unavailable,
                )

            stops.forEach { (stop, expected) ->
                val error = if (stop == "error") """{"line":3,"message":"';' expected"}""" else "null"
                responses += stream(result(stop, error))

                val run = (finished(run()) as MutationResult.Done).value

                assertEquals(expected, run.stop)
                assertEquals(if (stop == "error") ProgramError(3, "';' expected") else null, run.error)
            }
        }

    @Test
    fun anErrorWithoutALineKeepsItsMessage() =
        runTest {
            responses += stream(result("error", """{"line":null,"message":"Killed"}"""))

            assertEquals(ProgramError(null, "Killed"), (finished(run()) as MutationResult.Done).value.error)
        }

    @Test
    fun refusalsReadAsTheLimitsTheAppShows() =
        runTest {
            responses += refusal(403, "SIGN_UP_REQUIRED")
            responses += refusal(402, "USAGE_LIMIT_REACHED", """{"limit":{"tier":"free"}}""")
            responses += refusal(403, "USAGE_LIMIT_REACHED", """{"limit":{"tier":"guest"}}""")
            responses += refusal(429, "USAGE_LIMIT_REACHED", """{"limit":{"tier":"plus"}}""")
            responses += refusal(429, "SLOW_DOWN", """{"retryAfterSeconds":30}""")

            val limits = List(5) { Limit.of(finished(run()) as MutationResult.Failed) }

            assertEquals(Limit.SignUpRequired, limits[0])
            assertEquals(listOf(LimitTier.Free, LimitTier.Guest, LimitTier.Plus), limits.slice(1..3).map { (it as Limit.Reached).tier })
            assertEquals(30, (limits[4] as Limit.SlowDown).retryAfterSeconds)
        }

    @Test
    fun aRefusedRequestShowsNoLimitAndAnExpiredSessionEndsIt() =
        runTest {
            responses += refusal(400, "VALIDATION_ERROR")
            val invalid = finished(run()) as MutationResult.Failed
            assertEquals(ApiError.Unavailable, invalid.error)
            assertEquals(null, Limit.of(invalid))

            responses += refusal(401, "UNAUTHORIZED")
            assertEquals(MutationResult.Obsolete, finished(run()))
            assertEquals(listOf(ana), session.expired)
        }

    @Test
    fun aRunAlreadyGoingIsAskedAgainWithTheSameRequestUntilItsTurn() =
        runTest {
            responses += refusal(409, "ALREADY_RUNNING")
            responses += refusal(409, "ALREADY_RUNNING")
            responses += stream(fixtureResult)

            assertEquals("hello\n", (finished(run()) as MutationResult.Done).value.output)
            assertEquals(3, requests.size)
            assertEquals(
                setOf(requestId.toString()),
                requests
                    .map {
                        Json
                            .parseToJsonElement(it.body!!.utf8())
                            .jsonObject
                            .getValue("requestId")
                            .jsonPrimitive.content
                    }.toSet(),
            )
        }

    @Test
    fun aDroppedStreamIsALostConnection() =
        runTest {
            responses += stream("event: phase\ndata: {\"phase\":\"starting\"}\n\n", drop = true)

            val updates = run()

            assertEquals(CodeRunUpdate.Phase(CodeRunPhase.Starting), updates.first())
            assertEquals(ApiError.Network, (finished(updates) as MutationResult.Failed).error)
        }

    @Test
    fun aStreamThatEndsWithoutAResultBrokeOffOnTheWay() =
        runTest {
            responses += stream("event: phase\ndata: {\"phase\":\"running\"}\n\n")

            assertEquals(ApiError.Network, (finished(run()) as MutationResult.Failed).error)
        }

    @Test
    fun aResultThisBuildCantReadDidntRun() =
        runTest {
            responses += stream("event: result\ndata: {\"stop\":\"done\"}\n\n")

            assertEquals(ApiError.Unavailable, (finished(run()) as MutationResult.Failed).error)
        }

    @Test
    fun aStageThisBuildDoesntKnowIsSkipped() =
        runTest {
            responses += stream("event: phase\ndata: {\"phase\":\"linking\"}\n\n$fixtureResult")

            val updates = run()

            assertTrue(updates.single() is CodeRunUpdate.Ended)
        }

    private fun finished(updates: List<CodeRunUpdate>) = (updates.last() as CodeRunUpdate.Ended).result

    private fun result(
        stop: String,
        error: String,
    ) = "event: result\ndata: {\"error\":$error,\"errorOutput\":\"\",\"output\":\"\",\"runId\":\"$requestId\",\"stop\":\"$stop\"}\n\n"

    /** An event stream; a dropped one ends before the length it announced, as a lost connection does. */
    private fun stream(
        body: String,
        drop: Boolean = false,
    ): MockResponse {
        val builder =
            MockResponse
                .Builder()
                .addHeader("Content-Type", "text/event-stream")
                .body(body)
        if (drop) builder.setHeader("Content-Length", body.length + 100).onResponseEnd(SocketEffect.CloseSocket())
        return builder.build()
    }

    private fun refusal(
        status: Int,
        code: String,
        details: String? = null,
    ) = MockResponse
        .Builder()
        .code(status)
        .addHeader("Content-Type", "application/json")
        .body("""{"error":{"code":"$code","message":"Refused"${details?.let { ",\"details\":$it" }.orEmpty()}}}""")
        .build()
}
