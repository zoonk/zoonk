package com.zoonk.android.feature.tutor

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.data.startOnLoopback
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
import org.junit.Assert.assertNotEquals
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
        server.startOnLoopback()
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

            assertNull(api.thread(TutorThreadKey.Plan(GOAL, CONVERSATION), cursor = null, ana))
            val read = server.takeRequest()
            assertEquals("/v1/goals/$GOAL/buddy/conversations/$CONVERSATION/questions", read.url.encodedPath)
            assertEquals("plan", read.url.queryParameter("contextKind"))
            assertEquals("Bearer token-a", read.headers["Authorization"])
        }

    @Test
    fun readsAGoalsConversationsPageByPage() =
        runTest {
            server.enqueue(
                json(
                    """{"conversations":[{"id":"$CONVERSATION","title":"Why cells?","lastAskedAt":"2026-11-26T09:30:00.000Z"}],"currentId":null,"nextCursor":"$CONVERSATION"}""",
                ),
            )

            val page = api.conversations(GOAL, cursor = CONVERSATION, ana)

            val read = server.takeRequest()
            assertEquals("/v1/goals/$GOAL/buddy/conversations", read.url.encodedPath)
            assertEquals(CONVERSATION, read.url.queryParameter("cursor"))
            assertEquals(
                BuddyConversationList(
                    listOf(BuddyConversation(CONVERSATION, "Why cells?", kotlin.time.Instant.parse("2026-11-26T09:30:00Z"))),
                    currentId = null,
                    nextCursor = CONVERSATION,
                ),
                page,
            )
        }

    @Test
    fun asksInTheConversationTheAppNamed() =
        runTest {
            server.enqueue(json(question(status = "pending", context = """{"kind":"plan"}""", created = true)))

            api.ask(TutorScope.Plan(GOAL, CONVERSATION), "Why?", suggestion = null, REQUEST, ana)

            val sent = server.takeRequest()
            assertEquals("POST", sent.method)
            assertEquals("/v1/goals/$GOAL/buddy/conversations/$CONVERSATION/questions", sent.url.encodedPath)
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

    /** The topic line compares turns by part: a saved question matches the step it was asked on, and a removed step keeps its number. */
    @Test
    fun aQuestionsTopicIsItsStepOrItsNumberOnceTheStepIsGone() =
        runTest {
            val scope = TutorScope.Step(LESSON, STEP, stepNumber = 2)
            server.enqueue(
                json(question(status = "pending", context = """{"kind":"step","stepId":"$STEP","stepNumber":2}""", created = true)),
            )
            server.enqueue(json(question(status = "pending", context = """{"kind":"step","stepId":null,"stepNumber":3}""", created = true)))
            server.enqueue(json(question(status = "pending", context = """{"kind":"step","stepId":null,"stepNumber":4}""", created = true)))

            val asked = api.ask(scope, "Why?", suggestion = null, REQUEST, ana).turn
            val gone = api.ask(scope, "Why?", suggestion = null, REQUEST, ana).turn
            val goneToo = api.ask(scope, "Why?", suggestion = null, REQUEST, ana).turn

            assertEquals(scope.topic, asked.topic)
            assertNotEquals(asked.topic, gone.topic)
            assertNotEquals(gone.topic, goneToo.topic)
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

    private fun question(
        status: String,
        context: String,
        created: Boolean = false,
    ) =
        """{"answer":${if (status == "completed") "\"An orbit is a path.\"" else "null"},"context":$context,"createdAt":"2026-10-28T12:00:00.000Z","id":"$QUESTION","planChange":null,"question":"Why?","status":"$status","toolOffer":null,"updatedAt":"2026-10-28T12:00:00.000Z"${if (created) ""","missionMoment":null""" else ""}}"""

    private companion object {
        const val GOAL = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val CONVERSATION = "2e3d4c5b-6a7f-4b8c-9dae-1f2a3b4c5d6e"
        const val ITEM = "3f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val LESSON = "1f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val STEP = "2f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val BLOCK = "4f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val QUESTION = "5f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val FACT = "8f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val REQUEST = "9f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
    }
}
