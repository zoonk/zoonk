package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.HeldRuns
import com.zoonk.android.data.WritingRuns
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguagePracticeCall
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class PracticeConversationTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val chapter = UUID.fromString("00000000-0000-4000-8000-0000000000a1")
    private val started = UUID.fromString("00000000-0000-4000-8000-0000000000c2")
    private val requests = mutableListOf<CallRequest>()
    private val opened = mutableListOf<AppRoute>()
    private var answer: CompletableDeferred<CallStart>? = null

    private fun show(
        call: LanguagePracticeCall = practiceCall(),
        start: CallStarter =
            callStarter { request ->
                requests += request
                answer?.await() ?: CallStart.Started(started)
            },
    ) {
        compose.setContent {
            ZoonkTheme {
                PracticeConversation(
                    call = call,
                    chapterId = chapter,
                    goalId = null,
                    start = start,
                    open = { opened += it },
                )
            }
        }
        compose.onNodeWithText("Practice a conversation").performClick()
    }

    @Test
    fun theLearnerPicksALengthAndTheCallOpens() {
        show()

        compose.onAllNodesWithText("with Lucía\u00A0· Waiter").assertCountEquals(2)
        compose.onNodeWithText("2\u00A0min").performClick()
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        assertEquals(listOf<CallRequest>(CallRequest.Practice(chapter, null, 2)), requests)
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(started.toString())), opened)
    }

    @Test
    fun aLongerCallOffersPlusInsteadOfStart() {
        show()

        compose.onNodeWithText("5\u00A0min").performClick()

        compose.onNodeWithText("Longer calls come with Plus.").assertExists()
        compose.onNodeWithText("Start the call").assertDoesNotExist()
        compose.onNodeWithText("See Plus").performClick()
        assertEquals(listOf<AppRoute>(AppRoute.Subscription), opened)
    }

    @Test
    fun aCallBeingWrittenShowsItsWaitThenStartsAgainAndOpensOnceWritten() {
        val runs = HeldRuns()
        val answers = ArrayDeque(listOf<CallStart>(CallStart.Writing("run-1"), CallStart.Started(started)))
        show(start = starting(answers, runs))
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        compose.onNodeWithText("Your call opens as soon as it's ready.").assertExists()
        assertEquals(1, requests.size)

        runs.write()
        compose.waitForIdle()
        assertEquals(2, requests.size)
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(started.toString())), opened)
    }

    @Test
    fun aCallStillUnwrittenAfterItsRunSaysItDidntStartRatherThanWaitingAgain() {
        val answers = ArrayDeque(listOf<CallStart>(CallStart.Writing("run-1"), CallStart.Writing("run-2")))
        show(start = starting(answers))
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        compose.onNodeWithText("The call didn't start. Try again in a moment.").assertExists()
        assertEquals(2, requests.size)
        assertTrue(opened.isEmpty())
    }

    @Test
    fun aRunThatFailedIsTriedAgainBySendingTheStartAgain() {
        val answers = ArrayDeque(listOf<CallStart>(CallStart.Writing("run-1"), CallStart.Started(started)))
        show(start = starting(answers, runs = WritingRuns(finishes = false)))
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("This didn't finish").assertExists()

        compose.onNodeWithText("Try again").performClick()
        compose.waitForIdle()
        assertEquals(2, requests.size)
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(started.toString())), opened)
    }

    private fun starting(
        answers: ArrayDeque<CallStart>,
        runs: GenerationSource = WritingRuns(),
    ) = callStarter(runs) { request ->
        requests += request
        answers.removeFirst()
    }

    @Test
    fun aStartThatFailsSaysSoAndCanBeTriedAgain() {
        answer = CompletableDeferred(CallStart.Failed)
        show()
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        compose.onNodeWithText("The call didn't start. Try again in a moment.").assertExists()
        assertTrue(opened.isEmpty())
    }

    @Test
    fun aStartRefusedBecauseCallsArePausedSaysSoAndStartsOnceTheyreBack() {
        val harness = ConversationHarness()
        harness.api.startRefusal = ApiException(ApiError.Unavailable, "CALLS_PAUSED", 503)
        show(start = harness.store)
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        compose.onNodeWithText("It's the same for everyone right now. Try again later.").assertExists()
        compose.onNodeWithText("The call didn't start. Try again in a moment.").assertDoesNotExist()

        harness.api.startRefusal = null
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        assertEquals(1, opened.size)
    }

    @Test
    fun pausedCallsSayItsTheSameForEveryone() {
        show(practiceCall(paused = true))

        compose.onNodeWithText("It's the same for everyone right now. Try again later.").assertExists()
        compose.onNodeWithText("Start the call").assertDoesNotExist()
    }
}

private fun practiceCall(paused: Boolean = false): LanguagePracticeCall =
    ApiJson.decodeFromString(
        """
        {"character":{"name":"Lucía","role":"Waiter"},"defaultMinutes":3,"limit":null,"minutes":[1,2,3],"paused":$paused,"plusMinutes":[5]}
        """.trimIndent(),
    )
