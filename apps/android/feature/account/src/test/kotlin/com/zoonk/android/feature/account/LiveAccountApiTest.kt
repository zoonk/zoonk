package com.zoonk.android.feature.account

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.data.startOnLoopback
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

    @Before
    fun start() {
        server.startOnLoopback()
        api = LiveAccountApi(ApiClients(server.url("/v1/"), apiHttpClient()))
    }

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
    fun signInCallsSendNoProofOrChallengeAndKeepTheGuestsBearerForSignIn() =
        runTest {
            server.enqueue(json("""{"token":"guest-token"}"""))
            server.enqueue(MockResponse.Builder().code(204).build())
            server.enqueue(json("""{"token":"ana-token"}"""))

            assertEquals("guest-token", api.guest())
            api.sendEmailCode("Ana@zoonk.test")
            assertEquals("ana-token", api.emailSession("Ana@zoonk.test", "123456", ana))

            assertEquals(3, server.requestCount)
            val guest = server.takeRequest()
            val code = server.takeRequest()
            val session = server.takeRequest()
            assertEquals("/v1/guests", guest.url.encodedPath)
            assertEquals("/v1/email-sign-in-codes", code.url.encodedPath)
            assertEquals("/v1/sessions/email-code", session.url.encodedPath)
            assertNull(guest.headers["Authorization"])
            assertNull(code.headers["Authorization"])
            assertEquals("Bearer token-a", session.headers["Authorization"])
            assertEquals("""{"email":"Ana@zoonk.test"}""", code.body!!.utf8())
            assertEquals("""{"code":"123456","email":"Ana@zoonk.test"}""", session.body!!.utf8())
            for (request in listOf(guest, code, session)) {
                assertEquals("POST", request.method)
                assertNull(request.headers["x-play-integrity-token"])
                assertNull(request.headers["x-play-integrity-challenge"])
            }
        }

    private fun json(body: String) =
        MockResponse
            .Builder()
            .code(200)
            .addHeader("Content-Type", "application/json")
            .body(body)
            .build()
}
