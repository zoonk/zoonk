package com.zoonk.android.feature.activities.code

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf18FieldsExpectedRowsInnerInner as Cell
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf18FieldsTablesInnerColumnsInner as Column

// Replies are what main's sandbox returns: `ProgramRun`, `QueryRun` and `testRegex`'s results.
@OptIn(ExperimentalCoroutinesApi::class)
class CodeSandboxTest {
    private val pages = mutableListOf<FakePage>()

    private fun TestScope.sandbox(hasWebView: Boolean = true) =
        CodeSandbox(
            openPage = { listener -> FakePage(listener).takeIf { hasWebView }?.also { pages += it } },
            scope = backgroundScope,
        )

    private fun json(text: String) = Json.parseToJsonElement(text).jsonObject

    @Test
    fun `opens one page on the first request and sends to it once it loads`() =
        runTest {
            val sandbox = sandbox()
            val run = async { sandbox.runProgram("console.log([1, 2])", CodeLanguage.JavaScript) }
            runCurrent()
            val page = pages.single()
            assertEquals(emptyList<JsonObject>(), page.sent)

            page.load()
            runCurrent()
            assertEquals(
                json("""{"id":1,"type":"runProgram","code":"console.log([1, 2])","language":"javascript"}"""),
                page.sent.single(),
            )

            page.answer("""{"error":null,"errorOutput":"","output":"[ 1, 2 ]\n","stop":"done"}""")
            assertEquals(ProgramRun(error = null, errorOutput = "", output = "[ 1, 2 ]\n", stop = ProgramStop.Done), run.await())

            val python = async { sandbox.runProgram("print(x)", CodeLanguage.Python) }
            runCurrent()
            page.answer(
                """{"error":{"line":1,"message":"NameError: name 'x' is not defined"},"errorOutput":"","output":"","stop":"error"}""",
            )
            assertEquals(
                ProgramRun(ProgramError(1, "NameError: name 'x' is not defined"), errorOutput = "", output = "", stop = ProgramStop.Error),
                python.await(),
            )
            assertEquals(1, pages.size)
        }

    @Test
    fun `runs SQL against the activity's tables and reads text, number and null cells`() =
        runTest {
            val sandbox = sandbox()
            val tables =
                listOf(
                    SqlTable(
                        columns = listOf(Column("name", Column.Type.TEXT), Column("population", Column.Type.INTEGER)),
                        name = "countries",
                        rows = listOf(listOf(Cell.StringValue("Brazil"), Cell.DoubleValue(203.0))),
                    ),
                )
            val query = async { sandbox.runQuery("SELECT * FROM countries", tables) }
            runCurrent()
            val page = pages.single().apply { load() }
            runCurrent()
            assertEquals(
                json(
                    """
                    {"id":1,"type":"runQuery","query":"SELECT * FROM countries","tables":[{"name":"countries",
                    "columns":[{"name":"name","type":"text"},{"name":"population","type":"integer"}],
                    "rows":[["Brazil",203.0]]}]}
                    """,
                ),
                page.sent.single(),
            )

            page.answer("""{"result":{"columns":["name","population"],"rows":[["Brazil",203],["Atlantis",null]]},"status":"done"}""")
            assertEquals(
                QueryRun.Done(
                    QueryResult(
                        columns = listOf("name", "population"),
                        rows = listOf(listOf(JsonPrimitive("Brazil"), JsonPrimitive(203)), listOf(JsonPrimitive("Atlantis"), JsonNull)),
                    ),
                ),
                query.await(),
            )

            val failures =
                listOf(
                    """{"message":"no such table: country","status":"error"}""" to QueryRun.Error("no such table: country"),
                    """{"status":"timeout"}""" to QueryRun.Timeout,
                    """{"status":"unavailable"}""" to QueryRun.Unavailable,
                )
            for ((reply, expected) in failures) {
                val failing = async { sandbox.runQuery("SELECT * FROM country", tables) }
                runCurrent()
                page.answer(reply)
                assertEquals(expected, failing.await())
            }
        }

    @Test
    fun `tests a regex against both sample lists and reads matches in UTF-16 units`() =
        runTest {
            val sandbox = sandbox()
            val test = async { sandbox.testRegex("é+", listOf("🙂café"), listOf("cafe")) }
            runCurrent()
            val page = pages.single().apply { load() }
            runCurrent()
            assertEquals(
                json("""{"id":1,"type":"testRegex","pattern":"é+","shouldMatch":["🙂café"],"shouldNotMatch":["cafe"]}"""),
                page.sent.single(),
            )

            page.answer(
                """
                {"shouldMatch":[{"match":{"end":6,"start":5},"passes":true,"sample":"🙂café"}],
                "shouldNotMatch":[{"match":null,"passes":true,"sample":"cafe"}],"status":"tested"}
                """,
            )
            val tested = test.await() as RegexTest.Tested
            val match = tested.shouldMatch.single()
            assertEquals("é", match.sample.substring(match.match!!.start, match.match.end))
            assertEquals(listOf(SampleResult(match = null, passes = true, sample = "cafe")), tested.shouldNotMatch)

            for ((reply, expected) in listOf(
                """{"status":"invalid"}""" to RegexTest.Invalid,
                """{"status":"empty"}""" to RegexTest.Empty,
            )) {
                val other = async { sandbox.testRegex("(a+)+", listOf("a"), listOf("b")) }
                runCurrent()
                page.answer(reply)
                assertEquals(expected, other.await())
            }
        }

    @Test
    fun `reads whether a runtime loaded`() =
        runTest {
            val sandbox = sandbox()
            val warmUp = async { sandbox.warmUp(CodeLanguage.Python) }
            runCurrent()
            val page = pages.single().apply { load() }
            runCurrent()
            assertEquals(json("""{"id":1,"type":"warmUp","kind":"python"}"""), page.sent.single())
            page.answer("false")
            assertFalse(warmUp.await())

            val again = async { sandbox.warmUp(CodeLanguage.Python) }
            runCurrent()
            page.answer("true")
            assertTrue(again.await())
        }

    @Test
    fun `answers each request with its own reply when they finish out of order`() =
        runTest {
            val sandbox = sandbox()
            val slow = async { sandbox.runProgram("slow()", CodeLanguage.JavaScript) }
            val fast = async { sandbox.runProgram("fast()", CodeLanguage.JavaScript) }
            runCurrent()
            val page = pages.single().apply { load() }
            runCurrent()

            page.answer("""{"error":null,"errorOutput":"","output":"fast","stop":"done"}""", id = 2)
            page.answer("""{"error":null,"errorOutput":"","output":"slow","stop":"done"}""", id = 1)
            assertEquals("slow", slow.await().output)
            assertEquals("fast", fast.await().output)
        }

    @Test
    fun `reads a reply learner code could have bent out of shape, or a page error, as unavailable`() =
        runTest {
            val sandbox = sandbox()
            val forged = async { sandbox.runProgram("post({type: 'error', line: 'x'})", CodeLanguage.JavaScript) }
            runCurrent()
            val page = pages.single().apply { load() }
            runCurrent()
            page.answer("""{"error":{"line":"x","message":{}},"errorOutput":"","output":"","stop":"error"}""")
            assertEquals(ProgramRun.Unavailable, forged.await())

            val failed = async { sandbox.runQuery("SELECT 1", emptyList()) }
            runCurrent()
            page.listener.onMessage("""{"error":"TypeError: rows is not iterable","id":2}""")
            assertEquals(QueryRun.Unavailable, failed.await())
        }

    @Test
    fun `is unavailable without a WebView`() =
        runTest {
            val sandbox = sandbox(hasWebView = false)

            assertFalse(sandbox.warmUp(CodeLanguage.JavaScript))
            assertEquals(ProgramRun.Unavailable, sandbox.runProgram("1", CodeLanguage.JavaScript))
            assertEquals(QueryRun.Unavailable, sandbox.runQuery("SELECT 1", emptyList()))
            assertEquals(RegexTest.Unavailable, sandbox.testRegex("a", listOf("a"), listOf("b")))
        }

    @Test
    fun `ends what was running when the page's process ends, and opens a new page next time`() =
        runTest {
            val sandbox = sandbox()
            val run = async { sandbox.runProgram("while (true) {}", CodeLanguage.JavaScript) }
            runCurrent()
            val first = pages.single().apply { load() }
            runCurrent()

            first.gone()
            assertEquals(ProgramRun.Unavailable, run.await())
            assertTrue(first.closed)

            val next = async { sandbox.warmUp(CodeLanguage.JavaScript) }
            runCurrent()
            pages.last().apply {
                load()
                runCurrent()
                answer("true")
            }
            assertTrue(next.await())
            assertEquals(2, pages.size)
        }

    @Test
    fun `keeps the page while held and closes it a minute after the last hold and request end`() =
        runTest {
            val sandbox = sandbox()
            val hold = sandbox.hold()
            val warmUp = async { sandbox.warmUp(CodeLanguage.Python) }
            runCurrent()
            val page = pages.single().apply { load() }
            runCurrent()
            page.answer("true")
            warmUp.await()

            advanceTimeBy(10.minutes)
            assertFalse(page.closed)

            hold.close()
            hold.close()
            advanceTimeBy(59.seconds)
            val nextHold = sandbox.hold()
            advanceTimeBy(10.minutes)
            assertFalse(page.closed)

            nextHold.close()
            advanceTimeBy(61.seconds)
            assertTrue(page.closed)
            assertEquals(1, pages.size)
        }

    @Test
    fun `drops the reply of a request its caller stopped waiting for`() =
        runTest {
            val sandbox = sandbox()
            val run = async { sandbox.runProgram("print(1)", CodeLanguage.Python) }
            runCurrent()
            val page = pages.single().apply { load() }
            runCurrent()

            run.cancel()
            runCurrent()
            page.answer("""{"error":null,"errorOutput":"","output":"1\n","stop":"done"}""")
            advanceTimeBy(61.seconds)
            assertTrue(page.closed)
        }

    private class FakePage(
        val listener: SandboxPage.Listener,
    ) : SandboxPage {
        val sent = mutableListOf<JsonObject>()
        var closed = false

        override fun send(message: String) {
            sent += Json.parseToJsonElement(message).jsonObject
        }

        override fun close() {
            closed = true
        }

        fun load() = listener.onMessage("""{"type":"loaded"}""")

        fun answer(
            result: String,
            id: Int =
                sent
                    .last()
                    .getValue("id")
                    .jsonPrimitive.int,
        ) = listener.onMessage("""{"id":$id,"result":$result}""")

        fun gone() = listener.onGone()
    }
}
