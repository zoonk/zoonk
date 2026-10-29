package com.zoonk.android.feature.conversation

import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
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
import org.robolectric.Shadows.shadowOf
import java.time.Duration
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

    private fun show(call: LanguagePracticeCall = practiceCall()) {
        compose.setContent {
            ZoonkTheme {
                PracticeConversation(
                    call = call,
                    chapterId = chapter,
                    goalId = null,
                    start = { request ->
                        requests += request
                        answer?.await() ?: CallStart.Started(started)
                    },
                    open = { opened += it },
                )
            }
        }
        compose.onNodeWithText("Practice a conversation").performClick()
    }

    @Test
    fun theLearnerPicksALengthAndTheCallOpens() {
        show()

        compose.onAllNodesWithText("with Lucía · Waiter").assertCountEquals(2)
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
    fun aCallBeingWrittenShowsItsWaitThenOpens() {
        val pending = CompletableDeferred<CallStart>().also { answer = it }
        show()
        compose.onNodeWithText("Start the call").performClick()
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(1_100))

        compose.onNodeWithText("Your call opens as soon as it's ready.").assertExists()

        pending.complete(CallStart.Started(started))
        compose.waitForIdle()
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(started.toString())), opened)
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
