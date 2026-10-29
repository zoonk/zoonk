package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.ComposeContentTestRule
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
import com.zoonk.android.feature.onboarding.EXAM_GOAL_ID
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.levelTestOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.feature.onboarding.trueFalseQuestion
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingAnswerInputOneOf9
import com.zoonk.api.models.PlanTimeAdvice
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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
    private lateinit var navigator: AppNavigator

    @get:Rule
    val folder = TemporaryFolder()

    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private var screen by mutableIntStateOf(0)

    private fun show(
        goalId: String = GOAL_ID,
        drafts: SetupDrafts? = null,
    ) {
        val session = FakeSession(ana)
        val store = OnboardingStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)), session) { true }
        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                CompositionLocalProvider(LocalSetupDrafts provides drafts) {
                    key(screen) { GoalSetupScreen(AppRoute.GoalSetup(goalId), store, isGuest = false, navigator) }
                }
            }
        }
    }

    @Test
    fun aPickedAnswerSavesAndMovesOnAndBackReturnsToIt() {
        api.setup = { setupView(listOf("purpose", "level", "plan")) }
        api.reply = { _, _ -> setupView(listOf("level", "plan"), details = """{"answered":["purpose"]}""") }
        show()

        rule.onNodeWithText("What do you want from it?").assertIsDisplayed()
        rule.onNodeWithText("Use it at work").performClick()
        rule.mainClock.advanceTimeBy(500)

        rule.onNodeWithText("How much do you already know?").assertIsDisplayed()
        assertTrue(api.answers.single().second is OnboardingAnswerInput.OnboardingAnswerInputOneOfValue)

        rule.onNodeWithContentDescription("Back").performClick()
        rule.onNodeWithText("What do you want from it?").assertIsDisplayed()
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
    fun startingOverArchivesThisOnboardingsGoalsAndOpensTheWords() {
        api.setup = { setupView(listOf("purpose", "plan")) }
        show()

        rule.onNodeWithContentDescription("More").performClick()
        rule.onNodeWithText("Start over").performClick()
        rule.onNodeWithText("Start over?").assertIsDisplayed()
        rule.onNodeWithText("Start over").performClick()
        rule.waitForIdle()

        assertEquals(listOf(GOAL_ID), api.archived)
        assertEquals(AppRoute.StartGoal(), navigator.currentRoute)
    }

    @Test
    fun aPlacementQuestionsBackLeavesTheSetupWithoutStepsBackOrStartOver() {
        api.setup = { setupView(listOf("placement", "plan"), details = """{"answered":["purpose"]}""") }
        api.placement = placementOf(next = trueFalseQuestion())
        show()
        rule.onNodeWithContentDescription("Back").assertIsDisplayed()

        rule.onNodeWithText("Start").performScrollTo().performClick()

        rule.onNodeWithText("A contract needs consideration to be binding.").assertIsDisplayed()
        rule.onNodeWithContentDescription("More").assertDoesNotExist()
        rule.onNodeWithContentDescription("Back").performClick()

        assertEquals(AppRoute.Today, navigator.currentRoute)
        assertTrue(api.answers.isEmpty())
    }

    @Test
    fun theScheduleSendsItsTimeAndWeekdays() {
        api.setup = { setupView(listOf("schedule", "plan")) }
        show()

        rule.onNodeWithText("How much time can you study each day?").assertIsDisplayed()
        rule.onNodeWithText("Continue").performScrollTo().performClick()
        rule.waitForIdle()

        val answer = (api.answers.single().second as OnboardingAnswerInput.OnboardingAnswerInputOneOf8Value).value
        assertEquals(30L, answer.dailyMinutes)
        assertEquals(listOf(1L, 2L, 3L, 4L, 5L), answer.studyDays)
    }

    @Test
    fun theEstimateStopsAskingAfterItsLoadAndThreeFailedPollsAndTryAgainAsksAgain() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2026-11-08") }
        var reads = 0
        api.advice = {
            reads++
            throw ApiException(ApiError.Unavailable)
        }
        show()

        rule.mainClock.advanceTimeBy(10_000)
        rule.onNodeWithText("We couldn't work out what", substring = true).performScrollTo().assertIsDisplayed()
        assertEquals(4, reads)

        api.advice = {
            PlanTimeAdvice(
                coveredShare = 0.6,
                endDate = null,
                fullCourseEndDate = null,
                measure = PlanTimeAdvice.Measure.EXAM,
                numbers = null,
                ready = true,
                targetDate = LocalDate(2026, 11, 8),
                targetDateNamedMonth = false,
            )
        }
        rule.onNodeWithText("Try again").performScrollTo().performClick()
        rule.waitForIdle()

        rule.onNodeWithText("of the plan's exam topics in depth", substring = true).performScrollTo().assertIsDisplayed()
    }

    @Test
    fun aQuestionSaysWhenThePlanStoppedAndOffersToTryAgain() {
        api.setup = { setupView(listOf("purpose", "plan")) }
        api.generationId = { "run-1" }
        api.events = flowOf(GenerationEvent(status = "error", step = "workflowError"))
        show()

        rule.onNodeWithText("Building your plan stopped").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Your answers are saved. Try again so it's ready when you finish.").assertIsDisplayed()
        rule.onNodeWithText("Try again").performScrollTo().assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp")
    fun thePlanSoFarListsWhatWasAnsweredWithACareerChangesOwnLabels() {
        api.setup = {
            setupView(
                listOf("schedule", "plan"),
                details = """{"answered":["purpose","role"],"purpose":"careerChange","targetPosition":"data analyst","role":"teacher"}""",
            )
        }
        show()

        rule.onNodeWithText("The role you want").assertIsDisplayed()
        rule.onNodeWithText("data analyst").assertIsDisplayed()
        rule.onNodeWithText("What you do now").assertIsDisplayed()
        rule.onNodeWithText("teacher").assertIsDisplayed()
    }

    @Test
    fun unsentWordsComeBackWhenTheScreenIsRebuiltAndGoOnceTheAnswerSaves() {
        val draftStore =
            DraftStore(folder.newFolder(), CoroutineScope(SupervisorJob() + Dispatchers.IO), debounce = Duration.ZERO)
        runBlocking { draftStore.follow { DraftsChange(next = ana.accountId) } }
        val drafts = SetupDrafts(draftStore, ana)
        api.setup = { setupView(listOf("reason", "plan"), kind = "language") }
        show(drafts = drafts)

        rule.onNode(hasSetTextAction()).performTextInput("To pass the DELE")
        rule.onNodeWithText("To pass the DELE").assertExists()
        rule.waitUntil(5_000) { runBlocking { drafts.words(GOAL_ID, "reason").value.first() } == listOf("To pass the DELE") }
        screen++

        rule.onNodeWithText("To pass the DELE").assertIsDisplayed()
        api.reply = { goalId, _ -> setupView(listOf("plan"), goalId = goalId) }
        rule.onNodeWithText("Continue").performScrollTo().performClick()
        rule.waitForIdle()
        assertEquals(listOf(GOAL_ID), api.answers.map { it.first })
        rule.waitUntil(5_000) { runBlocking { drafts.words(GOAL_ID, "reason").value.first() } == null }
    }

    @Test
    fun aLanguageGoalPlacesWithItsLevelTestWhoseEndAnswersPlacement() {
        api.setup = { setupView(listOf("placement", "plan"), kind = "language", targetLanguage = "it") }
        api.levelTest = levelTestOf(answered = 3)
        show()

        rule.onNodeWithText("When does Marco go to the market?").assertIsDisplayed()
        rule.onNodeWithContentDescription("Questions answered").assertIsDisplayed()
        rule.onNodeWithText("Stop here and see my plan").performScrollTo().performClick()
        api.reply = { goalId, _ -> setupView(listOf("plan"), goalId = goalId) }
        rule.onNodeWithText("Build my plan").performScrollTo().performClick()
        rule.waitForIdle()

        assertEquals(1, api.finishedLevelTests)
        val answer = api.answers.single().second as OnboardingAnswerInput.OnboardingAnswerInputOneOf9Value
        assertEquals(OnboardingAnswerInputOneOf9.Question.PLACEMENT, answer.value.question)
    }
}
