package com.zoonk.android.data

import okhttp3.Interceptor
import okhttp3.Response
import kotlin.time.TimeSource

/** Never logs headers or bodies: they carry the bearer and learner data. */
class RequestLog(
    private val log: (String) -> Unit,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val started = TimeSource.Monotonic.markNow()
        val line = "${request.method} ${request.url.encodedPath}"
        return try {
            chain.proceed(request).also { log("$line ${it.code} ${started.elapsedNow().inWholeMilliseconds}ms") }
        } catch (e: java.io.IOException) {
            log("$line failed ${started.elapsedNow().inWholeMilliseconds}ms ${e.javaClass.simpleName}")
            throw e
        }
    }
}
