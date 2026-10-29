package com.zoonk.android.feature.tutor

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performFirstLinkClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.BuddyLook
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

@RunWith(AndroidJUnit4::class)
class TutorPanelTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val api = FakeTutorApi()
    private val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
    private var openedLogin = 0
    private val opened = mutableListOf<AppRoute>()
    private val routes = TutorRoutes(createAccount = { openedLogin++ }, signIn = { openedLogin++ }, seePlus = {}, open = { opened += it })

    private fun show(
        scope: TutorScope = TutorScope.Chapter("chapter"),
        access: TutorAccess = TutorAccess.Ask,
    ) {
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main))
        val vm = TutorViewModel(scope, TutorStore(api, cache, session))
        compose.setContent {
            ZoonkTheme { TutorPanel(vm, access, TutorIdentity("Zu", BuddyLook()), routes) }
        }
    }

    @Test
    fun askingShowsTheQuestionAndItsAnswer() {
        api.answers = {
            flow {
                emit(TutorAnswerEvent.Text("An orbit is a path."))
                emit(TutorAnswerEvent.Finish)
            }
        }
        show()

        compose.onNodeWithText("What would you like help with?").assertExists()
        compose.onNodeWithText("Zu is an AI study buddy and can make mistakes.").assertExists()
        compose.onNodeWithContentDescription("Send").assertIsNotEnabled()

        compose.onNode(hasSetTextAction()).performTextInput("What is an orbit?")
        compose.onNodeWithContentDescription("Send").assertIsEnabled().performClick()

        compose.onNodeWithText("What is an orbit?").assertExists()
        compose.onNodeWithText("About this chapter").assertExists()
        compose.onNodeWithText("An orbit is a path.").assertExists()
    }

    @Test
    fun aSuggestionAsksItAtOnce() {
        show(TutorScope.Plan("goal"))

        compose.onNodeWithText("Why am I studying this today?").performClick()

        assertEquals(listOf("Why am I studying this today?"), api.asked.map { it.question })
    }

    @Test
    fun aGuestIsAskedToCreateAnAccountFirst() {
        show(access = TutorAccess.Guest)

        compose.onNodeWithText("Create a free account to ask questions").assertExists()
        compose.onNodeWithText("Create a free account").performClick()

        assertEquals(1, openedLogin)
        assertEquals(0, api.threadReads)
    }

    @Test
    fun aHelpLimitTakesTheComposersPlace() {
        val details = Json.parseToJsonElement("""{"limit":{"period":"day","tier":"guest"}}""")
        api.refusal = ApiException(ApiError.Unavailable, "USAGE_LIMIT_REACHED", 403, details)
        show()

        compose.onNode(hasSetTextAction()).performTextInput("Why?")
        compose.onNodeWithContentDescription("Send").performClick()

        compose.onNodeWithText("You've used today's free help. Create a free account to keep going.").assertExists()
        compose.onNodeWithText("Create a free account").performClick()
        assertEquals(1, openedLogin)
    }

    @Test
    fun aFailedAnswerSaysSoAndCanBeTriedAgain() {
        api.answers = { flow { throw ApiException(ApiError.Network) } }
        api.question = { id -> turn(id, TutorTurn.Status.Pending, null) }
        show()

        compose.onNode(hasSetTextAction()).performTextInput("Why?")
        compose.onNodeWithContentDescription("Send").performClick()
        compose.onNodeWithText("We couldn't finish this answer.").assertExists()

        api.answers = {
            flow {
                emit(TutorAnswerEvent.Text("Because."))
                emit(TutorAnswerEvent.Finish)
            }
        }
        compose.onNodeWithText("Try again").performClick()

        compose.onNodeWithText("Because.").assertExists()
    }

    @Test
    fun aLearnerWhoseSessionEndedIsAskedToSignInAgain() {
        show(access = TutorAccess.SignedOut)

        compose.onNodeWithText("Your session expired. Sign in again.").assertExists()
        compose.onNodeWithText("Sign in").performClick()

        assertEquals(1, openedLogin)
    }

    @Test
    fun aCheckedLinkToZoonkOpensItsPageInTheApp() {
        api.thread =
            TutorThread(listOf(turn("q1", TutorTurn.Status.Completed, "Look at [your plan](/plan).")), hasMore = false, nextCursor = null)
        show()

        compose.onNodeWithText("Look at your plan.", substring = true).performFirstLinkClick()

        assertEquals(listOf<AppRoute>(AppRoute.Plan()), opened)
    }
}
