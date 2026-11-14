package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.HeldRuns
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.LocalClock
import com.zoonk.android.ui.components.TestClock
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguagePracticeCall
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Instant
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class PracticeConversationTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val chapter = UUID.fromString("00000000-0000-4000-8000-0000000000a1")
    private val started = UUID.fromString("00000000-0000-4000-8000-0000000000c2")
    private val requests = mutableListOf<CallRequest>()
    private val opened = mutableListOf<AppRoute>()
    private val clock by lazy { TestClock(compose.mainClock) }

    private fun show(start: CallStarter) {
        compose.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    PracticeConversation(
                        call = practiceCall(),
                        chapterId = chapter,
                        goalId = null,
                        start = start,
                        open = { opened += it },
                    )
                }
            }
        }
        compose.onNodeWithText("Practice a conversation").performClick()
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

    /** The refusal's day comes while the sheet is open: Start is back, and tapping it asks the server again. */
    @Test
    fun aRefusedStartComesBackOnceItsDayComes() {
        show(
            start =
                callStarter(HeldRuns()) { request ->
                    requests += request
                    if (requests.size == 1) {
                        CallStart.Limited(Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, clock.opening))
                    } else {
                        CallStart.Started(started)
                    }
                },
        )
        compose.onNodeWithText("Start the call").performClick()

        compose.onNodeWithText("You've used your call time").assertExists()
        compose.onNodeWithText("More later today, or subscribe to keep going.").assertExists()

        clock.passOpening()
        compose.waitUntil(LIFT_TIMEOUT) { compose.onAllNodesWithText("Start the call").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("You can try again now.").assertDoesNotExist()
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        assertEquals(2, requests.size)
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(started.toString())), opened)
    }

    private fun starting(
        answers: ArrayDeque<CallStart>,
        runs: GenerationSource,
    ) = callStarter(runs) { request ->
        requests += request
        answers.removeFirst()
    }
}

private const val LIFT_TIMEOUT = 10_000L

private fun practiceCall(): LanguagePracticeCall =
    ApiJson.decodeFromString(
        """
        {"character":{"name":"Lucía","role":"Waiter"},"defaultMinutes":3,"limit":null,"minutes":[1,2,3],"paused":false,"plusMinutes":[5]}
        """.trimIndent(),
    )
