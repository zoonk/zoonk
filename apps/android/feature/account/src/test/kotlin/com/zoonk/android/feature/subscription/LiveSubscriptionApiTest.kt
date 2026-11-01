package com.zoonk.android.feature.subscription

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.data.startOnLoopback
import com.zoonk.api.models.StripeSubscriptionCancellation.State
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.util.concurrent.TimeUnit

class LiveSubscriptionApiTest {
    private val server = MockWebServer()
    private lateinit var api: LiveSubscriptionApi
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")

    @Before
    fun start() {
        server.startOnLoopback()
        api = LiveSubscriptionApi(ApiClients(server.url("/v1/"), apiHttpClient()))
    }

    @After
    fun stop() = server.close()

    @Test
    fun aCancellationSendsNoBodyAndDecodesItsEndDate() =
        runTest {
            server.enqueue(json("""{"endsAt":"2026-10-31T12:00:00.000Z"}"""))

            val receipt = api.cancelWebPlus(ana)

            val request = server.takeRequest(5, TimeUnit.SECONDS)!!
            assertEquals("POST", request.method)
            assertEquals("/v1/me/subscriptions/stripe/cancellation", request.url.encodedPath)
            assertEquals(0L, request.bodySize)
            assertEquals("Bearer token-a", request.headers["Authorization"])
            assertEquals("2026-10-31T12:00:00Z", receipt.endsAt.toString())
        }

    @Test
    fun allWebsiteStatesDecodeFromTheFinalContract() =
        runTest {
            State.entries.forEach { state ->
                val periodEnd = if (state == State.UNPAID) "null" else "\"2026-12-01T12:00:00Z\""
                server.enqueue(json("""{"state":"${state.value}","periodEnd":$periodEnd}"""))

                val subscription = api.websiteSubscription(ana)
                assertEquals(state, subscription.state)
                assertEquals(if (state == State.UNPAID) null else "2026-12-01T12:00:00Z", subscription.periodEnd?.toString())
                val request = server.takeRequest(5, TimeUnit.SECONDS)!!
                assertEquals("GET", request.method)
                assertEquals("/v1/me/subscriptions/stripe/cancellation", request.url.encodedPath)
                assertEquals("Bearer token-a", request.headers["Authorization"])
            }
        }

    @Test
    fun aGuestOrMissingPlanReturnsNotFoundAndAnExpiredSessionIsUnauthorized() =
        runTest {
            for ((code, expected) in listOf(404 to ApiError.NotFound, 401 to ApiError.Unauthorized)) {
                server.enqueue(
                    MockResponse
                        .Builder()
                        .code(code)
                        .body("""{"error":{"code":"ERROR","message":"Unavailable"}}""")
                        .build(),
                )
                val error =
                    try {
                        api.websiteSubscription(ana)
                        error("Expected an API failure")
                    } catch (error: ApiException) {
                        error
                    }
                assertEquals(expected, error.error)
                assertEquals(code, error.status)
            }
        }

    @Test
    fun keepingPlusDeletesTheCancellation() =
        runTest {
            server.enqueue(MockResponse.Builder().code(204).build())

            api.keepWebPlus(ana)

            val request = server.takeRequest(5, TimeUnit.SECONDS)!!
            assertEquals("DELETE", request.method)
            assertEquals(0L, request.bodySize)
            assertEquals("/v1/me/subscriptions/stripe/cancellation", request.url.encodedPath)
            assertEquals("Bearer token-a", request.headers["Authorization"])
        }

    private fun json(body: String) =
        MockResponse
            .Builder()
            .code(200)
            .addHeader("Content-Type", "application/json")
            .body(body)
            .build()
}
