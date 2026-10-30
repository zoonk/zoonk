package com.zoonk.android.feature.plan

import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.PlanPhaseChaptersInner.State.CURRENT
import com.zoonk.api.models.PlanPhaseChaptersInner.State.DONE
import com.zoonk.api.models.PlanPhaseChaptersInner.State.UPCOMING
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
    fun thePathOpensThePhaseHoldingTheNextChapter() {
        assertEquals(1L, findOpenPhase(plan.phases))
    }

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
    fun theFinishIsTheGoalsDateOrAnEstimateNeverForAnExam() {
        assertEquals(PlanFinish(LocalDate.of(2027, 1, 31), estimate = false, month = false), plan.finish(LearnerSummaryGoal.Kind.LEARN))

        val undated =
            plan(
                """
                "schedule":{"dailyMinutes":20,"fullCourse":false,"lightWeeks":[],"studyDays":5,"targetDateEstimated":false,
                  "targetDateNamedMonth":false,"shape":{"canDiffer":false,"weekdayDays":[1,2,3,4,5],"weekdays":20,"weekend":null,"weekendDays":[]},"weekdayMinutes":[0,20,20,20,20,20,0]},
                "estimate":{"endDate":"2027-03-01","remainingHours":10,"totalHours":12}
                """.trimIndent(),
            )
        assertEquals(PlanFinish(LocalDate.of(2027, 3, 1), estimate = true, month = true), undated.finish(LearnerSummaryGoal.Kind.LEARN))
        assertNull(undated.finish(LearnerSummaryGoal.Kind.EXAM))
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
                "schedule":{"dailyMinutes":20,"fullCourse":false,"lightWeeks":[],"studyDays":5,"targetDate":"2026-11-15",
                  "targetDateEstimated":false,"targetDateNamedMonth":false,"shape":{"canDiffer":false,"weekdayDays":[1,2,3,4,5],"weekdays":20,"weekend":null,"weekendDays":[]},"weekdayMinutes":[0,20,20,20,20,20,0]}
                """.trimIndent(),
            )

        assertEquals(PlanOverrun(1, 0.5f), late.overrun(LearnerSummaryGoal.Kind.LEARN))
        assertNull(plan.overrun(LearnerSummaryGoal.Kind.LEARN))
    }

    @Test
    fun aPhaseWhoseOnlyChapterSharesItsNameShowsAsThatChapter() {
        val single =
            plan(
                """
                "phases":[${phase(
                    0,
                    "Loops",
                    "current",
                    "2026-10-01",
                    "2026-10-31",
                    0,
                    5,
                    listOf(chapter(CHAPTER_NEXT, "loops ", "current", 0, 5)),
                )}]
                """.trimIndent(),
            ).phases.first()

        assertEquals(CHAPTER_NEXT, single.ownChapter("Loops")?.chapterId.toString())
        assertNull(plan.phases[1].ownChapter("Data structures"))
        assertTrue(single.isNamedLikeAChapter("Loops"))
        assertFalse(plan.phases[1].isNamedLikeAChapter("Data structures"))
    }

    @Test
    fun fourChaptersShowAroundTheNextOne() {
        assertEquals(0..3, chapterWindow(listOf(DONE, CURRENT, UPCOMING, UPCOMING, UPCOMING)))
        assertEquals(2..5, chapterWindow(listOf(DONE, DONE, DONE, CURRENT, UPCOMING, UPCOMING, UPCOMING)))
        assertEquals(3..6, chapterWindow(listOf(DONE, DONE, DONE, DONE, DONE, DONE, CURRENT)))
        assertEquals(0..1, chapterWindow(listOf(DONE, UPCOMING)))
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
    fun theNextOnThePathIsTheNextChapterAndTheFirstChallengeAhead() {
        assertEquals(CHAPTER_NEXT, plan.nextChapter?.chapterId.toString())
        assertEquals("2026-11-10", plan.nextCheckpoint?.date.toString())
        assertNull(plan.nextMockDate)
    }

    @Test
    fun partsShareWhatsLeftAfterTheirMinimumByWeight() {
        assertEquals(listOf(30f, 50f), weightedWidths(listOf(1f, 3f), total = 82f, minimum = 20f, gap = 2f))
    }

    @Test
    fun aWeekdaysTimeIsItsMostCommonAndTheWeekendsShowsOnlyWhenItDiffers() {
        assertEquals(20 to 30, weekShape(listOf(30, 20, 20, 20, 20, 20, 30), 20).let { it.weekdays to it.weekend })
        assertEquals(20 to null, weekShape(listOf(20, 20, 20, 20, 20, 20, 20), 20).let { it.weekdays to it.weekend })
        assertEquals(30 to null, weekShape(listOf(0, 20, 30, 30, 20, 30, 0), 25).let { it.weekdays to it.weekend })
    }

    @Test
    fun studyDaysReadAsEveryDayARunOrAList() {
        assertEquals("every", studyDaysText(List(7) { 20 }, Locale.ENGLISH, everyDay = "every"))
        assertEquals("Mon – Fri", studyDaysText(listOf(0, 20, 20, 20, 20, 20, 0), Locale.ENGLISH))
        assertEquals("Mon, Wed, Sun", studyDaysText(listOf(20, 20, 0, 20, 0, 0, 0), Locale.ENGLISH))
    }
}
