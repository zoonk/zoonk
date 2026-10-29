package com.zoonk.android.feature.activities.code

import androidx.activity.ComponentActivity
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.assignmentAnswer
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ActivityExpected
import com.zoonk.api.models.LessonStepAnswer
import kotlinx.coroutines.CompletableDeferred
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

/** Main's computing activity tests, played in the real player against a scripted sandbox. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class CodeFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }
    private val graded = mutableListOf<ActivityAnswer?>()
    private lateinit var scripted: ScriptedSandbox

    private fun play(
        step: LessonStep,
        expected: ActivityExpected?,
        isCorrect: Boolean,
        answer: (JsonObject) -> JsonElement,
    ) {
        harness.codeSandbox = { scope -> ScriptedSandbox(scope, answer).also { scripted = it }.sandbox }
        harness.play(listOf(step)) {
            grade = { _, input ->
                graded += (input.answer as? LessonStepAnswer.LessonStepAnswerOneOf3Value)?.value?.answer
                checkResult(isCorrect, expected = expected)
            }
        }
    }

    private fun playFixture(
        fixture: String,
        isCorrect: Boolean,
        answer: (JsonObject) -> JsonElement,
    ) = play(ActivityFixtures.step(fixture), ActivityFixtures.expected(fixture), isCorrect, answer)

    private fun tap(text: String) = rule.onNodeWithText(text).performScrollTo().performClick()

    private fun shows(text: String) = rule.waitUntilAtLeastOneExists(hasText(text, substring = true), WAIT_MS)

    private fun waitForCheckEnabled() = rule.waitUntil(WAIT_MS) { runCatching { rule.onNodeWithText("Check").assertIsEnabled() }.isSuccess }

    private fun line(number: Int): SemanticsNodeInteraction = rule.onNode(hasContentDescription("Line $number, yours to edit"))

    @Test
    fun fixingTheLoopInPythonPrintsTheExpectedOutput() {
        playFixture("codeRunner", isCorrect = true) { request ->
            ScriptedSandbox.printed(if ("range(1, 101)" in request.code) "5050\n" else "4950\n")
        }

        tap("Run")
        shows("range stops before its end.")
        line(2).performTextReplacement("for n in range(1, 101):")
        shows("You changed the code. Run it again to see the new output.")
        rule.onNodeWithText("Check").assertIsNotEnabled()
        tap("Run again")
        rule.waitUntil(WAIT_MS) { rule.onAllNodesWithText("5050").fetchSemanticsNodes().size == 2 }
        rule.onAllNodesWithText("5050").assertCountEquals(2)
        harness.tap("Check")

        shows("Correct!")
        assertEquals(listOf(outputAnswer("5050\n")), graded)
    }

    @Test
    fun javaScriptOutputThatDiffersIsWrong() {
        play(javaScriptRunner, javaScriptExpected, isCorrect = false) { ScriptedSandbox.printed("[ 1, 2, 3 ]\n") }

        tap("Run")
        shows("map returns a new array.")
        harness.tap("Check")

        shows("Not quite")
    }

    @Test
    fun anEndlessLoopStopsAtTheTimeLimitAndEnterRunsTheFix() {
        play(endlessRunner, javaScriptExpected, isCorrect = false) { request ->
            if ("while (true)" in request.code) {
                ApiJson.parseToJsonElement("""{"error":null,"errorOutput":"","output":"","stop":"timeout"}""")
            } else {
                ScriptedSandbox.printed("counted to 3\n")
            }
        }

        tap("Run")
        shows("Stopped after 3 seconds. Is there a loop that never ends?")
        line(2).performTextReplacement("while (n < 3) { n += 1; }")
        line(2).requestFocus().performKeyInput { pressKey(Key.Enter) }

        shows("counted to 3")
        waitForCheckEnabled()
    }

    @Test
    fun editingWhileItRunsLeavesTheLateOutputStaleUntilTheNewCodeRuns() {
        play(javaScriptRunner, javaScriptExpected, isCorrect = true) { request ->
            ScriptedSandbox.printed(if ("n * 2" in request.code) "[ 2, 4, 6 ]\n" else "[ 1, 2, 3 ]\n")
        }
        val pending = CompletableDeferred<Unit>()
        scripted.gate = pending

        tap("Run")
        line(2).performTextReplacement("const doubled = numbers.map((n) => n * 2);")
        pending.complete(Unit)

        shows("You changed the code. Run it again to see the new output.")
        rule.onNodeWithText("Check").assertIsNotEnabled()
        scripted.gate = null
        tap("Run again")

        waitForCheckEnabled()
        val runs = scripted.requests.filter { it.getValue("type").jsonPrimitive.content == "runProgram" }
        assertEquals("const doubled = numbers.map((n) => n * 2);", runs.last().code.lines()[1])
    }

    private fun field(name: String) = rule.onNode(hasContentDescription(name))

    @Test
    fun examplesPassAsThePatternGrows() {
        playFixture("patternTester", isCorrect = true, { ScriptedSandbox.regexTested(it) })

        field("Your pattern").performTextReplacement("^\\d{5}")
        shows("1 of 3 pass")
        field("Your pattern").performTextReplacement("^\\d{5}(-\\d{4})?$")
        shows("3 of 3 pass")
        harness.tap("Check")

        shows("A pattern that works")
        assertEquals(listOf(patternAnswer("^\\d{5}(-\\d{4})?$")), graded)
    }

    @Test
    fun aFormulaIsCheckedCellByCell() {
        play(formulaTester, expected = null, isCorrect = false, { ScriptedSandbox.regexTested(it) })

        tap("Show a hint")
        shows("Add the increase to the price.")
        field("Your formula").performTextReplacement("=A1*B1")
        harness.tap("Check")

        shows("A formula that works")
        assertEquals(listOf(patternAnswer("=A1*B1")), graded)
    }

    @OptIn(ExperimentalTestApi::class)
    @Test
    fun enterOnASymbolButtonTypesItAtTheCursor() {
        playFixture("patternTester", isCorrect = true, { ScriptedSandbox.regexTested(it) })
        val pattern = field("Your pattern")

        pattern.requestFocus()
        rule.onNode(hasContentDescription("^, Start of the text")).requestFocus().performKeyInput { pressKey(Key.Enter) }
        pattern.assert(hasText("^"))
        rule.onNode(hasContentDescription("\\d, Any digit")).requestFocus().performKeyInput { pressKey(Key.Enter) }
        pattern.assert(hasText("^\\d")).assertIsFocused()
        pattern.performTextInput("{5}(-\\d{4})?$")
        shows("2 of 2 pass")
        rule.onNodeWithText("Check").requestFocus().performKeyInput { pressKey(Key.Enter) }

        rule.waitUntil { graded.isNotEmpty() }
        assertEquals(listOf(patternAnswer("^\\d{5}(-\\d{4})?$")), graded)
    }

    private fun sqlRows(request: JsonObject): JsonElement {
        val query = request.getValue("query").jsonPrimitive.content
        val rows =
            listOf(listOf("India", 1451), listOf("China", 1419), listOf("Indonesia", 283)) +
                if (" OR " in query) listOf(listOf("Brazil", 212)) else emptyList()
        val cells = rows.map { (name, people) -> listOf(JsonPrimitive(name as String), JsonPrimitive(people as Int)) }
        val result = QueryResult(listOf("name", "pop_millions"), cells)
        return sandboxJson.encodeToJsonElement<QueryRun>(QueryRun.Done(result))
    }

    private val solution =
        "SELECT name, pop_millions FROM countries WHERE continent = 'Asia' AND pop_millions > 200 ORDER BY pop_millions DESC;"

    @Test
    fun theRightQueryReturnsTheExpectedRows() {
        playFixture("sqlPlayground", isCorrect = true, ::sqlRows)

        field("Your query").performTextReplacement(solution)
        tap("Run")
        shows("Your result: 3 rows")
        harness.tap("Check")

        shows("Correct!")
        shows("A query that works")
    }

    @Test
    fun orInsteadOfAndShowsTheExpectedRows() {
        playFixture("sqlPlayground", isCorrect = false, ::sqlRows)

        field("Your query").performTextReplacement(solution.replace(" AND ", " OR "))
        tap("Run")
        shows("Your result: 4 rows")
        harness.tap("Check")

        shows("Not quite")
        shows("Expected result, in this order")
        shows("OR keeps rows that pass either test.")
    }

    @Test
    fun typingDuringAPendingQueryKeepsItsLateRowsStale() {
        playFixture("sqlPlayground", isCorrect = true, ::sqlRows)
        val pending = CompletableDeferred<Unit>()

        field("Your query").performTextReplacement("SELECT name FROM countries;")
        scripted.gate = pending
        tap("Run")
        field("Your query").performTextReplacement("SELECT name FROM countries ORDER BY name;")
        pending.complete(Unit)

        shows("You changed the query. Run it again to see the new result.")
        rule.onNodeWithText("Check").assertIsNotEnabled()
        scripted.gate = null
        tap("Run again")
        waitForCheckEnabled()
    }

    @Test
    fun aSnippetDuringAPendingQueryKeepsItsLateRowsStale() {
        playFixture("sqlPlayground", isCorrect = true, ::sqlRows)
        val pending = CompletableDeferred<Unit>()

        field("Your query").performTextReplacement("SELECT name FROM countries;")
        scripted.gate = pending
        tap("Run")
        tap("WHERE")
        pending.complete(Unit)

        shows("You changed the query. Run it again to see the new result.")
        scripted.gate = null
        tap("Run again")
        waitForCheckEnabled()
    }

    private fun stepForward(times: Int) =
        repeat(times) {
            rule.onNode(hasContentDescription("Step forward")).performScrollTo().performClick()
        }

    private fun option(text: String) = rule.onNode(hasText(text) and hasClickAction()).performScrollTo().performClick()

    @Test
    fun predictingTheTracedValueIsRight() {
        playFixture("codeTracer", isCorrect = true) { JsonPrimitive(true) }

        shows("Step 1 of 4")
        stepForward(2)
        shows("What will mid be on pass 3?")
        rule.onNode(hasContentDescription("Step forward")).assertIsNotEnabled()
        option("6")
        stepForward(1)
        shows("You said 6, and it was.")
        harness.tap("Check")

        shows("Correct!")
        assertEquals(listOf(assignmentAnswer(mapOf("0" to "b"))), graded)
    }

    @Test
    fun aWrongPredictionShowsTheTracedValue() {
        playFixture("codeTracer", isCorrect = false) { JsonPrimitive(true) }

        stepForward(2)
        option("5")
        harness.tap("Check")

        shows("Not quite")
        shows("You said 5; it was 6.")
    }

    private companion object {
        const val WAIT_MS = 5_000L

        val javaScriptFields =
            """
            "editableLines":[2],"expectedOutput":"[ 2, 4, 6 ]","language":"javascript",
            "mistakes":[{"feedback":"map returns a new array.","output":"[ 1, 2, 3 ]"}],
            "solution":"const numbers = [1, 2, 3];\nconst doubled = numbers.map((n) => n * 2);\nconsole.log(doubled);"
            """

        val javaScriptRunner =
            runner(""""starterCode":"const numbers = [1, 2, 3];\nconst doubled = numbers.map((n) => n);\nconsole.log(doubled);"""")

        val endlessRunner = runner(""""starterCode":"let n = 0;\nwhile (true) { n += 1; }\nconsole.log(\"counted to \" + n);"""")

        val javaScriptExpected =
            ApiJson.decodeFromString(
                ActivityExpected.serializer(),
                """{"answer":{"kind":"output","output":"[ 2, 4, 6 ]"},"kind":"interaction"}""",
            )

        fun runner(starterCode: String) =
            ActivityFixtures.step(
                ApiJson
                    .parseToJsonElement(
                        """
                        {"check":{"explanation":"Here is why.","kind":"interaction"},"prompt":"Double every number.",
                         "template":"codeRunner","fields":{$javaScriptFields,$starterCode}}
                        """,
                    ).jsonObject,
                id = "runner",
            )

        val formulaTester =
            ActivityFixtures.step(
                ApiJson
                    .parseToJsonElement(
                        """
                        {"check":{"explanation":"Here is why.","kind":"interaction"},"prompt":"Write the pattern.",
                         "template":"patternTester",
                         "fields":{"mode":"formula","solution":"A1*(1+B1)","task":"Price A1 goes up by rate B1. What's the new price?",
                          "tolerance":{"kind":"absolute","value":0.01},
                          "hints":[{"hint":"Add the increase to the price.","mistake":"Only the increase"}],
                          "examples":[{"inputs":[{"name":"A1","value":100},{"name":"B1","value":0.2}],"output":120},
                                      {"inputs":[{"name":"A1","value":50},{"name":"B1","value":0.1}],"output":55}]}}
                        """,
                    ).jsonObject,
                id = "formula",
            )
    }
}
