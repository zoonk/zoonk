package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.getBoundsInRoot
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
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguagePracticeCall
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Instant
import java.util.Locale
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

    private fun show(
        start: CallStarter,
        call: LanguagePracticeCall = practiceCall(),
    ) {
        compose.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
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

    private fun refused(): CallStarter = callStarter(HeldRuns()) { error("A limited sheet never starts a call") }

    private fun minutes(count: Int) = formatMinutes(count, Locale.getDefault())

    private fun top(text: String) = compose.onNodeWithText(text).getBoundsInRoot().top

    /** As main: the limit keeps the sheet's shape, and its action box holds Subscribe alone for a free learner. */
    @Test
    fun aFreeLearnersLimitKeepsTheLengthsWithSubscribeAlone() {
        show(refused(), practiceCall(limit = limitJson("free", clock.opening)))

        compose.onNodeWithText(minutes(2)).assertExists()
        compose.onNodeWithText("You've used your call time").assertExists()
        compose.onNodeWithText("Subscribe").assertExists()
        compose.onNodeWithText("Start the call").assertDoesNotExist()
    }

    /** A guest's limit has no date and never lifts: Create a free account alone, the same shape. */
    @Test
    fun aGuestsLimitOffersAnAccountAlone() {
        show(refused(), practiceCall(limit = """{"period":"total","tier":"guest"}"""))

        compose.onNodeWithText("Create a free account").assertExists()
        compose.onNodeWithText("Subscribe").assertDoesNotExist()
        compose.onNodeWithText("Start the call").assertDoesNotExist()
    }

    /** With no call time left the server sends no lengths, and the sheet shows neither them nor their label. */
    @Test
    fun noLengthsShowNoLabel() {
        show(refused(), practiceCall(limit = limitJson("free", clock.opening), minutes = "[]", plusMinutes = "[]"))

        compose.onNodeWithText("Call length").assertDoesNotExist()
        compose.onNodeWithText("Subscribe").assertExists()
    }

    /** A Plus learner's Start waits, disabled, while the lengths stay pickable; the pick is the one that starts. */
    @Test
    fun aPickMadeWhileTheLimitHoldsStartsOnceItLifts() {
        show(
            callStarter(HeldRuns()) { request ->
                requests += request
                CallStart.Started(started)
            },
            practiceCall(limit = limitJson("plus", clock.opening)),
        )

        compose.onNodeWithText("Start the call").assertIsNotEnabled()
        compose.onNodeWithText("Subscribe").assertDoesNotExist()
        compose.onNodeWithText(minutes(2)).performClick()

        clock.passOpening()
        compose.waitUntil(LIFT_TIMEOUT) {
            compose.onAllNodesWithText("Start the call").fetchSemanticsNodes().any {
                SemanticsProperties.Disabled !in
                    it.config
            }
        }
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        assertEquals(2L, (requests.single() as CallRequest.Practice).minutes)
    }

    /** At the instant the action takes Subscribe's box and nothing in the sheet moves. */
    @Test
    fun nothingMovesWhenTheLimitLifts() {
        show(refused(), practiceCall(limit = limitJson("free", clock.opening)))
        val title = compose.onAllNodesWithText("Practice a conversation")[1].getBoundsInRoot().top
        val action = top("Subscribe")
        val lengths = top(minutes(1))

        clock.passOpening()
        compose.waitUntil(LIFT_TIMEOUT) { compose.onAllNodesWithText("Start the call").fetchSemanticsNodes().isNotEmpty() }

        assertEquals(action, top("Start the call"))
        assertEquals(lengths, top(minutes(1)))
        assertEquals(title, compose.onAllNodesWithText("Practice a conversation")[1].getBoundsInRoot().top)
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

private fun limitJson(
    tier: String,
    availableAt: Instant,
) = """{"availableAt":"$availableAt","period":"rolling30Days","tier":"$tier"}"""

private fun practiceCall(
    limit: String = "null",
    minutes: String = "[1,2,3]",
    plusMinutes: String = "[5]",
): LanguagePracticeCall =
    ApiJson.decodeFromString(
        """
        {"character":{"name":"Lucía","role":"Waiter"},"defaultMinutes":3,"limit":$limit,"minutes":$minutes,"paused":false,"plusMinutes":$plusMinutes}
        """.trimIndent(),
    )
