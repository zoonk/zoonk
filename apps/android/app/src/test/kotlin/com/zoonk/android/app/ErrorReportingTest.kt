package com.zoonk.android.app

import io.sentry.Breadcrumb
import io.sentry.Hint
import io.sentry.SentryOptions
import io.sentry.SpanId
import io.sentry.SpanStatus
import io.sentry.protocol.SentryId
import io.sentry.protocol.SentrySpan
import io.sentry.protocol.SentryTransaction
import io.sentry.protocol.TransactionInfo
import io.sentry.util.PropagationTargetsUtils
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ErrorReportingTest {
    private val options = SentryOptions().apply { configureReporting(apiBaseUrl = "https://api.zoonk.com") }

    @Test
    fun breadcrumbsKeepThePathWithoutTheQueryOrFragment() {
        val request = Breadcrumb.http("https://api.zoonk.com/v1/search?q=fractions&token=secret#top", "GET", 200)
        assertEquals(mapOf("url" to "https://api.zoonk.com/v1/search", "method" to "GET", "status_code" to 200), sent(request)?.data)

        val clip = Breadcrumb().apply { setData("url", "https://files.example.com/clip.mp3?signature=secret#t=1") }
        assertEquals(mapOf("url" to "https://files.example.com/clip.mp3"), sent(clip)?.data)
    }

    @Test
    fun spansKeepThePathWithoutTheQueryOrFragment() {
        val request =
            span(
                "url" to "https://api.zoonk.com/v1/search",
                "http.query" to "q=fractions&token=secret",
                "http.fragment" to "top",
                "http.response.status_code" to 200,
            )
        val clip = span("url" to "https://files.example.com/clip.mp3?signature=secret#t=1")
        val transaction = SentryTransaction("MainActivity", 0.0, 1.0, listOf(request, clip), mutableMapOf(), TransactionInfo("component"))

        assertEquals(
            listOf(
                mapOf("url" to "https://api.zoonk.com/v1/search", "http.response.status_code" to 200),
                mapOf("url" to "https://files.example.com/clip.mp3"),
            ),
            sent(transaction)?.spans?.map { it.data },
        )
    }

    @Test
    fun traceHeadersGoOnlyToTheApi() {
        val targets = options.tracePropagationTargets
        assertTrue(PropagationTargetsUtils.contain(targets, "https://api.zoonk.com/v1/me"))
        assertFalse(PropagationTargetsUtils.contain(targets, "https://api.zoonk.com.example.com/v1/me"))
        assertFalse(PropagationTargetsUtils.contain(targets, "https://files.example.com/a.png?from=https://api.zoonk.com/v1"))
    }

    private fun sent(breadcrumb: Breadcrumb) =
        options.beforeBreadcrumb.let { if (it == null) breadcrumb else it.execute(breadcrumb, Hint()) }

    private fun sent(transaction: SentryTransaction) =
        options.beforeSendTransaction.let { if (it == null) transaction else it.execute(transaction, Hint()) }

    private fun span(vararg data: Pair<String, Any>) =
        SentrySpan(
            0.0,
            1.0,
            SentryId(),
            SpanId(),
            null,
            "http.client",
            null,
            SpanStatus.OK,
            null,
            mutableMapOf(),
            mutableMapOf(),
            mutableMapOf(*data),
        )
}
