package com.zoonk.android.data

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
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
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val bia = AuthenticatedSession("bia", "token-b", "local-b")

    @Before
    fun start() {
        server.startOnLoopback()
        api = ApiClients(server.url("/v1/"), apiHttpClient())
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
            val update = buildJsonObject { put("soundsEnabled", true) }

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

    private fun json(body: String) =
        MockResponse
            .Builder()
            .addHeader("Content-Type", "application/json")
            .body(body)
            .build()
}
