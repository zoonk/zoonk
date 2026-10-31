package com.zoonk.android.data

import androidx.compose.ui.test.junit4.ComposeContentTestRule
import mockwebserver3.Dispatcher
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.RecordedRequest
import java.util.concurrent.ConcurrentHashMap
import kotlin.time.Duration.Companion.seconds

/** The API on loopback, answering each path in [bodies] (any other with 404) and counting every request by path. */
internal class CountingApi(
    private val bodies: Map<String, String>,
) : AutoCloseable {
    private val server = MockWebServer()
    private val counts = ConcurrentHashMap<String, Int>()

    val clients: ApiClients

    init {
        server.dispatcher =
            object : Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse {
                    val path = request.url.encodedPath.removePrefix("/v1")
                    counts.merge(path, 1, Int::plus)
                    val body = bodies[path] ?: return response(404, """{"error":{"code":"NOT_FOUND","message":"No"}}""")
                    return response(200, body)
                }
            }
        server.startOnLoopback()
        clients = ApiClients(server.url("/v1/"), apiHttpClient())
    }

    fun requests(path: String): Int = counts[path] ?: 0

    override fun close() = server.close()

    private fun response(
        code: Int,
        body: String,
    ) = MockResponse
        .Builder()
        .code(code)
        .addHeader("Content-Type", "application/json")
        .body(body)
        .build()
}

/** Idles the UI until [condition] holds; unlike `waitUntil`, it gives a request the real time its answer takes. */
internal fun ComposeContentTestRule.waitFor(condition: () -> Boolean) {
    val deadline = System.nanoTime() + 5.seconds.inWholeNanoseconds
    while (!condition()) {
        check(System.nanoTime() < deadline) { "Still waiting after 5 s" }
        Thread.sleep(10)
        waitForIdle()
    }
}

/** Lets what the last change composed start its reads, then waits until [reads] hold content and none is refreshing. */
internal fun ComposeContentTestRule.settle(vararg reads: Resource<*>) {
    waitForIdle()
    waitFor { reads.all { it.state.value.hasContent && !it.isRefreshing.value } }
}
