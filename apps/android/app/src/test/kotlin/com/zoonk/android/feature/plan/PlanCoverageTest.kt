package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
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

    private fun show(
        plan: Plan = coveragePlan(),
        kind: String = "learn",
        pending: Set<PlanPart> = emptySet(),
        found: TimeToCoverState = TimeToCoverState.Idle,
    ) {
        val summary = learnerSummary(kind = kind)
        val page = PlanPageState(summary.goals.first(), plan, summary)
        val edits =
            PlanEdits(
                pending = pending,
                change = { part, operations, _: (PlanChangeResult?) -> Unit -> changes += part to operations },
                timeToCover = found,
                findTimeToCover = { _, _ -> finds++ },
                chooseFocus = { opened += "focus" },
                studyEverything = { opened += "everything" },
            )
        compose.setContent { ZoonkTheme { Column { PlanEditorBody(page, edits) } } }
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
    fun theTimeFoundJoinsTheChipsWithItsNote() {
        show(found = answered(time = timeToCover(recommended = 75)))

        compose.onNodeWithText("Covers everything").performClick()

        assertEquals(listOf(PlanPart.Schedule to listOf<PlanOp>(PlanOp.DailyMinutes(75))), changes)
    }

    @Test
    fun anAnswerFoundForAnotherPlanIsntShown() {
        show(found = answered(plan = coveragePlan(coreFits = false), time = timeToCover(recommended = 75)))

        compose.onNodeWithText("Covers everything").assertDoesNotExist()
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
}
