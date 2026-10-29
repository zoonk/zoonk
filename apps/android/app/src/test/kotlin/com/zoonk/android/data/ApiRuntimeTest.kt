package com.zoonk.android.data

import com.zoonk.api.models.LearningProfileUpdate
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.SocketEffect
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import kotlin.coroutines.cancellation.CancellationException

class ApiRuntimeTest {
    private val server = MockWebServer()
    private lateinit var api: ApiClients
    private val log = mutableListOf<String>()
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val bia = AuthenticatedSession("bia", "token-b", "local-b")

    @Before
    fun start() {
        server.start()
        api = ApiClients(server.url("/v1/"), apiHttpClient { addInterceptor(RequestLog { log += it }) })
    }

    @After
    fun stop() {
        server.close()
    }

    @Test
    fun appleExchangeSendsTheWebClientRawNonceAndOnlyTheStartingGuestBearer() =
        runTest {
            val request =
                com.zoonk.api.models.AppleSessionRequest(
                    authorizationCode = "code",
                    idToken = "id-token",
                    nonce = "raw-nonce",
                    client = com.zoonk.api.models.AppleSessionRequest.Client.WEB,
                )
            for (guest in listOf(ana, null)) {
                server.enqueue(json("""{"token":"new-token"}"""))
                assertEquals("new-token", LiveSessionApi(api).apple(request, guest))
                val sent = server.takeRequest()
                assertEquals("POST", sent.method)
                assertEquals("/v1/sessions/apple", sent.url.encodedPath)
                assertEquals(guest?.let { "Bearer ${it.bearerToken}" }, sent.headers["Authorization"])
                val body =
                    com.zoonk.api.ApiJson
                        .decodeFromString<com.zoonk.api.models.AppleSessionRequest>(sent.body!!.utf8())
                assertEquals(request, body)
            }
        }

    @Test
    fun eachRequestCarriesTheTokenOfTheSessionItWasMadeFor() =
        runTest {
            repeat(3) { server.enqueue(MockResponse.Builder().code(204).build()) }
            perform { api.clients(ana).sessions.deleteCurrentSession() }
            perform { api.clients(bia).sessions.deleteCurrentSession() }
            perform { api.clients(null).sessions.deleteCurrentSession() }
            assertEquals("Bearer token-a", server.takeRequest().headers["Authorization"])
            assertEquals("Bearer token-b", server.takeRequest().headers["Authorization"])
            val signedOut = server.takeRequest()
            assertNull(signedOut.headers["Authorization"])
            assertEquals(
                java.util.Locale
                    .getDefault()
                    .toLanguageTag(),
                signedOut.headers["Accept-Language"],
            )
        }

    @Test
    fun failuresMapToWhatScreensRecoverFrom() =
        runTest {
            server.enqueue(MockResponse.Builder().code(401).build())
            server.enqueue(MockResponse.Builder().code(404).build())
            server.enqueue(
                MockResponse
                    .Builder()
                    .code(429)
                    .body("""{"error":{"code":"SLOW_DOWN","message":"Slow down","details":{"retryAfterSeconds":30}}}""")
                    .build(),
            )
            server.enqueue(json("""{"profile":"not an object"}"""))
            val update = LearningProfileUpdate(soundsEnabled = true)

            suspend fun fail() =
                runCatching { perform { api.clients(ana).account.updateCurrentUserLearningProfile(update) } }
                    .exceptionOrNull() as ApiException

            assertEquals(ApiError.Unauthorized, fail().error)
            assertEquals(ApiError.NotFound, fail().error)
            val limited = fail()
            assertEquals(ApiError.Unavailable, limited.error)
            assertEquals("SLOW_DOWN", limited.code)
            assertEquals(429, limited.status)
            assertEquals(
                "30",
                limited.details
                    ?.jsonObject
                    ?.get("retryAfterSeconds")
                    ?.jsonPrimitive
                    ?.content,
            )
            assertEquals(ApiError.Unavailable, fail().error)

            server.close()
            assertEquals(ApiError.Network, fail().error)
        }

    @Test
    fun cancellationIsNeverAFailure() {
        assertThrows(CancellationException::class.java) {
            kotlinx.coroutines.runBlocking { perform<Unit> { throw CancellationException("left the screen") } }
        }
    }

    @Test
    fun generationEventsResumeAfterADroppedConnection() =
        runTest {
            server.enqueue(events(event("outline", "started"), event("outline", "completed"), drop = true))
            server.enqueue(events(event("lessons", "started"), drop = true))
            server.enqueue(events(event("lessons", "completed")))

            val received = api.generationEvents("gen-1", ana).toList()

            assertEquals(
                listOf("outline started", "outline completed", "lessons started", "lessons completed"),
                received.map {
                    "${it.step} ${it.status}"
                },
            )
            val targets = List(3) { server.takeRequest() }
            assertEquals(listOf("0", "2", "3"), targets.map { it.url.queryParameter("startIndex") })
            assertEquals("Bearer token-a", targets.last().headers["Authorization"])
        }

    @Test
    fun generationEventsGiveUpAfterThreeDropsWithoutAnEvent() =
        runTest {
            repeat(4) { server.enqueue(events(drop = true)) }
            val failure = runCatching { api.generationEvents("gen-1", ana).toList() }.exceptionOrNull()
            assertEquals(ApiError.Network, (failure as ApiException).error)
            assertEquals(4, server.requestCount)
        }

    @Test
    fun anUnknownGenerationIsNotFound() =
        runTest {
            server.enqueue(MockResponse.Builder().code(404).build())
            val failure = runCatching { api.generationEvents("missing", ana).toList() }.exceptionOrNull()
            assertEquals(ApiError.NotFound, (failure as ApiException).error)
        }

    @Test
    fun theRequestLogNamesMethodPathStatusAndTime() =
        runTest {
            server.enqueue(MockResponse.Builder().code(204).build())
            perform { api.clients(ana).sessions.deleteCurrentSession() }
            assertEquals(1, log.size)
            assert(Regex("""DELETE /v1/sessions/current 204 \d+ms""").matches(log.single())) { log.single() }
        }

    @Test
    fun aNullBodyReadsAsNothingYetAndAThreadAsItself() =
        runTest {
            val goal = java.util.UUID.randomUUID()
            server.enqueue(json("null"))
            server.enqueue(
                json("""{"hasMore":false,"id":"${java.util.UUID.randomUUID()}","lessonId":null,"nextCursor":null,"questions":[]}"""),
            )

            assertNull(performOrNull { api.clients(ana).plans.getPlanQuestionThread(goal) })
            assertEquals(false, performOrNull { api.clients(ana).plans.getPlanQuestionThread(goal) }?.hasMore)
        }

    @Test
    fun anEnumQueryGoesByTheContractsName() =
        runTest {
            server.enqueue(json("null"))
            performOrNull {
                api.clients(ana).plans.getPlanQuestionThread(
                    java.util.UUID.randomUUID(),
                    contextKind = com.zoonk.api.apis.PlansApi.ContextKindGetPlanQuestionThread.PLAN,
                )
            }
            assertEquals("plan", server.takeRequest().url.queryParameter("contextKind"))
        }

    private fun json(body: String) =
        MockResponse
            .Builder()
            .addHeader("Content-Type", "application/json")
            .body(body)
            .build()

    private fun event(
        step: String,
        status: String,
    ) = """data: {"at":1761650000000,"status":"$status","step":"$step"}""" + "\n\n"

    /** An event stream; a dropped one ends before the length it announced, as a lost connection does. */
    private fun events(
        vararg events: String,
        drop: Boolean = false,
    ): MockResponse {
        val body = events.joinToString("")
        val builder =
            MockResponse
                .Builder()
                .addHeader("Content-Type", "text/event-stream")
                .body(body)
        if (drop) builder.setHeader("Content-Length", body.length + 100).onResponseEnd(SocketEffect.CloseSocket())
        return builder.build()
    }
}
