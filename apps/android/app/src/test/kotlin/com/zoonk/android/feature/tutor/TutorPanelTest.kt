package com.zoonk.android.feature.tutor

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performFirstLinkClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.conversation.CallRequest
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.feature.plan.planChange
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.MemoryChangeReference
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
import com.zoonk.api.models.TutorToolOffer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID
import kotlin.time.Clock
import kotlin.time.Duration.Companion.days

@RunWith(AndroidJUnit4::class)
class TutorPanelTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val api = FakeTutorApi()
    private val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
    private var openedLogin = 0
    private var openedPlus = 0
    private val opened = mutableListOf<AppRoute>()
    private val undone = mutableListOf<List<MemoryChangeReference>>()
    private val decided = mutableListOf<Pair<UUID, PlanChangeDecisionInput.Status>>()
    private var decision: (
        PlanChangeDecisionInput.Status,
    ) -> MutationResult<PlanChange> = { MutationResult.Done(planChange(status = it.value)) }
    private val calls = mutableListOf<CallRequest>()
    private val routes =
        TutorRoutes(
            createAccount = { openedLogin++ },
            signIn = { openedLogin++ },
            seePlus = { openedPlus++ },
            open = { opened += it },
            startCall = {
                calls += it
                CallStart.Started(CALL)
            },
        )

    private fun show(
        scope: TutorScope = TutorScope.Chapter("chapter"),
        access: TutorAccess = TutorAccess.Ask,
        page: TutorPage? = null,
    ) {
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main))
        val store =
            TutorStore(api, cache, session, { changes -> undone.add(changes) }) { goalId, _, status ->
                decided += goalId to status
                decision(status)
            }
        val vm = TutorViewModel(scope, store)
        compose.setContent {
            ZoonkTheme { TutorPanel(vm, access, TutorIdentity("Zu", BuddyLook()), routes, page = page) }
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

    @Test
    fun aGoalOfferStartsItOrOpensItsReadyCourse() {
        val offer =
            """{"kind":"startGoal","access":"open","goal":"Learn Spanish","course":""" +
                """{"id":"$COURSE","brandSlug":"zoonk","slug":"spanish","title":"Spanish basics","description":null,"imageUrl":null}}"""
        showOffer(offer)

        compose.onNodeWithText("“Learn Spanish”").assertExists()
        compose.onNodeWithText("Start").performClick()
        compose.onNodeWithText("Spanish basics").performScrollTo().performClick()

        assertEquals(listOf(AppRoute.StartGoal(goal = "Learn Spanish"), AppRoute.CatalogCourse(COURSE)), opened)
    }

    @Test
    fun aCallOfferPicksItsLengthAndStartsTheCallFromTheChat() {
        showOffer(
            """
            {"kind":"conversationCall","chapterId":"$CHAPTER","goalId":"$GOAL","unitTitle":"At the café",
             "call":{"character":{"name":"Lucía","role":"Waiter"},"defaultMinutes":3,"limit":null,"minutes":[1,2,3],"paused":false,"plusMinutes":[5]}}
            """.trimIndent(),
        )

        compose.onNodeWithText("Practice a conversation").performScrollTo().performClick()
        compose.onNodeWithText("2\u00A0min").performClick()
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        assertEquals(listOf<CallRequest>(CallRequest.Practice(UUID.fromString(CHAPTER), UUID.fromString(GOAL), 2)), calls)
        assertEquals(listOf<AppRoute>(AppRoute.Conversation(CALL.toString())), opened)
    }

    @Test
    fun aLockedOfferSaysWhatPlusAddsAndLeadsThere() {
        showOffer("""{"kind":"mockExam","access":"plusRequired","goalId":"$GOAL","subjects":[]}""")

        compose.onNodeWithText("Mock exams come with Plus: whenever you want, and every week in your plan.").assertExists()
        compose.onNodeWithText("Choose").assertDoesNotExist()
        compose.onNodeWithText("See Plus").performClick()

        assertEquals(1, openedPlus)
        assertEquals(emptyList<AppRoute>(), opened)
    }

    @Test
    fun undoingWhatTheBuddyRememberedSendsItsFact() {
        val fact = TutorMemoryChange.Fact(UUID.fromString(FACT), "Likes space")
        api.answers = {
            flow {
                emit(TutorAnswerEvent.Text("Noted."))
                emit(TutorAnswerEvent.Finish)
                emit(TutorAnswerEvent.Remembered(listOf(TutorMemoryChange(TutorMemoryChange.Action.Added, fact))))
            }
        }
        show()

        compose.onNode(hasSetTextAction()).performTextInput("I like space")
        compose.onNodeWithContentDescription("Send").performClick()
        compose.onNodeWithText("Memory updated: Likes space", substring = true).assertExists()
        compose.onNodeWithText("Undo").performClick()

        compose.onNodeWithText("Change undone", substring = true).assertExists()
        assertEquals(listOf(listOf(MemoryChangeReference(factId = UUID.fromString(FACT)))), undone)
    }

    @Test
    fun applyingAChangeTheBuddyOffersSaysHowThePlanTookIt() {
        showChange(planChange(status = "proposed", operations = """[{"kind":"setDailyMinutes","minutes":40}]"""))

        compose.onNodeWithText("Change to your plan").assertExists()
        compose.onNodeWithText("Apply").performScrollTo().performClick()

        compose.onNodeWithText("Your plan follows it from now on.").assertExists()
        compose.onNodeWithText("Apply").assertDoesNotExist()
        compose.onNodeWithText("Undo").assertExists()
        assertEquals(listOf(UUID.fromString(GOAL) to PlanChangeDecisionInput.Status.APPLIED), decided)
    }

    @Test
    fun aDecisionThatDidntSaveSaysSoAndCanBeTriedAgain() {
        decision = { MutationResult.Failed(ApiError.Network) }
        showChange(planChange(status = "proposed", operations = """[{"kind":"setDailyMinutes","minutes":40}]"""))

        compose.onNodeWithText("Not now").performScrollTo().performClick()

        compose.onNodeWithText("That didn't save. Try again.").assertExists()
        compose.onNodeWithText("Not now").assertIsEnabled()
    }

    @Test
    fun aPageOpensWithTheBuddysHelloAndAsksItsSuggestionsFromAboveTheComposer() {
        show(TutorScope.Plan(GOAL), page = PAGE)

        compose.onNodeWithText("Hi! I'm Zu.").assertExists()
        compose.onNodeWithText("What would you like help with?").assertDoesNotExist()
        compose.onNodeWithText("I want to study less this week").performClick()

        assertEquals(listOf("I want to study less this week"), api.asked.map { it.question })
    }

    @Test
    fun aPageDatesItsDaysAndLeavesOutWhatEachQuestionIsAbout() {
        val now = Clock.System.now()
        api.thread =
            TutorThread(
                listOf(
                    turn("q1", TutorTurn.Status.Completed, "Earlier.").copy(createdAt = now - 1.days),
                    turn("q2", TutorTurn.Status.Completed, "Now.").copy(createdAt = now),
                ),
                hasMore = false,
                nextCursor = null,
            )
        show(TutorScope.Plan(GOAL), page = PAGE)

        compose.onNodeWithText("About your plan").assertDoesNotExist()
        compose.onNodeWithText("Today").assertExists()
        compose.onNode(hasScrollToIndexAction()).performScrollToIndex(0)
        compose.onNodeWithText("Yesterday").assertExists()
    }

    @Test
    fun aGuestOnAPageSeesTheHelloAndIsAskedToCreateAnAccount() {
        show(TutorScope.Plan(GOAL), access = TutorAccess.Guest, page = PAGE)

        compose.onNodeWithText("Hi! I'm Zu.").assertExists()
        compose.onNodeWithText("Create a free account").performClick()

        assertEquals(1, openedLogin)
        assertEquals(0, api.threadReads)
    }

    private fun showChange(change: PlanChange) {
        api.thread =
            TutorThread(
                listOf(turn("q1", TutorTurn.Status.Completed, "Try 40 minutes.").copy(planChange = change)),
                hasMore = false,
                nextCursor = null,
            )
        show(TutorScope.Plan(GOAL))
    }

    private fun showOffer(json: String) {
        val offer = ApiJson.decodeFromString<TutorToolOffer>(json)
        api.thread =
            TutorThread(listOf(turn("q1", TutorTurn.Status.Completed, "Here.", toolOffer = offer)), hasMore = false, nextCursor = null)
        show()
    }

    private companion object {
        val PAGE =
            TutorPage(
                greeting = "Hi! I'm Zu.",
                suggestions = listOf(TutorSuggestion("I want to study less this week")),
                placeholder = "Ask a question or request a change",
            )

        const val COURSE = "6a1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val GOAL = "7b1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val CHAPTER = "7b1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e60"
        val CALL: UUID = UUID.fromString("7b1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e61")
        const val FACT = "8f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
    }
}
