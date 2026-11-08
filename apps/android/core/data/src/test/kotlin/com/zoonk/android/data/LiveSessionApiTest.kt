package com.zoonk.android.data

import com.zoonk.android.feature.account.IntegrityTokens
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class LiveSessionApiTest {
    private val server = MockWebServer()
    private val hashes = mutableListOf<String>()

    @Before
    fun start() = server.startOnLoopback()

    @After
    fun stop() = server.close()

    @Test
    fun aRestoreKeyRegistrationProvesItsCredentialIdWithItsOwnChallenge() =
        runTest {
            server.enqueue(
                MockResponse
                    .Builder()
                    .code(201)
                    .addHeader("Content-Type", "application/json")
                    .body("""{"challenge":"ch-1"}""")
                    .build(),
            )
            server.enqueue(MockResponse.Builder().code(204).build())
            val integrity = IntegrityTokens { hash -> "play-token".also { hashes += hash } }
            val api = LiveSessionApi(ApiClients(server.url("/v1/"), apiHttpClient()), integrity)
            val registration = """{"id":"cred-1","rawId":"cred-1","type":"public-key"}"""

            api.registerRestoreKey(AuthenticatedSession("ana", "token-a", "local-a"), registration)

            assertEquals("/v1/app-attest/challenges", server.takeRequest().url.encodedPath)
            // Node's createHash("sha256").update("zoonk-app-attest:1\nch-1\nrestore-key\ncred-1").digest("base64url"), as the API builds it.
            assertEquals(listOf("RcUXp-RZG7EEgoyOpgV-_n4a7-0tuCqkEvJHTT7TyDE"), hashes)
            val request = server.takeRequest()
            assertEquals("/v1/sessions/current/restore-keys", request.url.encodedPath)
            assertEquals("Bearer token-a", request.headers["Authorization"])
            assertEquals("ch-1", request.headers["x-play-integrity-challenge"])
            assertEquals("play-token", request.headers["x-play-integrity-token"])
            val body = Json.parseToJsonElement(request.body!!.utf8()).jsonObject
            assertEquals(registration, body.getValue("registrationResponseJson").jsonPrimitive.content)
        }
}
