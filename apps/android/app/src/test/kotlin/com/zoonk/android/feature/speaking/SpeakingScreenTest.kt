package com.zoonk.android.feature.speaking

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.conversation.CallRequest
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class SpeakingScreenTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val goal = UUID.fromString("00000000-0000-4000-8000-0000000000d1")
    private val started = UUID.fromString("00000000-0000-4000-8000-0000000000d2")
    private val requests = mutableListOf<CallRequest>()
    private val opened = mutableListOf<AppRoute>()
    private val webs = mutableListOf<String>()
    private var answer: CallStart = CallStart.Started(started)

    private fun show(
        read: SpeakingRead = SpeakingRead.Paper(speakingPaper()),
        openTask: String? = null,
    ) {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token-a", "local-a")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main),
            )
        val store = SpeakingStore({ _, _ -> read }, cache)
        val actions =
            SpeakingActions(
                start = {
                    requests += it
                    answer
                },
                open = { opened += it },
                openWeb = { webs += it },
            )
        compose.setContent { ZoonkTheme { SpeakingContent(store.paper(goal), goal, openTask, actions) } }
    }

    @Test
    fun aTaskOpensToItsCriteriaAndStartsItsCall() {
        show()

        compose.onNodeWithText("DELE B2").assertExists()
        compose.onNodeWithText("Valorar propuestas").performClick()
        compose.onNodeWithText("Rated on Fluency and Range of language.").assertExists()
        compose.onNodeWithText("Start this task").performClick()
        compose.waitForIdle()

        assertEquals(listOf<CallRequest>(CallRequest.ExamSpeaking(goal, "1")), requests)
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(started.toString())), opened)
    }

    @Test
    fun aLinkToATaskOpensItsRow() {
        show(openTask = "2")

        compose.onNodeWithText("Rated on Accuracy.").assertExists()
    }

    @Test
    fun aLockedPaperOffersPlusAndNoStart() {
        show(SpeakingRead.Paper(speakingPaper(access = "plusRequired")))

        compose
            .onNodeWithText(
                "Speaking practice comes with Plus: every task of the paper on a call, and an estimate on the official criteria after each one.",
            ).assertExists()
        compose.onNodeWithText("Valorar propuestas").performClick()
        compose.onNodeWithText("Start this task").assertDoesNotExist()
    }

    @Test
    fun theLastTryShowsAndOpensItsResult() {
        val last = UUID.fromString("00000000-0000-4000-8000-0000000000d3")
        show(SpeakingRead.Paper(speakingPaper(lastTry = """{"atLevel":1,"conversationId":"$last","nearLevel":1,"rated":2}""")))

        compose.onNodeWithText("Last try: 1 of 2 at B2").assertExists()
        compose.onNodeWithText("Valorar propuestas").performClick()
        compose.onNodeWithText("See your last result").performClick()
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(last.toString())), opened)
    }

    @Test
    fun noCallTimeLeftSaysSo() {
        answer = CallStart.Limited(Limit.Reached(LimitTier.Free, LimitPeriod.Day))
        show()

        compose.onNodeWithText("Valorar propuestas").performClick()
        compose.onNodeWithText("Start this task").performClick()
        compose.waitForIdle()

        compose.onNodeWithText("Not enough call time today for this task").assertExists()
        assertTrue(opened.isEmpty())
    }

    @Test
    fun aGoalThatIsntALanguagesOpensItsExamPage() {
        show(SpeakingRead.NotLanguage)
        compose.waitForIdle()

        assertEquals(listOf<AppRoute>(AppRoute.Exam), opened)
    }
}
