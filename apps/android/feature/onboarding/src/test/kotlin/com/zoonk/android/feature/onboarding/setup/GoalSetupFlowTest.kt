package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.exam.FakeMockApi
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.onboarding.EXAM_GOAL_ID
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.adviceOf
import com.zoonk.android.feature.onboarding.coverOf
import com.zoonk.android.feature.onboarding.planOf
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.feature.onboarding.syllabusOf
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.OnboardingAnswerInput
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import kotlin.time.Duration

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class GoalSetupFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi()
    private val planApi =
        FakePlanApi().apply {
            shownPlan = planOf()
            shownSyllabus = syllabusOf(emptyList(), kind = "modules")
        }

    @get:Rule
    val folder = TemporaryFolder()

    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private var screen by mutableIntStateOf(0)

    private fun pickTime(
        from: String,
        to: String,
    ) {
        rule.onNodeWithContentDescription("Time a day, $from").performScrollTo().performClick()
        rule.onNodeWithText(to).performClick()
        // A new time asks the plan once the picks settle.
        rule.mainClock.advanceTimeBy(1_000)
    }

    private fun show(
        drafts: SetupDrafts? = null,
        restoration: StateRestorationTester? = null,
    ) {
        val session = FakeSession(ana)
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        val plans = PlanStore(planApi, cache)
        val mocks = MockStore(FakeMockApi(options = null), cache)
        val setContent: (@Composable () -> Unit) -> Unit = restoration?.let { it::setContent } ?: rule::setContent
        setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalSetupDrafts provides drafts) {
                    key(
                        screen,
                    ) { GoalSetupScreen(AppRoute.GoalSetup(GOAL_ID), store, plans, mocks, isGuest = false, rememberAppNavigator()) }
                }
            }
        }
    }

    @Test
    fun aReasonThatNamesAnExamMovesTheSetupToTheExamGoalAndItsRun() {
        api.setup = { setupView(listOf("reason", "plan"), kind = "language") }
        api.reply = { _, _ -> setupView(listOf("targetDate", "plan"), goalId = EXAM_GOAL_ID, kind = "exam") }
        api.generationId = { goalId -> "run-of-$goalId".takeIf { goalId == GOAL_ID } }
        show()

        rule.onNodeWithText("Why are you learning it?").assertIsDisplayed()
        rule.onNode(hasSetTextAction()).performTextInput("To pass the DELE B2 in May")
        api.generationReads.clear()
        rule.onNodeWithText("Continue").performScrollTo().performClick()

        rule.onNodeWithText("Is there a date you're aiming for?").assertIsDisplayed()
        assertEquals(listOf(EXAM_GOAL_ID), api.generationReads.distinct())
        api.reply = { goalId, _ -> setupView(listOf("plan"), goalId = goalId) }
        rule.onNodeWithText("No date, study everything").performScrollTo().performClick()
        rule.waitForIdle()

        assertEquals(listOf(GOAL_ID, EXAM_GOAL_ID), api.answers.map { it.first })
    }

    @Test
    fun theTimeAScreenStartedOnStaysThroughRecreationWhenFewerDaysHaveNoSuggestion() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { input -> coverOf(recommended = if (input.studyDays.orEmpty().size == 5) 45 else 2_000) }
        api.advice = { adviceOf(0.6) }
        val restoration = StateRestorationTester(rule)
        show(restoration = restoration)

        rule.onNodeWithContentDescription("Time a day, 45\u00A0min").assertIsDisplayed()
        rule.onNodeWithContentDescription("Friday").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithContentDescription("Time a day, 45\u00A0min").assertIsDisplayed()

        restoration.emulateSavedInstanceStateRestore()
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithContentDescription("Time a day, 45\u00A0min").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun continueWaitsForTheNewDaysTimeAndAfterAWhileSavesTheTimeShown() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { input -> coverOf(recommended = if (input.studyDays.orEmpty().size == 5) 45 else 50) }
        api.coverGate = CompletableDeferred()
        show()

        rule.onNodeWithContentDescription("Friday").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithText("Continue").performScrollTo().assertIsNotEnabled()

        rule.mainClock.advanceTimeBy(45_000)
        rule.onNodeWithText("We couldn't work out the time your goal needs.").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Continue").performScrollTo().performClick()
        rule.waitForIdle()

        assertEquals(45L, (api.answers.single().second as OnboardingAnswerInput.OnboardingAnswerInputOneOf8Value).value.dailyMinutes)
    }

    @Test
    fun oneTimeSearchGoesOutAtATimeAndTheLatestDaysAskNext() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { coverOf(recommended = 45) }
        api.coverGate = CompletableDeferred()
        show()

        for (day in listOf("Friday", "Thursday", "Wednesday")) {
            rule.onNodeWithContentDescription(day).performScrollTo().performClick()
            rule.mainClock.advanceTimeBy(1_000)
        }
        api.coverGate?.complete(Unit)
        rule.mainClock.advanceTimeBy(1_000)

        assertEquals(listOf(5, 4, 2), api.coverAsks.map { it.studyDays.orEmpty().size })
        assertEquals(1, api.coverMostAtOnce)
    }

    @Test
    fun daysChangedBeforeTheFirstTimeArrivesAskOnlyOnceItHas() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { coverOf(recommended = 45) }
        api.coverGate = CompletableDeferred()
        api.coverGateAfter = 0
        show()

        for (day in listOf("Friday", "Thursday")) {
            rule.onNodeWithContentDescription(day).performScrollTo().performClick()
            rule.mainClock.advanceTimeBy(1_000)
        }
        api.coverGate?.complete(Unit)
        rule.mainClock.advanceTimeBy(1_000)

        assertEquals(listOf(5, 3), api.coverAsks.map { it.studyDays.orEmpty().size })
        assertEquals(1, api.coverMostAtOnce)
    }

    @Test
    fun daysChangedJustBeforeTheScreenIsRebuiltWaitForTheTimeSearchOut() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { coverOf(recommended = 45) }
        api.coverGate = CompletableDeferred()
        val restoration = StateRestorationTester(rule)
        show(restoration = restoration)

        rule.onNodeWithContentDescription("Friday").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithContentDescription("Thursday").performScrollTo().performClick()
        restoration.emulateSavedInstanceStateRestore()
        rule.mainClock.advanceTimeBy(1_000)
        api.coverGate?.complete(Unit)
        rule.mainClock.advanceTimeBy(1_000)

        assertEquals(1, api.coverMostAtOnce)
        assertEquals(listOf(5, 4, 3), api.coverAsks.map { it.studyDays.orEmpty().size })
    }

    @Test
    fun daysChangedOnAReopenedSetupWaitForTheTimeSearchLeftOut() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { coverOf(recommended = 45) }
        api.coverGate = CompletableDeferred()
        show()

        rule.onNodeWithContentDescription("Friday").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(1_000)
        screen++
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithContentDescription("Thursday").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(1_000)
        api.coverGate?.complete(Unit)
        rule.mainClock.advanceTimeBy(1_000)

        assertEquals(1, api.coverMostAtOnce)
    }

    @Test
    fun aFirstTimeThatLandsAfterTheDaysChangedAndTheScreenIsRebuiltStillStartsIt() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { input -> coverOf(recommended = if (input.studyDays.orEmpty().size == 5) 45 else null) }
        api.coverGate = CompletableDeferred()
        api.coverGateAfter = 0
        val restoration = StateRestorationTester(rule)
        show(restoration = restoration)

        rule.onNodeWithContentDescription("Friday").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(1_000)
        restoration.emulateSavedInstanceStateRestore()
        rule.mainClock.advanceTimeBy(1_000)
        api.coverGate?.complete(Unit)
        rule.mainClock.advanceTimeBy(1_000)

        assertEquals(1, api.coverMostAtOnce)
        assertEquals(listOf(5, 4), api.coverAsks.map { it.studyDays.orEmpty().size })
        rule.onNodeWithContentDescription("Time a day, 45\u00A0min").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun aTimeThatTimedOutKeepsTheLastSuggestionThroughRecreation() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { input -> coverOf(recommended = if (input.studyDays.orEmpty().size == 5) 45 else 50) }
        api.coverGate = CompletableDeferred()
        api.coverGateAfter = 2
        val restoration = StateRestorationTester(rule)
        show(restoration = restoration)

        rule.onNodeWithContentDescription("Friday").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithContentDescription("Time a day, 50\u00A0min").assertIsDisplayed()
        rule.onNodeWithContentDescription("Thursday").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(46_000)
        rule.onNodeWithText("We couldn't work out the time your goal needs.").performScrollTo().assertIsDisplayed()

        restoration.emulateSavedInstanceStateRestore()
        rule.mainClock.advanceTimeBy(1_000)

        rule.onNodeWithContentDescription("Time a day, 50\u00A0min").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("We couldn't work out the time your goal needs.").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun theTimeIsAskedAgainAsSoonAsTheRunSaysThePlanIsMade() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.generationId = { "run-1" }
        val events = MutableSharedFlow<GenerationEvent>(replay = 1)
        api.events = events
        var ready = false
        api.cover = { coverOf(recommended = 45, ready = ready) }
        show()
        rule.mainClock.advanceTimeBy(500)
        rule.onNodeWithText("Building your plan").performScrollTo().assertIsDisplayed()

        ready = true
        events.tryEmit(GenerationEvent(status = "completed", step = "createPlan"))
        rule.mainClock.advanceTimeBy(500)

        rule.onNodeWithContentDescription("Time a day, 45\u00A0min").assertIsDisplayed()
    }

    @Test
    fun aFirstTimeAskThatHangsOnThePlansWaitOffersToReconnect() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08", planReady = false) }
        api.generationId = { "run-1" }
        api.cover = { coverOf(recommended = 45) }
        api.coverGateAfter = 0
        api.coverGate = CompletableDeferred()
        show()

        rule.mainClock.advanceTimeBy(46_000)
        rule.onNodeWithText("Reconnect").performScrollTo().performClick()
        rule.onNodeWithText("Connection lost").assertDoesNotExist()

        api.coverGate?.complete(Unit)
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithText("How much time can you study each day?").assertIsDisplayed()
    }

    @Test
    fun theTimesWorthStopsAskingAfterItsLoadAndThreeFailedPollsAndTryAgainAsksAgain() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { coverOf(recommended = 45) }
        var reads = 0
        api.advice = {
            reads++
            throw ApiException(ApiError.Unavailable)
        }
        show()
        pickTime(from = "45\u00A0min", to = "30\u00A0min")

        rule.mainClock.advanceTimeBy(10_000)
        rule.onNodeWithText("We couldn't work out what 30\u00A0min a day covers.").performScrollTo().assertIsDisplayed()
        assertEquals(4, reads)

        api.advice = { adviceOf(0.6) }
        rule.onNodeWithText("Try again").performScrollTo().performClick()
        rule.waitForIdle()

        rule.onNodeWithText("Covers about 60% of your exam topics", substring = true).performScrollTo().assertIsDisplayed()
    }

    @Test
    fun unsentWordsComeBackWhenTheScreenIsRebuiltAndGoOnceTheAnswerSaves() {
        val background = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val draftStore = DraftStore(folder.newFolder(), background, debounce = Duration.ZERO)
        runBlocking { draftStore.follow { DraftsChange(next = ana.accountId) } }
        val drafts = SetupDrafts(draftStore, ana)
        // Blocking the main thread to read it could deadlock with the screen's own read, which resumes there.
        val saved = drafts.words(GOAL_ID, "reason").value.stateIn(background, SharingStarted.Eagerly, null)
        api.setup = { setupView(listOf("reason", "plan"), kind = "language") }
        show(drafts = drafts)

        rule.onNode(hasSetTextAction()).performTextInput("To pass the DELE")
        rule.onNodeWithText("To pass the DELE").assertExists()
        rule.waitUntil(5_000) { saved.value == listOf("To pass the DELE") }
        screen++

        rule.onNodeWithText("To pass the DELE").assertIsDisplayed()
        api.reply = { goalId, _ -> setupView(listOf("plan"), goalId = goalId) }
        rule.onNodeWithText("Continue").performScrollTo().performClick()
        rule.waitForIdle()
        assertEquals(listOf(GOAL_ID), api.answers.map { it.first })
        rule.waitUntil(5_000) { saved.value == null }
    }
}
