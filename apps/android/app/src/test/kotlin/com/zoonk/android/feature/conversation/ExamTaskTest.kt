package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ExamTaskTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val harness = ConversationHarness()

    private fun show() = compose.setContent { ZoonkTheme { harness.Conversation() } }

    private fun seen(text: String) {
        compose.onNode(hasScrollToIndexAction()).performScrollToNode(hasText(text))
    }

    @Test
    fun theIntroShowsTheCardAndKeepsItsPreparationClock() {
        harness.api.stored = examConversation(harness.id)
        show()

        compose.onNodeWithText("DELE B2 · Task 1 of 4").assertExists()
        seen("Lee las propuestas.")
        seen("Start preparing")
        compose.onNodeWithText("Start preparing").performClick()
        compose.waitForIdle()

        seen("Start again")
        assertTrue(harness.prep.started(harness.id))
    }

    @Test
    fun theCallShowsTheCardInsteadOfGoals() {
        harness.api.stored = examConversation(harness.id)
        show()
        harness.goLive(compose)

        seen("Lee las propuestas.")
        compose.onNodeWithText("Goals of the call").assertDoesNotExist()
    }

    @Test
    fun theResultRatesEachCriterionAndLeadsToTheNextTask() {
        val graded =
            """
            {"brainPower":8,"passed":true,"spokenSeconds":120,"stars":0,"feedback":{"kind":"examSpeaking","brief":false,"heard":true,"focus":"range",
            "criteria":[{"criterion":"fluency","bandLow":2,"bandHigh":3,"evidence":"Spoke steadily.","tip":"Keep going."},
                        {"criterion":"range","bandLow":1,"bandHigh":2,"evidence":"Few linking words.","tip":"Use sin embargo."}]}}
            """.trimIndent()
        harness.api.stored = examConversation(harness.id, result = graded)
        show()

        compose.onNodeWithText("2–3 of 3").assertExists()
        compose.onNodeWithText("At B2").assertExists()
        compose.onNodeWithText("Near B2").assertExists()
        compose.onNodeWithText("Focus").assertExists()
        compose.onNodeWithText("Continue").performClick()
        compose.onNodeWithText("Work on this first").assertExists()
        compose.onNodeWithText("Use sin embargo.").assertExists()

        compose.onNodeWithText("Go to task 2").performClick()
        assertEquals(1, harness.closed)
        assertEquals(listOf<AppRoute>(AppRoute.Speaking(task = "2")), harness.opened)
    }

    @Test
    fun anotherTryWritesANewCardAndOpensIt() {
        harness.api.stored =
            examConversation(harness.id, result = """{"brainPower":0,"passed":false,"spokenSeconds":0,"stars":0,"feedback":null}""")
        show()

        compose.onNodeWithText("This task has no estimate").assertExists()
        compose.onNodeWithText("Try this task with a new card").performClick()
        compose.waitForIdle()

        assertEquals(listOf<CallRequest>(CallRequest.ExamSpeaking(EXAM_GOAL, "1")), harness.api.starts)
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(harness.id.toString())), harness.opened)
    }

    @Test
    fun aSpeakingMockShowsItsBandThenEachCriterion() {
        val graded =
            """
            {"brainPower":5,"passed":true,"spokenSeconds":200,"stars":0,"feedback":{"kind":"speakingMock","exam":"ielts","focus":"grammar",
            "overall":{"bandLow":6,"bandHigh":6.5},
            "criteria":[{"criterion":"fluencyCoherence","bandLow":6,"bandHigh":6.5,"evidence":"e","tip":"t"},
                        {"criterion":"grammar","bandLow":5.5,"bandHigh":6,"evidence":"Tense slips.","tip":"Check past forms."}]}}
            """.trimIndent()
        harness.api.stored = examConversation(harness.id, result = graded, kind = "speakingMock", examTask = null, exam = "ielts")
        show()

        compose.onNodeWithText("6.0–6.5").assertExists()
        compose.onNodeWithText("Estimated band, from 0 to 9").assertExists()
        compose.onNodeWithText("Continue").performClick()
        compose.onNodeWithText("Fluency and coherence").assertExists()
        compose.onAllNodesWithText("Not rated").assertCountEquals(2)
    }
}
