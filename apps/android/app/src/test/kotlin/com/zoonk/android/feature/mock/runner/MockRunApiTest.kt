package com.zoonk.android.feature.mock.runner

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.feature.questions.Answer
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.util.concurrent.TimeUnit

class MockRunApiTest {
    private val server = MockWebServer()
    private lateinit var api: LiveMockRunApi
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")

    @Before
    fun start() {
        server.start()
        api = LiveMockRunApi(ApiClients(server.url("/v1/"), apiHttpClient()))
    }

    @After
    fun stop() = server.close()

    @Test
    fun aBlankAnswerSendsItsAnswerAsNull() =
        runTest {
            server.enqueue(MockResponse.Builder().code(204).build())

            assertEquals(
                SaveOutcome.Stored,
                api.save(ana, RUN_BLOCK, MockDraft(ITEM_ONE, answer = null, durationMs = 1200, flagged = true)),
            )

            val request = server.takeRequest(5, TimeUnit.SECONDS)!!
            assertEquals("PUT", request.method)
            assertEquals("/v1/mocks/$RUN_BLOCK/answers", request.url.encodedPath)
            assertEquals("""{"answer":null,"durationMs":1200,"flagged":true,"itemId":"$ITEM_ONE"}""", request.body!!.utf8())
        }

    @Test
    fun aPickGoesInTheContractsShape() =
        runTest {
            server.enqueue(MockResponse.Builder().code(204).build())

            api.save(ana, RUN_BLOCK, MockDraft(ITEM_ONE, answer = Answer.Choices(listOf(0, 2))))

            assertEquals(
                """{"answer":{"selectedIndexes":[0,2]},"durationMs":0,"flagged":false,"itemId":"$ITEM_ONE"}""",
                server.takeRequest(5, TimeUnit.SECONDS)!!.body!!.utf8(),
            )
        }

    @Test
    fun anAnswerTheServerWontKeepIsRefusedNotTriedAgain() =
        runTest {
            server.enqueue(error(409, "SECTION_TIME_UP"))

            assertEquals(SaveOutcome.Refused, api.save(ana, RUN_BLOCK, MockDraft(ITEM_ONE, Answer.Choice(1))))
        }

    @Test
    fun aRecordingWithNoPlaysLeftIsUsedUp() =
        runTest {
            server.enqueue(error(409, "MOCK_PLAYS_USED"))

            assertEquals(PlayOutcome.UsedUp, api.play(ana, RUN_BLOCK, ITEM_TWO))
        }

    private fun error(
        code: Int,
        errorCode: String,
    ) = MockResponse
        .Builder()
        .code(code)
        .addHeader("Content-Type", "application/json")
        .body("""{"error":{"code":"$errorCode","message":"No"}}""")
        .build()
}
