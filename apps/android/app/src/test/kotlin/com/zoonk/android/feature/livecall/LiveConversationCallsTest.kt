package com.zoonk.android.feature.livecall

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.apiHttpClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import mockwebserver3.Dispatcher
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.util.UUID
import java.util.concurrent.TimeUnit

class LiveConversationCallsTest {
    private val server = MockWebServer()
    private val conversation = UUID.fromString("00000000-0000-4000-8000-0000000000c1")
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val bia = AuthenticatedSession("bia", "token-b", "local-b")
    private val session = FakeSession(ana)

    @Before
    fun start() = server.start()

    @After
    fun stop() = server.close()

    @Test
    fun aReservationThatComesBackAfterAnotherSignInIsEndedUnderItsOwnLearner() =
        runBlocking {
            server.dispatcher =
                object : Dispatcher() {
                    override fun dispatch(request: RecordedRequest): MockResponse {
                        if (request.url.encodedPath.endsWith("/connections")) {
                            session.session = bia
                            return MockResponse
                                .Builder()
                                .code(201)
                                .body(SETUP)
                                .build()
                        }
                        return MockResponse
                            .Builder()
                            .code(200)
                            .body("""{"status":"closed","endReason":"learner"}""")
                            .build()
                    }
                }
            val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Unconfined))
            val calls = LiveConversationCalls(conversation, ApiClients(server.url("/v1/"), apiHttpClient()), cache)

            assertEquals(CallReservation.Failed, calls.connect(takeover = false))

            server.takeRequest(1, TimeUnit.SECONDS)
            val end = server.takeRequest(1, TimeUnit.SECONDS)
            assertEquals("/v1/language-conversations/$conversation/connections/$CONNECTION/end", end?.url?.encodedPath)
            assertEquals("Bearer token-a", end?.headers?.get("Authorization"))
        }

    private companion object {
        val SETUP =
            """
            {"connectionId":"$CONNECTION","deadlineAt":"2026-10-29T12:05:00Z","endsAtLimit":null,"seconds":300,"sessionUrl":"","voice":"marin"}
            """.trimIndent()
    }
}
