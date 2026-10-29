package com.zoonk.android.feature.activities.code

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonPrimitive
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf18FieldsExpectedRowsInnerInner as Cell
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf18FieldsTablesInnerColumnsInner as Column

// Python needs the network the first time, to load Pyodide from jsDelivr.
@RunWith(AndroidJUnit4::class)
class CodeSandboxDeviceTest {
    private val scope = MainScope()
    private val sandbox = CodeSandbox(InstrumentationRegistry.getInstrumentation().targetContext, scope)

    @After
    fun stop() {
        scope.cancel()
    }

    private fun <T> onMain(
        timeout: Duration = 30.seconds,
        block: suspend CodeSandbox.() -> T,
    ): T = runBlocking { withTimeout(timeout) { withContext(Dispatchers.Main) { sandbox.block() } } }

    @Test
    fun runsJavaScriptLikeMainAndStopsALoopThatNeverEnds() {
        val printed = onMain { runProgram("console.log([1, 2], { a: 1 })\nconsole.error('careful')", CodeLanguage.JavaScript) }
        assertEquals(ProgramRun(error = null, errorOutput = "careful\n", output = "[ 1, 2 ] { a: 1 }\n", stop = ProgramStop.Done), printed)

        val failed = onMain { runProgram("const a = 1\nthrow new Error('boom')", CodeLanguage.JavaScript) }
        assertEquals(ProgramError(2, "Error: boom"), failed.error)

        val started = System.nanoTime()
        val looping = onMain { runProgram("while (true) {}", CodeLanguage.JavaScript) }
        assertEquals(ProgramStop.Timeout, looping.stop)
        assertTrue((System.nanoTime() - started) / 1_000_000 in 3_000L..6_000L)

        assertEquals("ok\n", onMain { runProgram("console.log('ok')", CodeLanguage.JavaScript) }.output)
    }

    @Test
    fun learnerCodeReachesNoOtherHost() {
        val code =
            """
            for (const url of ["https://unpkg.com/lodash-es@4.17.21/lodash.js", "https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/lodash.js"]) {
              try {
                await import(url)
                console.log("reached")
              } catch {
                console.log("blocked")
              }
            }
            console.log(typeof fetch, typeof XMLHttpRequest, typeof WebSocket)
            """.trimIndent()

        assertEquals("blocked\nblocked\nundefined undefined undefined\n", onMain { runProgram(code, CodeLanguage.JavaScript) }.output)
    }

    @Test
    fun runsPythonThroughPyodide() {
        assertTrue(onMain(2.minutes) { warmUp(CodeLanguage.Python) })
        assertEquals("6\n", onMain { runProgram("print(sum(range(4)))", CodeLanguage.Python) }.output)

        val failed = onMain { runProgram("x = 1\nprint(y)", CodeLanguage.Python) }
        assertEquals(ProgramError(2, "NameError: name 'y' is not defined"), failed.error)
    }

    @Test
    fun runsSqlOnAFreshDatabase() {
        val tables =
            listOf(
                SqlTable(
                    columns = listOf(Column("name", Column.Type.TEXT), Column("population", Column.Type.INTEGER)),
                    name = "countries",
                    rows =
                        listOf(
                            listOf(Cell.StringValue("Brazil"), Cell.DoubleValue(203.0)),
                            listOf(Cell.StringValue("Chile"), Cell.DoubleValue(19.0)),
                        ),
                ),
            )
        assertTrue(onMain(1.minutes) { warmUp(CodeLanguage.Sql) })

        assertEquals(
            QueryRun.Done(QueryResult(listOf("name", "population"), listOf(listOf(JsonPrimitive("Brazil"), JsonPrimitive(203))))),
            onMain { runQuery("DELETE FROM countries WHERE population < 100; SELECT * FROM countries", tables) },
        )
        assertEquals(
            QueryRun.Done(QueryResult(listOf("count(*)"), listOf(listOf(JsonPrimitive(2))))),
            onMain { runQuery("SELECT count(*) FROM countries", tables) },
        )
        assertEquals(QueryRun.Error("no such table: country"), onMain { runQuery("SELECT * FROM country", tables) })
    }

    @Test
    fun testsRegexesWithJavaScriptsEngine() {
        assertEquals(
            RegexTest.Tested(
                shouldMatch =
                    listOf(
                        SampleResult(SampleMatch(0, 5), passes = true, sample = "12345"),
                        SampleResult(null, passes = false, sample = "9021"),
                    ),
                shouldNotMatch = listOf(SampleResult(null, passes = true, sample = "1234a")),
            ),
            onMain { testRegex("^\\d{5}$", listOf("12345", "9021"), listOf("1234a")) },
        )
        assertEquals(
            RegexTest.Tested(listOf(SampleResult(SampleMatch(1, 2), passes = true, sample = "a\u00E9")), emptyList()),
            onMain { testRegex("\\p{L}(?<=\u00E9)", listOf("a\u00E9"), emptyList()) },
        )
        assertEquals(RegexTest.Invalid, onMain { testRegex("(a+)+", listOf("a"), listOf("b")) })
        assertEquals(RegexTest.Empty, onMain { testRegex("", listOf("a"), listOf("b")) })
    }
}
