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
    fun theTimeThatCoversEverythingIsFoundOnlyFromTheLearnersTap() {
        show()

        compose
            .onNodeWithText("20 min a day studies every part of your goal, the ones that matter most in more depth.")
            .assertIsDisplayed()
        assertEquals(0, finds)
        compose.onNodeWithText("Find the time that covers everything").performClick()

        assertEquals(1, finds)
    }

    @Test
    fun theTimeFoundIsUsedInOneTapAndTheKeyboardWaitsOnThePicker() {
        show(found = answered(time = timeToCover(recommended = 45)))

        compose.onNodeWithText("Use 45\u00A0min a day").performClick()

        assertEquals(listOf(PlanPart.Schedule to listOf<PlanOp>(PlanOp.DailyMinutes(45))), changes)
        compose.onNodeWithContentDescription("Time a day, 20\u00A0min").assertIsFocused()
    }

    @Test
    fun thePickerMarksTheTimeFound() {
        show(found = answered(time = timeToCover(recommended = 45)))

        compose.onNodeWithContentDescription("Time a day, 20\u00A0min").performClick()

        compose.onNodeWithText("45\u00A0min (suggested)").assertIsDisplayed()
    }

    @Test
    fun aTimeFoundThatIsAlreadyThePlansIsntOffered() {
        show(found = answered(time = timeToCover(recommended = 20)))

        compose.onNodeWithText("Use 20\u00A0min a day").assertDoesNotExist()
    }

    @Test
    fun anAnswerFoundForAnotherPlanIsntShown() {
        show(found = answered(plan = coveragePlan(coreFits = false), time = timeToCover(recommended = 45)))

        compose.onNodeWithText("Use 45\u00A0min a day").assertDoesNotExist()
        compose.onNodeWithText("Find the time that covers everything").assertIsDisplayed()
    }

    @Test
    fun whileTheScheduleSavesItsCoverageIsBeingWorkedOut() {
        show(pending = setOf(PlanPart.Schedule))

        compose.onNodeWithText("Working out what your time covers…").assertIsDisplayed()
        compose.onNodeWithText("Find the time that covers everything").assertDoesNotExist()
    }

    @Test
    fun movingTheDateFindsItFirst() {
        show()

        compose.onNodeWithText("Move your date to cover everything").performClick()

        assertEquals(1, finds)
        assertEquals(emptyList<Pair<PlanPart, List<PlanOp>>>(), changes)
    }

    @Test
    fun aDateFoundMovesInOneTap() {
        show(found = answered(time = timeToCover(recommended = null, fittingDate = "2027-03-15")))

        compose.onNodeWithText("At 20 min a day, your plan covers everything by March 15, 2027.").assertIsDisplayed()
        compose.onNodeWithText("Move your date to March 15, 2027").performClick()

        assertEquals(listOf(PlanPart.Schedule to listOf<PlanOp>(PlanOp.TargetDate(LocalDate.parse("2027-03-15")))), changes)
    }

    @Test
    fun anExamStudiesEverythingFromItsSwitch() {
        show(plan = coveragePlan(kind = "exam"), kind = "exam")

        compose.onNodeWithText("Move your date to cover everything").assertDoesNotExist()
        compose.onNodeWithText("Study everything, even after the exam").performScrollTo().performClick()

        assertEquals(listOf(PlanPart.FullCourse to listOf<PlanOp>(PlanOp.FullCourse(true))), changes)
    }

    @Test
    fun aDatedGoalOpensStudyEverythingAndTheFocusChoice() {
        show(plan = coveragePlan(areas = "[${area("Algebra")},${area("Geometry")}]"))

        compose.onNodeWithText("Study everything").performScrollTo().performClick()
        compose.onNodeWithText("Choose where to focus").performScrollTo().performClick()

        assertEquals(listOf("everything", "focus"), opened)
    }

    @Test
    fun aTimeThatCoversEverythingSaysSo() {
        show(
            plan =
                plan(
                    """
                    "feasibility":{"coreFits":true,"coveredShare":1,"deadline":"2027-01-31","deepensMostAsked":false,"fits":true,
                     "measure":"goal","timeCovers":true}
                    """.trimIndent(),
                ),
        )
        compose.onNodeWithText("Covers your whole goal.").assertIsDisplayed()
    }

    @Test
    fun aTimeFoundOnTheLearnersTapTakesFocusToUseIt() {
        show(finding = answered(time = timeToCover(recommended = 45)))

        compose.onNodeWithText("Find the time that covers everything").performClick()

        compose.onNodeWithText("Use 45\u00A0min a day").assertIsFocused()
    }

    @Test
    fun aDateFoundOnTheLearnersTapTakesFocusToMoveDate() {
        show(finding = answered(time = timeToCover(recommended = null, fittingDate = "2027-03-15")))

        compose.onNodeWithText("Find the time that covers everything").performClick()

        compose.onNodeWithText("Move your date to March 15, 2027").assertIsFocused()
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
