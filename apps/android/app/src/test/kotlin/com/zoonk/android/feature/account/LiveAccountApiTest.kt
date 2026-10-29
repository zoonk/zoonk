package com.zoonk.android.feature.account

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.apiHttpClient
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class LiveAccountApiTest {
    private val server = MockWebServer()
    private lateinit var api: LiveAccountApi
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val hashes = mutableListOf<String>()
    private var token: String? = "play-token"

    @Before
    fun start() {
        server.start()
        api = api(IntegrityTokens { hash -> token.also { hashes += hash } })
    }

    private fun api(integrity: IntegrityTokens?) = LiveAccountApi(ApiClients(server.url("/v1/"), apiHttpClient()), integrity)

    @After
    fun stop() = server.close()

    @Test
    fun deletingSendsTheBearerAndTheEmailCodeOnlyWhenThereIsOne() =
        runTest {
            server.enqueue(json("""{"appleAuthorizationRevoked":null}"""))
            server.enqueue(json("""{"appleAuthorizationRevoked":false}"""))

            assertNull(api.deleteAccount(ana, emailCode = null, email = "ana@zoonk.test"))
            assertEquals(false, api.deleteAccount(ana, emailCode = "123456", email = "ana@zoonk.test"))

            val plain = server.takeRequest()
            assertEquals("DELETE", plain.method)
            assertEquals("/v1/me", plain.url.encodedPath)
            assertEquals("Bearer token-a", plain.headers["Authorization"])
            assertEquals("{}", plain.body!!.utf8())
            assertEquals("""{"emailCredentials":{"email":"ana@zoonk.test","otp":"123456"}}""", server.takeRequest().body!!.utf8())
        }

    @Test
    fun aGuestProvesItsRequestWithATokenForAFreshChallenge() =
        runTest {
            server.enqueue(json("""{"challenge":"ch-1"}"""))
            server.enqueue(json("""{"token":"guest-token"}"""))

            api.guest()

            val challenge = server.takeRequest()
            assertEquals("POST", challenge.method)
            assertEquals("/v1/app-attest/challenges", challenge.url.encodedPath)
            // Node's createHash("sha256").update("zoonk-app-attest:1\nch-1\nguest").digest("base64url"), as the API builds it.
            assertEquals(listOf("xAqB2QzkTXZyIv76C-GYdUELQ5M9x7ZBMxq5eqj_4UM"), hashes)
            val guest = server.takeRequest()
            assertEquals("/v1/guests", guest.url.encodedPath)
            assertEquals("play-token", guest.headers["x-play-integrity-token"])
            assertEquals("ch-1", guest.headers["x-play-integrity-challenge"])
        }

    @Test
    fun anEmailSessionBindsTheEmailAndCodeItSendsAndKeepsTheGuestsBearer() =
        runTest {
            server.enqueue(json("""{"challenge":"ch-1"}"""))
            server.enqueue(json("""{"token":"ana-token"}"""))

            api.emailSession("Ana@zoonk.test", "123456", ana)

            server.takeRequest()
            assertEquals(listOf("xBn6QTf1gdiuvY-NUbCVunnMDlu_ecMuxn1rm2n7RAA"), hashes)
            val session = server.takeRequest()
            assertEquals("Bearer token-a", session.headers["Authorization"])
            assertEquals("ch-1", session.headers["x-play-integrity-challenge"])
            assertEquals("play-token", session.headers["x-play-integrity-token"])
        }

    @Test
    fun withoutATokenTheRequestGoesWithoutProof() =
        runTest {
            token = null
            server.enqueue(json("""{"challenge":"ch-1"}"""))
            server.enqueue(MockResponse.Builder().code(204).build())
            server.enqueue(MockResponse.Builder().code(500).build())
            server.enqueue(MockResponse.Builder().code(204).build())

            api.sendEmailCode("ana@zoonk.test")
            api.sendEmailCode("ana@zoonk.test")

            server.takeRequest()
            assertNull(server.takeRequest().headers["x-play-integrity-token"])
            assertEquals("/v1/app-attest/challenges", server.takeRequest().url.encodedPath)
            val unproven = server.takeRequest()
            assertEquals("/v1/email-sign-in-codes", unproven.url.encodedPath)
            assertNull(unproven.headers["x-play-integrity-challenge"])
        }

    @Test
    fun withoutPlayIntegrityNoChallengeIsSpent() =
        runTest {
            server.enqueue(json("""{"token":"guest-token"}"""))

            api(integrity = null).guest()

            assertEquals("/v1/guests", server.takeRequest().url.encodedPath)
        }

    private fun json(body: String) =
        MockResponse
            .Builder()
            .code(200)
            .addHeader("Content-Type", "application/json")
            .body(body)
            .build()
}
