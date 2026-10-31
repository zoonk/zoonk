package com.zoonk.android.feature.subscription

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.data.startOnLoopback
import com.zoonk.api.models.Money
import com.zoonk.api.models.StripeSubscriptionCancellation
import com.zoonk.api.models.StripeSubscriptionCancellationAccountDeletion
import com.zoonk.api.models.StripeSubscriptionCancellationExtraordinary
import com.zoonk.api.models.StripeSubscriptionCancellationRequest.Choice
import com.zoonk.api.models.StripeSubscriptionCancellationWithdrawal
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.util.concurrent.TimeUnit
import kotlin.time.Instant

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
    fun aCancellationSendsOnlyTheChoice() =
        runTest {
            server.enqueue(json("""{"endsAt":"2026-10-31T12:00:00.000Z","receivedAt":"2026-10-31T12:00:00.000Z","refund":null}"""))

            api.cancelWebPlus(ana, Choice.WITHDRAWAL)

            val request = server.takeRequest(5, TimeUnit.SECONDS)!!
            assertEquals("POST", request.method)
            assertEquals("/v1/me/subscriptions/stripe/cancellation", request.url.encodedPath)
            assertEquals(Json.parseToJsonElement("""{"choice":"withdrawal"}"""), Json.parseToJsonElement(request.body!!.utf8()))
        }

    @Test
    fun aStoppedRenewalStillReadsItsRefund() =
        runTest {
            server.enqueue(
                json(
                    """
                    {"accountDeletion":{"refund":{"amount":29.9,"currency":"BRL"}},
                     "canResumeRenewal":true,
                     "cancellation":null,
                     "extraordinary":{"refund":{"amount":19.5,"currency":"BRL"}},
                     "withdrawal":{"refund":{"amount":29.9,"currency":"BRL"},"until":"2026-11-14T12:00:00.000Z"}}
                    """.trimIndent(),
                ),
            )

            assertEquals(
                StripeSubscriptionCancellation(
                    accountDeletion = StripeSubscriptionCancellationAccountDeletion(Money(29.9, "BRL")),
                    canResumeRenewal = true,
                    cancellation = null,
                    extraordinary = StripeSubscriptionCancellationExtraordinary(Money(19.5, "BRL")),
                    withdrawal = StripeSubscriptionCancellationWithdrawal(Money(29.9, "BRL"), Instant.parse("2026-11-14T12:00:00Z")),
                ),
                api.webPlusCancellation(ana),
            )
        }

    @Test
    fun keepingPlusDeletesTheCancellation() =
        runTest {
            server.enqueue(MockResponse.Builder().code(204).build())

            api.keepWebPlus(ana)

            val request = server.takeRequest(5, TimeUnit.SECONDS)!!
            assertEquals("DELETE", request.method)
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
