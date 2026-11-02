package com.zoonk.android.feature.plan

import com.zoonk.api.models.LearnerSummaryGoal
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.util.Locale

class PlanPhasesTest {
    private val plan = learnPlan()

    @Test
    fun aPhaseIsWeighedByItsDaysCountingBothEnds() {
        assertEquals(14f, plan.phases[0].weight())
        assertEquals(27f, plan.phases[1].weight())
    }

    @Test
    fun todayIsADayOfTheCurrentPhase() {
        val phase = plan.phases[1]

        assertEquals(PhaseDay(14, 27), phase.dayOf(LocalDate.of(2026, 10, 28)))
        assertEquals(13f / 27, phase.shareAt(LocalDate.of(2026, 10, 28), DayPart.Start))
        assertEquals(1f, phase.shareAt(LocalDate.of(2026, 12, 1), DayPart.End))
    }

    @Test
    fun phasesGoingOnPastTheDateMarkWhereTheDateFalls() {
        val late =
            plan(
                """
                "phases":[
                  ${phase(0, "One", "current", "2026-10-01", "2026-10-31", 0, 5)},
                  ${phase(1, "Two", "upcoming", "2026-11-01", "2026-11-30", 0, 5)}
                ],
                "schedule":{"dailyMinutes":20,"dailyTimes":[15,30,45],"fullCourse":false,"lightWeeks":[],"studyDays":5,"targetDate":"2026-11-15",
                  "targetDateEstimated":false,"targetDateNamedMonth":false,"shape":{"canDiffer":false,"weekdayDays":[1,2,3,4,5],"weekdays":20,"weekend":null,"weekendDays":[]},"weekdayMinutes":[0,20,20,20,20,20,0]}
                """.trimIndent(),
            )

        assertEquals(PlanOverrun(1, 0.5f), late.overrun(LearnerSummaryGoal.Kind.LEARN))
        assertNull(plan.overrun(LearnerSummaryGoal.Kind.LEARN))
    }

    @Test
    fun thePlanIsReadAgainOnlyWhileTheCurrentPhaseIsBeingWritten() {
        assertTrue(plan.isPhaseBeingWritten)
        assertFalse(
            plan(
                """
                "phases":[${phase(
                    0,
                    "One",
                    "current",
                    "2026-10-01",
                    "2026-10-31",
                    0,
                    5,
                    listOf(chapter(null, "Far", "upcoming", 0, 0, writing = true, far = true)),
                )}]
                """.trimIndent(),
            ).isPhaseBeingWritten,
        )
    }

    @Test
    fun partsShareWhatsLeftAfterTheirMinimumByWeight() {
        assertEquals(listOf(30f, 50f), weightedWidths(listOf(1f, 3f), total = 82f, minimums = listOf(20f, 20f), gap = 2f))
    }

    @Test
    fun studyDaysReadAsEveryDayARunOrAList() {
        assertEquals("every", studyDaysText(List(7) { 20 }, Locale.ENGLISH, everyDay = "every"))
        assertEquals("Mon – Fri", studyDaysText(listOf(0, 20, 20, 20, 20, 20, 0), Locale.ENGLISH))
        assertEquals("Mon, Wed, Sun", studyDaysText(listOf(20, 20, 0, 20, 0, 0, 0), Locale.ENGLISH))
    }
}
