package com.zoonk.android.app

import android.content.Context
import io.sentry.Breadcrumb
import io.sentry.SentryOptions
import io.sentry.SpanDataConvention
import io.sentry.android.core.SentryAndroid
import io.sentry.exception.SentryHttpClientException
import io.sentry.protocol.SentrySpan
import java.util.regex.Pattern

/** Starts Sentry in release builds, the only ones that name a DSN. */
internal fun startErrorReporting(context: Context) {
    if (BuildConfig.SENTRY_DSN.isEmpty()) return
    SentryAndroid.init(context) { options ->
        options.dsn = BuildConfig.SENTRY_DSN
        options.configureReporting(apiBaseUrl = BuildConfig.API_BASE_URL)
    }
}

internal fun SentryOptions.configureReporting(apiBaseUrl: String) {
    tracesSampleRate = 0.1
    // The SDK sends trace headers to a URL that contains a target or matches it whole as a regex,
    // so this one is a regex for the API's URLs only.
    setTracePropagationTargets(listOf("^${Pattern.quote(apiBaseUrl)}/.*"))
    // The API reports its own failures. OkHttp's Sentry interceptor, which the plugin adds, has no switch for these events.
    beforeSend = SentryOptions.BeforeSendCallback { event, _ -> event.takeUnless { it.throwable is SentryHttpClientException } }
    // Query strings carry upload credentials, signatures and what learners search for.
    beforeBreadcrumb = SentryOptions.BeforeBreadcrumbCallback { breadcrumb, _ -> breadcrumb.apply { dropQuery() } }
    beforeSendTransaction =
        SentryOptions.BeforeSendTransactionCallback { transaction, _ -> transaction.apply { spans.forEach { it.dropQuery() } } }
}

private val queryKeys = listOf(SpanDataConvention.HTTP_QUERY_KEY, SpanDataConvention.HTTP_FRAGMENT_KEY)

private fun Breadcrumb.dropQuery() {
    queryKeys.forEach(::removeData)
    (getData(URL_KEY) as? String)?.let { setData(URL_KEY, it.withoutQuery()) }
}

private fun SentrySpan.dropQuery() {
    data = data?.minus(queryKeys)?.mapValues { (key, value) -> if (key == URL_KEY && value is String) value.withoutQuery() else value }
}

private fun String.withoutQuery() = substringBefore('#').substringBefore('?')

private const val URL_KEY = "url"
