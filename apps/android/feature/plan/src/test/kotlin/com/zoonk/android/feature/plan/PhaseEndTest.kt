package com.zoonk.android.feature.plan

import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.api.models.PlanPhase
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Main's `usePhaseEnd`: what each phase's row and the line under the roadmap say about when it ends. */
@RunWith(AndroidJUnit4::class)
class PhaseEndTest {
    @get:Rule
    val compose: ComposeContentTestRule = createComposeRule()

    @Test
    fun thePhaseBeforeADatedExamLeavesItsDayToTheFinishRow() {
        val ends = ends(exam(dated = true))

        assertEquals(null, ends["Projects"])
        assertEquals("~Mar 2027", ends["After the exam"])
    }

    @Test
    fun thePhaseBeforeAnExamWithNoDateYetShowsThePlansEstimatedEnd() {
        assertEquals("~Feb 2027", ends(exam(dated = false))["Projects"])
    }

    @Test
    fun aPhaseEndsOnItsChallengesDayWhenThatComesAfterItsLastLesson() {
        val plan = learnPlan().withCurrent { it.copy(checkpoint = it.checkpoint?.copy(date = LocalDate(2026, 11, 14))) }

        assertEquals("~Nov 14", ends(page(plan))["Data structures"])
    }

    @Test
    fun theCurrentPhaseKeepsItsDayEvenWhenItsEndIsFar() {
        val plan =
            learnPlan().withCurrent {
                it.copy(endDate = LocalDate(2026, 12, 20), checkpoint = it.checkpoint?.copy(date = LocalDate(2026, 12, 20)))
            }

        assertEquals("~Dec 20", ends(page(plan))["Data structures"])
    }

    private fun ends(page: PlanPageState): Map<String, String?> {
        val ends = mutableMapOf<String, String?>()
        compose.setContent { page.plan.phases.forEach { ends[it.name] = phaseEnd(page, it)?.text } }
        compose.waitForIdle()
        return ends
    }

    private fun com.zoonk.api.models.Plan.withCurrent(change: (PlanPhase) -> PlanPhase) =
        copy(phases = phases.map { if (it.state == PlanPhase.State.CURRENT) change(it) else it })

    private fun page(plan: com.zoonk.api.models.Plan): PlanPageState {
        val summary = learnerSummary()
        return PlanPageState(summary.goals.first(), plan, summary)
    }

    /** Four phases to the exam on Jan 31, 2027, then After the exam; the plan's estimate ends Feb 6. */
    private fun exam(dated: Boolean): PlanPageState {
        val summary = learnerSummary(kind = "exam", title = "ENEM")
        val base = learnPlan()
        val after =
            base.phases.last().copy(
                index = 4,
                name = "After the exam",
                kind = PlanPhase.Kind.AFTER_EXAM,
                startDate = LocalDate(2027, 2, 1),
                endDate = LocalDate(2027, 3, 15),
            )
        val plan =
            base.copy(
                phases = base.phases + after,
                schedule = base.schedule.copy(targetDate = base.schedule.targetDate.takeIf { dated }, fullCourse = true),
                estimate = base.estimate.copy(endDate = LocalDate(2027, 2, 6)),
            )
        return PlanPageState(summary.goals.first(), plan, summary)
    }
}
