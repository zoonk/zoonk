package com.zoonk.android.data

import com.zoonk.android.feature.mistakes.LiveMistakesApi
import com.zoonk.android.feature.mistakes.PracticeKey
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.concurrent.TimeUnit

class MistakePracticeApiTest {
    @Test
    fun practiceOptsIntoEveryOriginalQuestionFormatOnTheWire() =
        runTest {
            MockWebServer().use { server ->
                server.startOnLoopback()
                server.enqueue(
                    MockResponse
                        .Builder()
                        .addHeader("Content-Type", "application/json")
                        .body("""{"practice":[],"trueFalseLabels":"trueFalse"}""")
                        .build(),
                )
                val api = LiveMistakesApi(ApiClients(server.url("/v1/"), apiHttpClient()))
                api.practice(AuthenticatedSession("ana", "token", "local"), PracticeKey(null, null), "UTC")
                val request = requireNotNull(server.takeRequest(5, TimeUnit.SECONDS))
                assertEquals("true", request.url.queryParameter("includeAllFormats"))
            }
        }
}
