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

    @Before
    fun start() {
        server.start()
        api = LiveAccountApi(ApiClients(server.url("/v1/"), apiHttpClient()), NoBotProof)
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

    private fun json(body: String) =
        MockResponse
            .Builder()
            .code(200)
            .addHeader("Content-Type", "application/json")
            .body(body)
            .build()
}
