package com.zoonk.android.feature.activities.code

import androidx.activity.ComponentActivity
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
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
    fun aRunsOutputComesBackAfterAndroidClosesTheAppInTheBackground() {
        val restoration = StateRestorationTester(rule)
        harness.codeSandbox = { scope -> ScriptedSandbox(scope) { ScriptedSandbox.printed("5050\n") }.sandbox }
        harness.play(listOf(ActivityFixtures.step("codeRunner")), restoration = restoration)

        line(2).performTextReplacement("for n in range(1, 101):")
        tap("Run")
        rule.waitUntil(WAIT_MS) { rule.onAllNodesWithText("5050").fetchSemanticsNodes().size == 2 }

        harness.viewModel = harness.openAgain()
        restoration.emulateSavedInstanceStateRestore()

        rule.onAllNodesWithText("5050").assertCountEquals(2)
        rule.onNodeWithText("Check").assertIsEnabled()
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

    private fun sqlRows(request: JsonObject): JsonElement {
        val query = request.getValue("query").jsonPrimitive.content
        val rows =
            listOf(listOf("India", 1451), listOf("China", 1419), listOf("Indonesia", 283)) +
                if (" OR " in query) listOf(listOf("Brazil", 212)) else emptyList()
        val cells = rows.map { (name, people) -> listOf(JsonPrimitive(name as String), JsonPrimitive(people as Int)) }
        val result = QueryResult(listOf("name", "pop_millions"), cells)
        return sandboxJson.encodeToJsonElement<QueryRun>(QueryRun.Done(result))
    }
        "SELECT name, pop_millions FROM countries WHERE continent = 'Asia' AND pop_millions > 200 ORDER BY pop_millions DESC;"

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
    fun aRerunThatEndsAfterCheckLeavesTheCheckedOutput() {
        var runs = 0
        play(javaScriptRunner, javaScriptExpected, isCorrect = false) {
            runs += 1
            ScriptedSandbox.printed(if (runs == 1) "first\n" else "second\n")
        }

        tap("Run")
        shows("first")
        val pending = CompletableDeferred<Unit>()
        scripted.gate = pending
        tap("Run again")
        harness.tap("Check")
        shows("Not quite")
        pending.complete(Unit)
        rule.waitForIdle()

        rule.onNodeWithText("second").assertDoesNotExist()
        assertEquals(listOf(outputAnswer("first\n")), graded)
    }

    @Test
    fun aHugeCellStillShowsTheResult() {
        playFixture("sqlPlayground", isCorrect = true) {
            val cell = JsonPrimitive("A".repeat(400_000))
            sandboxJson.encodeToJsonElement<QueryRun>(QueryRun.Done(QueryResult(listOf("blob"), listOf(listOf(cell)))))
        }

        field("Your query").performTextReplacement("SELECT hex(zeroblob(200000)) AS blob;")
        tap("Run")

        shows("Your result: 1 row")
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
    }
}
