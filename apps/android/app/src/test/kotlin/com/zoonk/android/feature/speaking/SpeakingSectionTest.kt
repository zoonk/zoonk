package com.zoonk.android.feature.speaking

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.conversation.CallRequest
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.SpeakingMockExam
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

/** The exam page's speaking pieces: the paper's section and the mock card. */
@RunWith(AndroidJUnit4::class)
class SpeakingSectionTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val goal = UUID.fromString("00000000-0000-4000-8000-0000000000d1")
    private val started = UUID.fromString("00000000-0000-4000-8000-0000000000d2")
    private val requests = mutableListOf<CallRequest>()
    private val opened = mutableListOf<AppRoute>()

    private val start: suspend (CallRequest) -> CallStart = {
        requests += it
        CallStart.Started(started)
    }

    @Test
    fun theExamPagesSectionNamesThePaperAndOpensItsCallsFromTheExam() {
        compose.setContent {
            ZoonkTheme {
                SpeakingPaperSection(
                    speakingPaper(),
                    goal,
                    openTask = null,
                    start = start,
                    open = { opened += it },
                    openWeb = {},
                    from = "exam",
                )
            }
        }

        compose.onNodeWithText("Speaking").assertExists()
        compose.onNodeWithText("DELE B2").assertExists()
        compose.onNodeWithText("Valorar propuestas").performClick()
        compose.onNodeWithText("Start this task").performClick()
        compose.waitForIdle()

        assertEquals(listOf<CallRequest>(CallRequest.ExamSpeaking(goal, "1")), requests)
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(started.toString(), from = "exam")), opened)
    }

    @Test
    fun theMockCardStartsAMockFromTheExam() {
        compose.setContent {
            ZoonkTheme {
                SpeakingMockCard(
                    SpeakingMockExam.IELTS,
                    goal,
                    paused = false,
                    start = start,
                    open = { opened += it },
                    from = "exam",
                )
            }
        }

        compose.onNodeWithText("IELTS speaking mock").assertExists()
        compose.onNodeWithText("Start the mock").performClick()
        compose.waitForIdle()

        assertEquals(listOf<CallRequest>(CallRequest.SpeakingMock(goal)), requests)
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(started.toString(), from = "exam")), opened)
    }

    @Test
    fun pausedCallsLeaveTheMockCardWithoutStart() {
        compose.setContent {
            ZoonkTheme { SpeakingMockCard(SpeakingMockExam.TOEFL, goal, paused = true, start = start, open = { opened += it }) }
        }

        compose.onNodeWithText("Calls are paused").assertExists()
        compose.onNodeWithText("Start the mock").assertDoesNotExist()
        assertTrue(requests.isEmpty())
    }
}
