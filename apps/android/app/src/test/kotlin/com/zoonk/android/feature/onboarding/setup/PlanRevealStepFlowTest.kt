package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.examGoal
import com.zoonk.android.feature.onboarding.feasibilityOf
import com.zoonk.android.feature.onboarding.numbersOf
import com.zoonk.android.feature.onboarding.phaseOf
import com.zoonk.android.feature.onboarding.planOf
import com.zoonk.android.feature.onboarding.subjectOf
import com.zoonk.android.feature.onboarding.syllabusOf
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Goal
import com.zoonk.api.models.OnboardingLibraryCourse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.LocalDate
import java.util.Locale
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlanRevealStepFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi()
    private lateinit var navigator: AppNavigator

    private fun show(
        isGuest: Boolean = false,
        run: GenerationRun = GenerationRun(status = GenerationRun.Status.Following),
        goal: Goal = examGoal(),
        libraryCourse: OnboardingLibraryCourse? = null,
    ) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val store =
            OnboardingStore(
                api,
                AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)),
                session,
            ) { SignInResult.SignedIn }
        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                    PlanRevealStep(goal, isGuest, libraryCourse, run, onRetryRun = null, store, navigator)
                }
            }
        }
    }

    @Test
    fun theReadyPlanShowsItsShapeAndStartsOnToday() {
        show()

        rule.onNodeWithText("Plan created").assertIsDisplayed()
        rule.onNodeWithText("Pass the bar exam").assertIsDisplayed()
        rule.onNodeWithText("53 days\u00A0· 30\u00A0min a day\u00A0· Mon – Fri").assertIsDisplayed()
        rule.onNodeWithText("Foundations\u00A0· day 1 of 21").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Final stretch").performScrollTo().assertIsDisplayed()

        navigator.select(AppTab.Plan)
        rule.onNodeWithText("Start").performScrollTo().performClick()

        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    fun theFactsSayTheWeekendsOwnTimeAndNoStudyTotal() {
        api.plan = planOf(numbers = numbersOf(600.0), weekdayMinutes = listOf(45, 30, 30, 30, 30, 30, 45), weekendMinutes = 45)
        show()

        rule.onNodeWithText("53 days\u00A0· 30\u00A0min a day, 45\u00A0min on weekends").assertIsDisplayed()
        rule.onNodeWithText("of study", substring = true).assertDoesNotExist()
    }

    @Test
    fun aPhaseBeforeTodaysShowsNoDateAndTodaysSaysToday() {
        val today = LocalDate.now()
        val earlier = today.minusDays(10)
        api.plan =
            planOf(
                phases =
                    listOf(
                        phaseOf(0, "foundations", "done", earlier, today.minusDays(1)),
                        phaseOf(1, "practice", "current", today, today.plusDays(20)),
                        phaseOf(2, "finalStretch", "upcoming", today.plusDays(21), today.plusDays(52)),
                    ),
            )
        show()

        rule.onNodeWithText("Today").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText(formatDate(today.plusDays(21), Locale.US, DateStyle.Day, today)).performScrollTo().assertIsDisplayed()
        rule.onNodeWithText(formatDate(earlier, Locale.US, DateStyle.Day, today)).assertDoesNotExist()
    }

    @Test
    fun aLearnGoalWithoutADateThatHoldsEveryPartSaysMoreTimeOrADateFinishesSooner() {
        api.plan =
            planOf(targetDate = null, endDate = LocalDate.now().plusDays(400), feasibility = feasibilityOf(measure = "goal", fits = true))
        show(goal = learnGoalWithoutDate())

        rule
            .onNodeWithText(
                "Your plan covers every part of your goal. To finish sooner, give it more time a day, or pick a date and it fits " +
                    "what matters most by then.",
            ).assertIsDisplayed()
    }

    @Test
    fun aLearnGoalWithoutADateThatStopsShortSaysTheTimeSetsHowFarItGoes() {
        api.plan = planOf(targetDate = null, endDate = LocalDate.now().plusDays(3_650), feasibility = feasibilityOf(measure = "goal"))
        show(goal = learnGoalWithoutDate())

        rule
            .onNodeWithText(
                "Your time a day sets how far your plan goes. To go further or finish sooner, give it more time a day, or pick a " +
                    "date and it fits what matters most by then.",
            ).assertIsDisplayed()
    }

    @Test
    fun aGuestIsAskedToSaveTheirPlan() {
        show(isGuest = true)

        rule.onNodeWithText("Save your plan so it's here next time.").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Create an account").performScrollTo().performClick()

        assertEquals(AppRoute.Login, navigator.currentRoute)
    }

    @Test
    fun timeThatDoesNotCoverTheExamSaysWhatItCovers() {
        api.plan = planOf(feasibility = feasibilityOf(coreFits = true, deepensMostAsked = false))
        api.syllabus = syllabusOf(listOf(subjectOf("Civil", percent = 60), subjectOf("Ethics", percent = 40, assumed = true)))
        show()

        rule
            .onNodeWithText("30\u00A0min a day studies every topic of the exam, some of them in less depth.")
            .performScrollTo()
            .assertIsDisplayed()
        rule.onNodeWithText("Weight by area").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("~ Estimated: the notice doesn't say how much this area weighs.").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun aPlanStillBeingBuiltShowsItsWaitUntilARead() {
        api.plan = planOf(ready = false)
        show()

        rule.onNodeWithText("Building your plan").assertIsDisplayed()
        api.plan = planOf()
        rule.mainClock.advanceTimeBy(POLL_MILLIS)

        rule.onNodeWithText("Plan created").assertIsDisplayed()
    }

    @Test
    fun aLibraryCourseThatFitsTheGoalIsOfferedWhileThePlanIsBuiltAndOpens() {
        api.plan = planOf(ready = false)
        show(libraryCourse = OnboardingLibraryCourse("zoonk", 12, UUID.fromString(LIBRARY_COURSE), "statistics", "Statistics"))

        rule.onNodeWithText("A course in the Library fits your goal").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("12 chapters").assertIsDisplayed()
        rule.onNodeWithText("Statistics").performClick()

        assertEquals(AppRoute.CatalogCourse(LIBRARY_COURSE), navigator.currentRoute)
    }

    @Test
    fun anExamsDocumentsBeingReadShowThatWait() {
        api.plan = planOf(notice = "reading")
        show()

        rule.onNodeWithText("Reading the exam's official documents").assertIsDisplayed()
        rule.onNodeWithContentDescription("Reading the official documents").assertIsDisplayed()
    }

    private fun learnGoalWithoutDate() = examGoal().copy(kind = Goal.Kind.LEARN, targetDate = null)

    private companion object {
        const val POLL_MILLIS = 3_500L
        const val LIBRARY_COURSE = "44444444-4444-4444-8444-444444444444"
    }
}
