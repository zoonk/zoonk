package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.onboarding.DAILY_TIMES
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanChangeResult
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.LocalDate

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h2400dp")
class PlanCoverageTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val changes = mutableListOf<Pair<PlanPart, List<PlanOp>>>()
    private var finds = 0
    private val opened = mutableListOf<String>()

    private var shownFound by mutableStateOf<TimeToCoverState>(TimeToCoverState.Idle)

    /** [finding] is what a find answers; [saved] what a change does. */
    private fun show(
        plan: Plan = coveragePlan(),
        kind: String = "learn",
        pending: Set<PlanPart> = emptySet(),
        found: TimeToCoverState = TimeToCoverState.Idle,
        finding: TimeToCoverState? = null,
        saved: PlanChangeResult? = null,
    ) {
        val summary = learnerSummary(kind = kind)
        val page = PlanPageState(summary.goals.first(), plan, summary)
        shownFound = found
        compose.setContent {
            val edits =
                PlanEdits(
                    pending = pending,
                    change = { part, operations, answered ->
                        changes += part to operations
                        saved?.let(answered)
                    },
                    timeToCover = shownFound,
                    findTimeToCover = { _, _ ->
                        finds++
                        finding?.let { shownFound = it }
                    },
                    chooseFocus = { opened += "focus" },
                    studyEverything = { opened += "everything" },
                )
            ZoonkTheme { Column { PlanEditorBody(page, edits) } }
        }
    }

    private fun answered(
        plan: Plan = coveragePlan(),
        time: com.zoonk.api.models.PlanTimeToCover = timeToCover(),
    ) = TimeToCoverState.Answered(timeToCoverRevision(plan), time)

    @Test
    fun theEditorAsksForTheTimeQuestionsAnswerAsItOpens() {
        show()

        assertEquals(1, finds)
        compose
            .onNodeWithText("Covers about 60% of your goal in depth by January 31, 2027, starting with what matters most.")
            .performScrollTo()
            .assertIsDisplayed()
        compose.onNodeWithText("Working out the time your goal needs…").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Find the time that covers everything").assertDoesNotExist()
    }

    @Test
    fun aFocusSuggestionSaysWhatEverythingTakesAndOffersTheSuggestedTime() {
        show(found = answered(time = timeToCover(recommended = 805, focus = 240)))

        compose
            .onNodeWithText(
                "Covering everything in depth by January 31, 2027 takes about 13\u00A0hr 25\u00A0min a day, " +
                    "more than most people can keep up. More study days would help.",
            ).performScrollTo()
            .assertIsDisplayed()
        compose.onNodeWithText("Use the suggested 4\u00A0hr a day").performScrollTo().performClick()

        assertEquals(listOf(PlanPart.Schedule to listOf<PlanOp>(PlanOp.DailyMinutes(240))), changes)
        compose.onNodeWithContentDescription("Time a day, 20\u00A0min").assertIsFocused()
    }

    @Test
    fun aLearnerOnTheTimeThatCoversEverythingHearsItIsMoreThanMostKeepUpAndCanGoBack() {
        val full =
            plan(
                """
                "feasibility":{"coreFits":true,"coveredShare":1,"deadline":"2027-01-31","deepensMostAsked":false,"fits":true,
                 "measure":"goal","timeCovers":true},
                "schedule":{"dailyMinutes":805,"dailyTimes":$DAILY_TIMES,"fullCourse":false,"lightWeeks":[],"studyDays":5,"targetDate":"2027-01-31",
                 "targetDateEstimated":false,"targetDateNamedMonth":false,"shape":{"canDiffer":false,"weekdayDays":[1,2,3,4,5],"weekdays":805,"weekend":null,
                 "weekendDays":[]},"weekdayMinutes":[0,805,805,805,805,805,0]}
                """.trimIndent(),
            )
        show(plan = full, found = answered(plan = full, time = timeToCover(recommended = 805, focus = 240)))

        compose
            .onNodeWithText("Covers your whole goal by January 31, 2027. That's more than most people can keep up.")
            .performScrollTo()
            .assertIsDisplayed()
        compose.onNodeWithText("Use the suggested 4\u00A0hr a day").performScrollTo().performClick()

        assertEquals(listOf(PlanPart.Schedule to listOf<PlanOp>(PlanOp.DailyMinutes(240))), changes)
    }

    @Test
    fun thePickerMarksTheSuggestedTimeAndTheOneThatCoversEverything() {
        show(found = answered(time = timeToCover(recommended = 805, focus = 240)))

        compose.onNodeWithContentDescription("Time a day, 20\u00A0min").performClick()

        compose.onNodeWithText("4\u00A0hr (suggested)").assertIsDisplayed()
        compose.onNodeWithText("13\u00A0hr 25\u00A0min (covers everything)").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun theSuggestionThatCoversEverythingIsUsedInOneTapAndTheKeyboardWaitsOnThePicker() {
        show(found = answered(time = timeToCover(recommended = 45)))

        compose.onNodeWithText("Use 45\u00A0min a day to cover everything").performClick()

        assertEquals(listOf(PlanPart.Schedule to listOf<PlanOp>(PlanOp.DailyMinutes(45))), changes)
        compose.onNodeWithContentDescription("Time a day, 20\u00A0min").assertIsFocused()
    }

    @Test
    fun aSuggestionThatIsAlreadyThePlansTimeIsntOffered() {
        show(found = answered(time = timeToCover(recommended = 20)))

        compose.onNodeWithText("What it takes to cover your whole goal by January 31, 2027.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Use 20\u00A0min a day to cover everything").assertDoesNotExist()
    }

    @Test
    fun anAnswerFoundForAnotherPlanIsAskedAgain() {
        show(found = answered(plan = coveragePlan(coreFits = false), time = timeToCover(recommended = 45)))

        compose.onNodeWithText("Use 45\u00A0min a day to cover everything").assertDoesNotExist()
        assertEquals(1, finds)
    }

    @Test
    fun anAnswerThatFailedOffersTryAgain() {
        show(found = TimeToCoverState.Failed(timeToCoverRevision(coveragePlan())))

        compose.onNodeWithText("We couldn't work out the time your goal needs.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Try again").performScrollTo().performClick()

        assertEquals(1, finds)
    }

    @Test
    fun whileTheScheduleSavesItsCoverageIsBeingWorkedOut() {
        show(pending = setOf(PlanPart.Schedule), found = answered())

        compose.onNodeWithText("Working out what your time covers…").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun movingTheDateFindsItFirst() {
        show(found = TimeToCoverState.Failed(timeToCoverRevision(coveragePlan())))

        compose.onNodeWithText("Move your date to cover everything").performClick()

        assertEquals(1, finds)
        assertEquals(emptyList<Pair<PlanPart, List<PlanOp>>>(), changes)
    }

    @Test
    fun aDateFoundMovesInOneTap() {
        show(found = answered(time = timeToCover(recommended = null, fittingDate = "2027-03-15")))

        compose.onNodeWithText("At 20\u00A0min a day, your plan covers everything by March 15, 2027.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Move your date to March 15, 2027").performClick()

        assertEquals(listOf(PlanPart.Schedule to listOf<PlanOp>(PlanOp.TargetDate(LocalDate.parse("2027-03-15")))), changes)
    }

    @Test
    fun anExamStudiesEverythingFromItsSwitch() {
        show(plan = coveragePlan(kind = "exam"), kind = "exam", found = answered(plan = coveragePlan(kind = "exam")))

        compose.onNodeWithText("Move your date to cover everything").assertDoesNotExist()
        compose.onNodeWithText("When off, your plan ends at the exam.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Study everything, even after the exam").performScrollTo().performClick()

        assertEquals(listOf(PlanPart.FullCourse to listOf<PlanOp>(PlanOp.FullCourse(true))), changes)
    }

    @Test
    fun aDatedGoalOpensStudyEverythingAndTheFocusChoice() {
        val areas = "[${area("Algebra")},${area("Geometry")}]"
        show(plan = coveragePlan(areas = areas), found = answered(plan = coveragePlan(areas = areas)))

        compose.onNodeWithText("Study everything").performScrollTo().performClick()
        compose.onNodeWithText("Choose where to focus").performScrollTo().performClick()

        assertEquals(listOf("everything", "focus"), opened)
    }

    @Test
    fun aTimeThatCoversEverythingSaysSo() {
        val covered = coveragePlan(fits = true)
        show(plan = covered, found = answered(plan = covered))
        compose.onNodeWithText("Covers your whole goal by January 31, 2027.").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun aMovedDateTakesFocusToTheTimePicked() {
        show(
            found = answered(time = timeToCover(recommended = null, fittingDate = "2027-03-15")),
            saved = PlanChangeResult(change = null, status = PlanChangeResult.Status.APPLIED),
        )

        compose.onNodeWithText("Move your date to March 15, 2027").performClick()

        compose.onNodeWithContentDescription("Time a day, 20\u00A0min").assertIsFocused()
    }
}
