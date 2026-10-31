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
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onLast
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
import com.zoonk.android.feature.onboarding.levelTestOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.planOf
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.feature.onboarding.syllabusOf
import com.zoonk.android.feature.onboarding.trueFalseQuestion
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingAnswerInputOneOf9
import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeToCoverSuggestedSplit
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.runBlocking
import kotlinx.datetime.LocalDate
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
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
    private val planApi =
        FakePlanApi().apply {
            shownPlan = planOf()
            shownSyllabus = syllabusOf(emptyList(), kind = "modules")
        }
    private lateinit var navigator: AppNavigator

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
        goalId: String = GOAL_ID,
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
                navigator = rememberAppNavigator()
                CompositionLocalProvider(LocalSetupDrafts provides drafts) {
                    key(screen) { GoalSetupScreen(AppRoute.GoalSetup(goalId), store, plans, mocks, isGuest = false, navigator) }
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
    fun anExamChoiceSaysWhatStaysOutUntilItsPicked() {
        val specialty =
            """
            [{"group":"Specialty","leftOut":{"examPoints":360,"examQuestions":null,"name":"Specialty knowledge (P3)","points":180,"questions":null},
              "options":[{"name":"Auditing","shortName":null},{"name":"Technology","shortName":null}],"subject":null}]
            """.trimIndent()
        api.setup = { setupView(listOf("examChoice", "plan"), kind = "exam", examChoices = specialty) }
        show()

        rule.onNodeWithText("Which one will you take?").assertIsDisplayed()
        rule
            .onNodeWithText("Until you pick, your plan and mocks leave out Specialty knowledge (P3): 180 of the exam's 360 points.")
            .performScrollTo()
            .assertIsDisplayed()
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
    fun theDotsLeaveOptionalPlacementOutAndShowNoneDuringIt() {
        api.setup = { setupView(listOf("level", "placement", "plan")) }
        api.reply = { _, _ -> setupView(listOf("placement", "plan"), details = """{"answered":["level"]}""") }
        show()

        rule.onNodeWithContentDescription("Step 1 of 1").assertIsDisplayed()
        rule.onNodeWithText("The basics").performScrollTo().performClick()
        rule.waitForIdle()

        rule.onNodeWithText("Start").performScrollTo().assertIsDisplayed()
        rule.onNodeWithContentDescription("Step", substring = true).assertDoesNotExist()
    }

    @Test
    fun aLanguageGoalsQuickTestTakesTheTimeTheSetupSaysOnBothScreens() {
        api.setup = { setupView(listOf("level", "placement", "plan"), kind = "language", targetLanguage = "it", quickTestMinutes = 4) }
        api.reply = { _, _ ->
            setupView(
                listOf("placement", "plan"),
                kind = "language",
                targetLanguage = "it",
                details = """{"answered":["level"]}""",
                quickTestMinutes = 4,
            )
        }
        show()

        rule.onNodeWithText("Adapts to your answers, about 4\u00A0min").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Not sure, give me a quick test").performScrollTo().performClick()
        rule.waitForIdle()

        rule.onNodeWithText("About 4\u00A0min of reading", substring = true).performScrollTo().assertIsDisplayed()
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
        api.advice = { adviceOf(null, LocalDate(2027, 3, 15), targetDate = null) }
        show()

        rule.onNodeWithText("How much time can you study each day?").assertIsDisplayed()
        rule.onNodeWithText("You finish around March 2027.").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Continue").performScrollTo().performClick()
        rule.waitForIdle()

        val answer = (api.answers.single().second as OnboardingAnswerInput.OnboardingAnswerInputOneOf8Value).value
        assertEquals(30L, answer.dailyMinutes)
        assertEquals(listOf(1L, 2L, 3L, 4L, 5L), answer.studyDays)
    }

    @Test
    fun anUndatedGoalSaysAboutWhenItsPlanFinishesOrThatItCantTell() {
        api.setup = { setupView(listOf("schedule", "plan")) }
        api.advice = { input -> adviceOf(null, LocalDate(2027, 3, 15).takeIf { input.dailyMinutes == 30L }, targetDate = null) }
        show()

        rule.onNodeWithText("You finish around March 2027.").performScrollTo().assertIsDisplayed()

        pickTime(from = "30\u00A0min", to = "15\u00A0min")
        rule
            .onNodeWithText(
                "We can't estimate a finish date for this schedule. Try more time or more study days.",
            ).performScrollTo()
            .assertIsDisplayed()
    }

    @Test
    fun aDatedGoalStartsOnTheTimeItNeedsAndOffersItBackWhenAnotherFallsShort() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { coverOf(recommended = 45) }
        api.advice = { adviceOf(0.6) }
        show()

        rule.onNodeWithText("What it takes to cover all your exam topics by November 8, 2030.").performScrollTo().assertIsDisplayed()

        pickTime(from = "45\u00A0min", to = "30\u00A0min")
        rule
            .onNodeWithText(
                "Covers about 60% of your exam topics in depth by November 8, 2030, starting with what comes up most.",
            ).performScrollTo()
            .assertIsDisplayed()

        rule.onNodeWithText("Use 45\u00A0min a day to cover everything").performScrollTo().performClick()
        rule.onNodeWithText("Continue").performScrollTo().performClick()
        rule.waitForIdle()
        assertEquals(45L, (api.answers.single().second as OnboardingAnswerInput.OnboardingAnswerInputOneOf8Value).value.dailyMinutes)
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
    fun theTimesAndTheWeekendsTimeAreTheOnesTheSetupSends() {
        api.setup = { setupView(listOf("schedule", "plan"), timeChoices = listOf(5, 30, 45)) }
        api.advice = { adviceOf(null, LocalDate(2027, 3, 15), targetDate = null) }
        show()

        rule.onNodeWithContentDescription("Time a day, 30\u00A0min").performScrollTo().performClick()
        rule.onNodeWithText("15\u00A0min").assertDoesNotExist()
        rule.onNodeWithText("5\u00A0min").performClick()
        rule.onNodeWithContentDescription("Saturday").performScrollTo().performClick()
        rule.onNodeWithText("Different time on weekends").performScrollTo().performClick()
        rule.onNodeWithText("Time on weekends").performScrollTo().performClick()

        rule.onNodeWithText("45\u00A0min").assertIsDisplayed()
        rule.onNodeWithText("15\u00A0min").assertDoesNotExist()
    }

    @Test
    fun aDayNoTimeCoversStartsOnTheSuggestionAndSaysNotEvenAWholeDayCoversIt() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { coverOf(recommended = null, focus = 240) }
        show()

        rule.onNodeWithContentDescription("Time a day, 4\u00A0hr").performScrollTo().assertIsDisplayed()
        rule
            .onNodeWithText("Not even a whole day covers everything in depth by November 8, 2030. More study days would help.")
            .performScrollTo()
            .assertIsDisplayed()
        rule
            .onNodeWithText(
                "We suggest 4\u00A0hr a day. Your plan then covers every exam topic, the ones asked most in more depth. " +
                    "That's about 60% of the exam studied in depth.",
            ).performScrollTo()
            .assertIsDisplayed()
    }

    @Test
    fun aBigExamSaysWhatEverythingTakesBesideTheSuggestionAndTheLearnerPicksEither() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { coverOf(recommended = 805, focus = 240) }
        api.advice = { input -> adviceOf(if (input.dailyMinutes == 805L) 1.0 else 0.6) }
        show()

        rule.onNodeWithContentDescription("Time a day, 4\u00A0hr").performScrollTo().assertIsDisplayed()
        rule
            .onNodeWithText(
                "Covering everything in depth by November 8, 2030 takes about 13\u00A0hr 25\u00A0min a day, " +
                    "more than most people can keep up. More study days would help.",
            ).performScrollTo()
            .assertIsDisplayed()

        rule.onNodeWithText("Use 13\u00A0hr 25\u00A0min a day").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(1_000)

        rule
            .onNodeWithText("Covers all your exam topics by November 8, 2030. That's more than most people can keep up.")
            .performScrollTo()
            .assertIsDisplayed()
        rule.onNodeWithText("Use the suggested 4\u00A0hr a day").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithContentDescription("Time a day, 4\u00A0hr").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun theTimePickerMarksTheSuggestionAndTheTimeThatCoversEverything() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { coverOf(recommended = 805, focus = 240) }
        show()

        rule.onNodeWithContentDescription("Time a day, 4\u00A0hr").performScrollTo().performClick()

        rule.onNodeWithText("4\u00A0hr (suggested)").assertIsDisplayed()
        rule.onNodeWithText("13\u00A0hr 25\u00A0min (covers everything)").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun theStudyDaysComeAboveTheTime() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { coverOf(recommended = 45) }
        show()

        val days =
            rule
                .onNodeWithText("Study days")
                .fetchSemanticsNode()
                .boundsInRoot.top
        val time =
            rule
                .onNodeWithContentDescription("Time a day, 45\u00A0min")
                .fetchSemanticsNode()
                .boundsInRoot.top
        assertTrue(days < time)
    }

    @Test
    fun aDayTappedKeepsTheLastAnswerInPlaceWhileTheNewOneIsWorkedOut() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { input -> coverOf(recommended = if (input.studyDays.orEmpty().size == 5) 45 else 50) }
        api.coverGate = CompletableDeferred()
        show()

        rule.onNodeWithText("What it takes to cover all your exam topics by November 8, 2030.").performScrollTo().assertIsDisplayed()
        rule.onNodeWithContentDescription("Friday").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(1_000)

        rule.onNodeWithText("What it takes to cover all your exam topics by November 8, 2030.").assertExists()
        rule.onNodeWithText("Working out the time your goal needs…").assertDoesNotExist()
        rule.onNodeWithText("Continue").performScrollTo().assertIsNotEnabled()
    }

    @Test
    fun aPassedDateStartsTheDateScreenEmptyAndSaysItPassed() {
        api.setup = { setupView(listOf("targetDate", "plan"), targetDate = "2020-01-10", dateProblem = """{"kind":"passed"}""") }
        show()

        rule.onNodeWithText("Your date, January 10, 2020, has passed.", substring = true).assertIsDisplayed()
        rule.onNodeWithContentDescription("Date").assertIsDisplayed()
        rule.onNodeWithText("Continue").assertIsNotEnabled()
    }

    @Test
    fun aDateThatIsTodaySaysThereAreNoDaysLeftToPlan() {
        val today =
            java.time.LocalDate
                .now(java.time.ZoneOffset.UTC)
                .toString()
        api.setup = { setupView(listOf("targetDate", "plan"), targetDate = today, dateProblem = """{"kind":"today"}""") }
        show()

        rule.onNodeWithText("Your date is today, so there are no days left to plan.", substring = true).assertIsDisplayed()
        rule.onNodeWithContentDescription("Date").assertIsDisplayed()
    }

    @Test
    fun anExamWhoseDatePassedLeadsWithItsNextSitting() {
        api.setup = {
            setupView(
                listOf("targetDate", "plan"),
                kind = "exam",
                targetDate = "2020-01-10",
                dateProblem = """{"kind":"passed"}""",
                examDays = """{"days":["2030-11-08"],"estimated":false}""",
            )
        }
        show()

        rule.onNodeWithText("Your exam is on Nov 8, 2030").assertIsDisplayed()
        rule.onNodeWithText("Your date, January 10, 2020, has passed.", substring = true).assertIsDisplayed()
    }

    @Test
    fun aMonthWithNoSittingOffersTheClosestSittingsInOneTap() {
        api.setup = {
            setupView(
                listOf("targetDate", "plan"),
                kind = "exam",
                targetDate = "2030-08-15",
                dateProblem = """{"kind":"noSitting","month":"2030-08-01","closest":["2030-06-10","2030-10-05"]}""",
            )
        }
        show()

        rule.onNodeWithText("No exam date in August 2030").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Use October 5, 2030").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Use June 10, 2030").performScrollTo().performClick()
        rule.waitForIdle()

        assertEquals(
            kotlinx.datetime.LocalDate(2030, 6, 10),
            (api.answers.single().second as OnboardingAnswerInput.OnboardingAnswerInputOneOf4Value).value.targetDate,
        )
    }

    @Test
    fun aSuggestedTimePickedKeepsItsSplitOnceTheDaysChangeAgain() {
        api.setup =
            { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08", goalIds = listOf(GOAL_ID, EXAM_GOAL_ID)) }
        api.cover = { input ->
            when (input.studyDays.orEmpty().size) {
                5 -> coverOf(recommended = null)
                6 -> coverOf(recommended = 50, split = PlanTimeToCoverSuggestedSplit(mine = 35, others = 1, rest = 15))
                else -> coverOf(recommended = 40, split = PlanTimeToCoverSuggestedSplit(mine = 28, others = 1, rest = 12))
            }
        }
        api.advice = { adviceOf(0.6) }
        show()

        rule.onNodeWithContentDescription("Saturday").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithText("Use 50\u00A0min a day to cover everything").performScrollTo().performClick()
        rule.onNodeWithContentDescription("Sunday").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(1_000)

        rule.onNodeWithContentDescription("Time a day, 50\u00A0min").assertIsDisplayed()
        rule
            .onNodeWithText("This goal gets 35\u00A0min a day and your other goal 15\u00A0min.", substring = true)
            .performScrollTo()
            .assertIsDisplayed()

        rule.onNodeWithContentDescription("Time a day, 50\u00A0min").performClick()
        rule.onAllNodesWithText("50\u00A0min").onLast().performClick()

        rule
            .onNodeWithText("This goal gets 35\u00A0min a day and your other goal 15\u00A0min.", substring = true)
            .performScrollTo()
            .assertIsDisplayed()
    }

    @Test
    fun aGoalTypedWithAnotherSaysHowCoreSharesTheDay() {
        api.setup = {
            setupView(
                listOf("schedule", "plan"),
                goalIds = listOf(GOAL_ID, EXAM_GOAL_ID),
                split = { minutes -> """{"mine":${minutes - 5},"others":1,"rest":5}""" },
            )
        }
        api.advice = { adviceOf(null, LocalDate(2027, 3, 15), targetDate = null) }
        show()

        rule
            .onNodeWithText("This goal gets 25\u00A0min a day and your other goal 5\u00A0min.", substring = true)
            .performScrollTo()
            .assertIsDisplayed()
    }

    @Test
    fun aDayTooShortForTheGoalsTypedTogetherSaysTheLeastItTakes() {
        api.setup = { setupView(listOf("schedule", "plan"), goalIds = listOf(GOAL_ID, EXAM_GOAL_ID)) }
        api.advice = { adviceOf(null, LocalDate(2027, 3, 15), targetDate = null) }
        api.refusal =
            ApiException(
                ApiError.Unavailable,
                "DAY_TOO_SHORT",
                status = 422,
                details =
                    buildJsonObject {
                        put("goals", 2)
                        put("minutes", 10)
                    },
            )
        show()

        rule.onNodeWithText("You finish around March 2027.").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Continue").performScrollTo().performClick()
        rule.waitForIdle()

        rule.onNodeWithText("Choose at least 10\u00A0min a day for your 2 goals.").performScrollTo().assertIsDisplayed()
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
    fun aWeekWithNoDaysIsNeverAskedAbout() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.cover = { coverOf(recommended = 45) }
        show()

        for (day in listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday")) {
            rule.onNodeWithContentDescription(day).performScrollTo().performClick()
        }
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithContentDescription("Monday").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(1_000)

        assertTrue(api.coverAsks.none { it.studyDays.orEmpty().isEmpty() })
        assertEquals(listOf(1L), api.coverAsks.last().studyDays)
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
    fun aDatedGoalWaitsForItsPlanBeforeAskingTheTime() {
        api.setup = { setupView(listOf("schedule", "plan"), kind = "exam", targetDate = "2030-11-08") }
        api.generationId = { "run-1" }
        api.cover = { coverOf(recommended = null, ready = false) }
        show()

        rule.onNodeWithText("Building your plan").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("How much time can you study each day?").assertDoesNotExist()
    }

    @Test
    fun aGoalThatIsGoneOrNotTheLearnersSaysSoAndLeadsHome() {
        api.setup = { throw ApiException(ApiError.NotFound) }
        show()
        navigator.open(AppRoute.GoalSetup(GOAL_ID))

        rule.onNodeWithText("We couldn't find this page").assertIsDisplayed()
        rule.onNodeWithText("Try again").assertDoesNotExist()
        rule.onNodeWithText("Go to the home page").performClick()
        assertEquals(AppRoute.Today, navigator.currentRoute)
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
    fun thePlanSoFarSaysTheLevelTheTestFoundBeforeAnyOther() {
        api.setup = {
            setupView(
                listOf("schedule", "plan"),
                kind = "language",
                targetLanguage = "it",
                details = """{"answered":["level","placement"],"level":"B1+","levelNote":"I know a little"}""",
            )
        }
        show()

        rule.onNodeWithText("Your level").assertIsDisplayed()
        rule.onNodeWithText("B1+").assertIsDisplayed()
        rule.onNodeWithText("I know a little").assertDoesNotExist()
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp")
    fun thePlanSoFarSaysTheLevelPickedOverTheLevelTheWordsGave() {
        api.setup = { setupView(listOf("schedule", "plan"), details = """{"answered":["level"],"level":"basic","levelNote":"A2"}""") }
        show()

        rule.onNodeWithText("Your level").assertIsDisplayed()
        rule.onNodeWithText("The basics").assertIsDisplayed()
        rule.onNodeWithText("A2").assertDoesNotExist()
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp")
    fun thePlanSoFarSaysNoDateWhenTheLearnerChoseNone() {
        api.setup = { setupView(listOf("schedule", "plan"), details = """{"answered":["targetDate"]}""") }
        api.advice = { adviceOf(null, LocalDate(2027, 3, 15), targetDate = null) }
        show()

        rule.onNodeWithText("No date").assertIsDisplayed()
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
