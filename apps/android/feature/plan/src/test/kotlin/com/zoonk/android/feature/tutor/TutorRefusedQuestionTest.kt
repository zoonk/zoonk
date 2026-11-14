package com.zoonk.android.feature.tutor

import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.feature.conversation.callStarter
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.LocalClock
import com.zoonk.android.ui.components.TestClock
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Duration
import java.time.Instant

/** A question the month's messages cap refused stays unanswered when its day comes: same words, and Try again asks again. */
@RunWith(AndroidJUnit4::class)
class TutorRefusedQuestionTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val api = FakeTutorApi()
    private val clock by lazy { TestClock(compose.mainClock) }
    private var answerRequests = 0

    private fun refusedUntil(at: Instant) =
        ApiException(
            ApiError.Unavailable,
            "USAGE_LIMIT_REACHED",
            status = 402,
            details =
                Json.parseToJsonElement(
                    """{"limit":{"availableAt":"$at","limit":100,"period":"rolling30Days","resource":"tutorMessage","tier":"free"}}""",
                ),
        )

    private fun waitFor(text: String) = compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }

    @Test
    fun aRefusedQuestionKeepsItsWordsAndOffersTryAgainOnceItsDayComes() {
        api.thread = TutorThread(emptyList(), hasMore = false, nextCursor = null)
        api.question = { id -> turn(id, TutorTurn.Status.Pending, null, question = "What is a photon?") }
        api.answers = {
            answerRequests++
            val opens = if (answerRequests == 1) clock.opening else clock.start.plus(Duration.ofDays(5))
            flow { throw refusedUntil(opens) }
        }
        show()

        compose.onNode(hasSetTextAction()).performTextInput("What is a photon?")
        compose.onNodeWithContentDescription("Send").performClick()
        waitFor("You've used your messages")
        compose.onNodeWithText("This one wasn't answered.").assertExists()
        compose.onNodeWithText("Try again").assertDoesNotExist()

        clock.passOpening()
        waitFor("Try again")
        compose.onNodeWithText("This one wasn't answered.").assertExists()
        compose.onNodeWithText("We couldn't finish this answer.").assertDoesNotExist()
        compose.onNodeWithText("You've used your messages").assertDoesNotExist()

        compose.onNodeWithText("Try again").performClick()
        waitFor("You've used your messages")

        assertEquals(2, answerRequests)
        compose.onNodeWithText("This one wasn't answered.").assertExists()
        compose.onNodeWithText("Try again").assertDoesNotExist()
    }

    private fun show() {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main))
        val store =
            TutorStore(
                api,
                cache,
                session,
                { MutationResult.Done(Unit) },
                { _, _ -> MutationResult.Done(Unit) },
                { _, _ -> MutationResult.Done(Unit) },
                { true },
            ) { _, _, _ -> MutationResult.Obsolete }
        val vm = TutorViewModel(TutorScope.Plan("goal"), store, SavedStateHandle()) { MutationResult.Obsolete }
        val routes = TutorRoutes(createAccount = {}, signIn = {}, subscribe = {}, open = {}, startCall = callStarter { CallStart.Failed })

        compose.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme { Surface { TutorPanel(vm, TutorAccess.Ask, TutorIdentity("Zu", BuddyLook()), routes) } }
            }
        }
    }
}
