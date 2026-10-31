package com.zoonk.android.data

import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.Request
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.net.InetAddress

class LoopbackServerTest {
    @Test
    fun aRequestReachesItsOwnServerWhenAnotherHoldsThePortOverIpv6() {
        MockWebServer().use { server ->
            server.startOnLoopback()
            MockWebServer().use { other ->
                assumeTrue("Needs IPv6 loopback", runCatching { other.start(InetAddress.getByName("::1"), server.port) }.isSuccess)
                server.enqueue(MockResponse.Builder().body("this test's").build())
                other.enqueue(MockResponse.Builder().body("another process's").build())

                val body = apiHttpClient().newCall(Request.Builder().url(server.url("/")).build()).execute().use { it.body.string() }

                assertEquals("this test's", body)
                assertEquals(0, other.requestCount)
            }
        }
    }
}
