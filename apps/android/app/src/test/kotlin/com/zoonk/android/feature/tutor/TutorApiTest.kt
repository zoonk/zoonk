package com.zoonk.android.feature.tutor

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.SocketEffect
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

class TutorApiTest {
    private val server = MockWebServer()
    private lateinit var api: LiveTutorApi
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")

    @Before
    fun start() {
        server.start()
        api = LiveTutorApi(ApiClients(server.url("/v1/"), apiHttpClient()))
    }

    @After
    fun stop() {
        server.close()
    }

    @Test
    fun aConversationBeforeItsFirstQuestionIsNothingYet() =
        runTest {
            server.enqueue(json("null"))

            assertNull(api.thread(TutorThreadKey.Plan(GOAL), cursor = null, ana))
            val read = server.takeRequest()
            assertEquals("/v1/goals/$GOAL/plan/questions", read.url.encodedPath)
            assertEquals("plan", read.url.queryParameter("contextKind"))
            assertEquals("Bearer token-a", read.headers["Authorization"])
        }

    @Test
    fun aScreensConversationIsReadByItsStepAndMapsItsTurns() =
        runTest {
            server.enqueue(json(thread(question(status = "completed", context = """{"kind":"step","stepId":"$STEP","stepNumber":2}"""))))

            val thread = api.thread(TutorThreadKey.Step(LESSON, STEP), cursor = null, ana)

            val read = server.takeRequest()
            assertEquals("/v1/lessons/$LESSON/questions", read.url.encodedPath)
            assertEquals(STEP, read.url.queryParameter("stepId"))
            assertNull(read.url.queryParameter("contextKind"))
            val turn = thread!!.turns.single()
            assertEquals(TutorTurn.Status.Completed, turn.status)
            assertEquals(TutorTurn.About.Step, turn.about)
            assertEquals("An orbit is a path.", turn.answer)
        }

    @Test
    fun asksWithTheScopesContextAndTheSameRequestEveryTime() =
        runTest {
            server.enqueue(json(question(status = "pending", context = """{"kind":"item","answered":true}""", created = true)))

            val asked = api.ask(TutorScope.Item(ITEM, BLOCK, answered = true), "Why?", suggestion = null, REQUEST, ana)

            val sent = server.takeRequest()
            assertEquals("POST", sent.method)
            assertEquals("/v1/items/$ITEM/questions", sent.url.encodedPath)
            val body = Json.parseToJsonElement(sent.body!!.utf8()).jsonObject
            assertEquals("Why?", body["question"]!!.jsonPrimitive.content)
            assertEquals(REQUEST, body["requestId"]!!.jsonPrimitive.content)
            val context = body["context"]!!.jsonObject
            assertEquals("item", context["kind"]!!.jsonPrimitive.content)
            assertEquals("true", context["answered"]!!.jsonPrimitive.content)
            assertEquals(BLOCK, context["blockId"]!!.jsonPrimitive.content)
            assertEquals(TutorTurn.Status.Pending, asked.turn.status)
            assertEquals(TutorTurn.About.Answer, asked.turn.about)
        }

    @Test
    fun streamsTheAnswerThenItsSavedWordsItsOfferAndWhatItRemembered() =
        runTest {
            server.enqueue(
                events(
                    chunk("""{"type":"start"}"""),
                    chunk("""{"type":"text-delta","id":"answer","delta":"An orbit "}"""),
                    chunk("""{"type":"text-delta","id":"answer","delta":"is a path."}"""),
                    chunk("""{"type":"data-saved-answer","data":{"answer":"An orbit is a [path](/today)."}}"""),
                    chunk("""{"type":"data-tool-offer","data":{"kind":"stats"}}"""),
                    chunk("""{"type":"data-unknown","data":{"x":1}}"""),
                    chunk("""{"type":"finish"}"""),
                    chunk(
                        """{"type":"data-memory","data":[{"action":"added","fact":{"id":"$FACT","statement":"Likes space"},"previous":null}]}""",
                    ),
                    "data: [DONE]\n\n",
                ),
            )

            val events = api.answer(QUESTION, ana).toList()

            val sent = server.takeRequest()
            assertEquals("POST", sent.method)
            assertEquals("/v1/questions/$QUESTION/answers", sent.url.encodedPath)
            assertEquals(
                listOf(
                    TutorAnswerEvent.Text("An orbit "),
                    TutorAnswerEvent.Text("is a path."),
                    TutorAnswerEvent.SavedAnswer("An orbit is a [path](/today)."),
                ),
                events.take(3),
            )
            assertTrue(events[3] is TutorAnswerEvent.Offered)
            assertEquals(TutorAnswerEvent.Finish, events[4])
            assertEquals(
                "Likes space",
                (events[5] as TutorAnswerEvent.Remembered)
                    .changes
                    .single()
                    .fact
                    ?.statement,
            )
        }

    @Test
    fun aRefusedAnswerSaysWhichLimitRanOut() =
        runTest {
            server.enqueue(
                MockResponse
                    .Builder()
                    .code(403)
                    .addHeader("Content-Type", "application/json")
                    .body(
                        """{"error":{"code":"USAGE_LIMIT_REACHED","message":"Limit","details":{"limit":{"period":"day","tier":"free"}}}}""",
                    ).build(),
            )

            try {
                api.answer(QUESTION, ana).toList()
                fail("A refusal throws")
            } catch (e: ApiException) {
                assertEquals(Limit.Reached(LimitTier.Free, LimitPeriod.Day), Limit.of(e))
            }
        }

    @Test
    fun aStreamCutBeforeItsAnswerIsSavedFailsAndOneCutAfterIsAnswered() =
        runTest {
            server.enqueue(events(chunk("""{"type":"text-delta","id":"answer","delta":"An orbit"}"""), drop = true))
            server.enqueue(
                events(chunk("""{"type":"text-delta","id":"answer","delta":"An orbit"}"""), chunk("""{"type":"finish"}"""), drop = true),
            )

            try {
                api.answer(QUESTION, ana).toList()
                fail("A cut before the answer is saved throws")
            } catch (e: ApiException) {
                assertEquals(com.zoonk.android.data.ApiError.Network, e.error)
            }
            assertEquals(TutorAnswerEvent.Finish, api.answer(QUESTION, ana).toList().last())
        }

    private fun json(body: String) =
        MockResponse
            .Builder()
            .addHeader("Content-Type", "application/json")
            .body(body)
            .build()

    private fun chunk(json: String) = "data: $json\n\n"

    private fun events(
        vararg events: String,
        drop: Boolean = false,
    ): MockResponse {
        val body = events.joinToString("")
        val builder =
            MockResponse
                .Builder()
                .addHeader("Content-Type", "text/event-stream")
                .body(body)
        if (drop) builder.setHeader("Content-Length", body.length + 100).onResponseEnd(SocketEffect.CloseSocket())
        return builder.build()
    }

    private fun thread(vararg questions: String) =
        """{"hasMore":false,"id":"$THREAD","lessonId":null,"nextCursor":null,"questions":[${questions.joinToString(",")}]}"""

    private fun question(
        status: String,
        context: String,
        created: Boolean = false,
    ) =
        """{"answer":${if (status == "completed") "\"An orbit is a path.\"" else "null"},"context":$context,"createdAt":"2026-10-28T12:00:00.000Z","id":"$QUESTION","planChange":null,"question":"Why?","status":"$status","toolOffer":null,"updatedAt":"2026-10-28T12:00:00.000Z"${if (created) ""","missionMoment":null""" else ""}}"""

    private companion object {
        const val GOAL = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val LESSON = "1f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val STEP = "2f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val ITEM = "3f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val BLOCK = "4f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val QUESTION = "5f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val THREAD = "7f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val FACT = "8f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val REQUEST = "9f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
    }
}
