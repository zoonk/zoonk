package com.zoonk.android.data

import com.zoonk.android.feature.player.LessonStart
import com.zoonk.android.feature.player.LiveLessonPlayerApi
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LessonStartApiTest {
    @Test
    fun startsDecodeBothSuccessStatuses() =
        runTest {
            MockWebServer().use { server ->
                server.startOnLoopback()
                val api = LiveLessonPlayerApi(ApiClients(server.url("/v1/"), apiHttpClient()))
                val session = AuthenticatedSession("ana", "token", "local")
                val id = "00000000-0000-4000-8000-0000000000aa"
                server.enqueue(
                    MockResponse
                        .Builder()
                        .code(200)
                        .addHeader("Content-Type", "application/json")
                        .body("""{"status":"opened","opening":{"kind":"today"}}""")
                        .build(),
                )
                assertTrue(api.start(session, id, null, null) is LessonStart.Opened)
                server.enqueue(
                    MockResponse
                        .Builder()
                        .code(201)
                        .addHeader("Content-Type", "application/json")
                        .body(
                            """{"answers":[],"hyperdrive":{"knownStepIds":[],"streak":0},"optionalStepIds":[],
                    "runId":"$id","sessionId":"$id","replay":false,"startedAt":"2026-10-28T10:00:00Z","support":null}
                """,
                        ).build(),
                )
                val started = api.start(session, id, null, null) as LessonStart.Started
                assertEquals(id, started.run.sessionId.toString())
            }
        }
}
