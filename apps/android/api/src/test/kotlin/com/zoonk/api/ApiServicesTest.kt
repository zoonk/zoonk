package com.zoonk.api

import com.zoonk.api.models.GetChapterTestOut200Response
import com.zoonk.api.models.LanguageConversationStartInput
import com.zoonk.api.models.LanguageConversationStartInputOneOf2
import com.zoonk.api.models.MeUpdate
import com.zoonk.api.models.Milestone
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.UUID

class ApiServicesTest {
    private val server = MockWebServer()
    private lateinit var services: ApiServices
    private val goalId = UUID.fromString("0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c001")

    @Before
    fun start() {
        server.start()
        services = ApiServices(server.url("/v1/"), OkHttpClient())
    }

    @After
    fun stop() {
        server.close()
    }

    @Test
    fun decodesAResponseWithAUuidATimestampAndAnEnum() =
        runTest {
            server.enqueue(
                json(
                    """{"earnedAt":"2026-10-28T09:00:00.000Z","id":"$goalId","key":"belt-yellow","kind":"belt","shownAt":null}""",
                ),
            )
            val milestone = services.milestones.createMilestoneView(goalId).body()!!
            assertEquals("/v1/me/milestones/$goalId/views", server.takeRequest().url.encodedPath)
            assertEquals(goalId, milestone.id)
            assertEquals("2026-10-28T09:00:00Z", milestone.earnedAt.toString())
            assertEquals(Milestone.Kind.BELT, milestone.kind)
            assertNull(milestone.shownAt)
        }

    @Test
    fun decodesAUnionIntoTheBranchItMatches() =
        runTest {
            server.enqueue(json("""{"status":"nothingToSkip"}"""))
            val result = services.learner.getChapterTestOut(goalId, goalId).body()!!
            assertEquals(GetChapterTestOut200Response.NothingToSkipValue::class, result::class)
        }

    @Test
    fun aPatchSendsOnlyTheFieldsItSets() =
        runTest {
            server.enqueue(MockResponse.Builder().code(500).build())
            server.enqueue(MockResponse.Builder().code(500).build())
            services.account.updateCurrentUser(MeUpdate(name = "Ana"))
            services.account.updateCurrentUser(MeUpdate(username = "ana"))
            assertEquals("""{"name":"Ana"}""", server.takeRequest().body?.utf8())
            assertEquals("""{"username":"ana"}""", server.takeRequest().body?.utf8())
        }

    @Test
    fun aMultipartAnswerSendsItsFieldsAsPlainText() =
        runTest {
            server.enqueue(MockResponse.Builder().code(500).build())
            val audio = MultipartBody.Part.createFormData("audio", "answer.m4a", byteArrayOf(1, 2).toRequestBody("audio/mp4".toMediaType()))
            services.language.createSpokenAnswer(
                goalId,
                durationMs = 1200,
                audio = audio,
                studySessionId = goalId,
                timeZone = "America/Sao_Paulo",
            )
            val body = server.takeRequest().body!!.utf8()
            assertTrue(body.contains("\r\n\r\n1200\r\n"))
            assertTrue(body.contains("\r\n\r\n$goalId\r\n"))
            assertTrue(body.contains("\r\n\r\nAmerica/Sao_Paulo\r\n"))
        }

    @Test
    fun aRunWritingWhatTheRequestNeedsArrivesAsItsAnswer() =
        runTest {
            server.enqueue(json("""{"generationId":"wrun_1","status":"generating"}""", code = 202))
            val answer = runCatching { services.language.startLanguageConversation(speakingMock()) }.exceptionOrNull()
            assertEquals("wrun_1", (answer as ContentWritingAnswer).generationId)
        }

    @Test
    fun aFinishedAnswerIsReadAsTheOperationsOwn() =
        runTest {
            server.enqueue(json("""{"conversationId":"$goalId"}""", code = 201))
            assertEquals(
                goalId,
                services.language
                    .startLanguageConversation(speakingMock())
                    .body()!!
                    .conversationId,
            )
        }

    private fun speakingMock() =
        LanguageConversationStartInput.LanguageConversationStartInputOneOf2Value(
            LanguageConversationStartInputOneOf2(goalId, LanguageConversationStartInputOneOf2.Kind.SPEAKING_MOCK),
        )

    private fun json(
        body: String,
        code: Int = 200,
    ) = MockResponse
        .Builder()
        .code(code)
        .addHeader("Content-Type", "application/json")
        .body(body)
        .build()
}
