package com.zoonk.android.feature.plan

import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanPhaseShort
import com.zoonk.api.models.ShortExamFocus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/** Main's `phase-dates.test.ts`: one rule names each phase by its end, and the axis says a day once. */
class PhaseDatesTest {
    @Test
    fun namesAPhaseByTheDayItEndsWithNoEstimateOnceItsUnderWay() {
        val shaped = planOf(phase(0, "current", "2026-11-20", kind = "foundations"))
        assertEquals(PlanEnd(day("2026-11-20"), estimate = false, month = false), shaped.phaseEnd(shaped.phases[0]))
    }

    @Test
    fun givesAFinishedPhaseNoDate() {
        val shaped = planOf(phase(0, "done", "2026-11-01"))
        assertNull(shaped.phaseEnd(shaped.phases[0]))
    }

    @Test
    fun marksALearningPhaseAheadAsAnEstimate() {
        val shaped = planOf(phase(0), phase(1, end = "2026-12-01"))
        assertEquals(PlanEnd(day("2026-12-01"), estimate = true, month = false), shaped.phaseEnd(shaped.phases[1]))
    }

    @Test
    fun saysAFarEstimateByItsMonthInTheNextCalendarYearToo() {
        val shaped = planOf(phase(0), phase(1, end = "2027-03-10"))
        assertEquals(PlanEnd(day("2027-03-10"), estimate = true, month = true), shaped.phaseEnd(shaped.phases[1]))
    }

    @Test
    fun endsAPhaseOnItsChallengesDayWhenThatComesAfterItsLastLesson() {
        val shaped = planOf(phase(0, "current", "2026-11-20", checkpoint = challenge()))
        assertEquals(PlanEnd(day("2026-11-22"), estimate = true, month = false), shaped.phaseEnd(shaped.phases[0]))
    }

    @Test
    fun endsTheLastPhaseWithoutADayOfItsOwnWithThePlan() {
        val shaped = planOf(phase(0, "current"), planEnd = "2026-12-12")
        assertEquals(PlanEnd(day("2026-12-12"), estimate = true, month = false), shaped.phaseEnd(shaped.phases[0]))
    }

    @Test
    fun saysAnEstimateByItsDayUpTo42DaysFromThePlansWeekByItsMonthAfter() {
        val near = planOf(phase(0), phase(1, end = "2026-12-27"))
        val far = planOf(phase(0), phase(1, end = "2026-12-28"))
        assertEquals(false, (near.phaseEnd(near.phases[1]) as PlanEnd).month)
        assertEquals(true, (far.phaseEnd(far.phases[1]) as PlanEnd).month)
    }

    @Test
    fun givesAPhaseTheLearnerDidntFinishOrOneLeftOutNoDate() {
        val shaped = planOf(phase(0, "unfinished", "2026-11-10"), phase(1, "leftOut", "2026-11-20"))
        assertNull(shaped.phaseEnd(shaped.phases[0]))
        assertNull(shaped.phaseEnd(shaped.phases[1]))
    }

    @Test
    fun saysAFarEstimatedEndOfThePhaseUnderWayByItsMonthAsOneAhead() {
        val shaped = planOf(phase(0, "current", "2027-02-20", checkpoint = challenge("2027-03-01")))
        assertEquals(PlanEnd(day("2027-03-01"), estimate = true, month = true), shaped.phaseEnd(shaped.phases[0]))
    }

    @Test
    fun keepsTheDayOfAFarEndOfThePhaseUnderWayThatIsntAnEstimate() {
        val shaped = planOf(phase(0, "current", "2027-08-14"))
        assertEquals(PlanEnd(day("2027-08-14"), estimate = false, month = false), shaped.phaseEnd(shaped.phases[0]))
    }

    @Test
    fun marksAnExamPhaseThatEndsOnItsChallengesDayAsAnEstimate() {
        val shaped = planOf(phase(0, "current", "2026-11-20", kind = "foundations", checkpoint = challenge()))
        assertEquals(PlanEnd(day("2026-11-22"), estimate = true, month = false), shaped.phaseEnd(shaped.phases[0]))
    }

    @Test
    fun marksEveryPhaseOfAPlanWhoseDateIsAnEstimateAsOne() {
        val shaped = planOf(phase(0, "current", "2026-11-20", kind = "foundations"), target = "2027-05-01", targetEstimated = true)
        assertEquals(PlanEnd(day("2026-11-20"), estimate = true, month = false), shaped.phaseEnd(shaped.phases[0]))
    }

    @Test
    fun estimatesAnExamPhaseAheadWhoseChallengeFallsOnItsLastDayAsTheChallengesRowDoes() {
        val shaped =
            planOf(
                phase(0, "current", "2026-11-20", kind = "foundations"),
                phase(1, end = "2027-07-16", kind = "gaps", checkpoint = challenge("2027-07-16"), start = "2026-11-21"),
            )
        assertEquals(PlanEnd(day("2027-07-16"), estimate = true, month = true), shaped.phaseEnd(shaped.phases[1]))
    }

    @Test
    fun saysAChallengeWhosePhaseHasNoPlaceYetLater() {
        val shaped =
            planOf(
                phase(0),
                phase(1, checkpoint = """{"date":null,"later":true,"locked":false,"planItemId":null,"state":"upcoming","when":"date"}"""),
            )
        assertEquals(PhaseEnd.Later, shaped.challengeDay(shaped.phases[1]))
    }

    @Test
    fun datesAChallengeAsItsPhasesEndIs() {
        val byYear = planOf(phase(0, end = "2031-04-02", checkpoint = challenge("2031-04-02"), precision = "year"))
        val far = planOf(phase(0, end = "2027-04-02", checkpoint = challenge("2027-04-02"), precision = "month"))
        val near = planOf(phase(0, end = "2026-12-01", checkpoint = challenge("2026-12-01")))
        assertEquals(PlanEnd(day("2031-04-02"), estimate = true, month = false, year = true), byYear.challengeDay(byYear.phases[0]))
        assertEquals(PlanEnd(day("2027-04-02"), estimate = true, month = true), far.challengeDay(far.phases[0]))
        assertEquals(PlanEnd(day("2026-12-01"), estimate = true, month = false), near.challengeDay(near.phases[0]))
    }

    @Test
    fun datesAFarChallengeOnTheLastDayOfThePhaseUnderWayByItsMonthAsThePhase() {
        val shaped =
            planOf(phase(0, "current", "2027-02-27", checkpoint = challenge("2027-02-27", precision = "month"), precision = "month"))
        val phaseEnd = PlanEnd(day("2027-02-27"), estimate = true, month = true)
        assertEquals(phaseEnd, shaped.phaseEnd(shaped.phases[0]))
        assertEquals(phaseEnd, shaped.challengeDay(shaped.phases[0]))
    }

    @Test
    fun keepsAChallengeOnItsPhasesLastDayAtThatDay() {
        val shaped = planOf(phase(0, "current", "2026-11-20", checkpoint = challenge("2026-11-20")))
        assertEquals(day("2026-11-20"), (shaped.phaseEnd(shaped.phases[0]) as PlanEnd).date)
    }

    @Test
    fun estimatesTheEndOfAPhaseAfterTheExamLikeALearningPhase() {
        val shaped = planOf(phase(0), phase(1, end = "2026-12-01", kind = "afterExam"))
        assertEquals(PlanEnd(day("2026-12-01"), estimate = true, month = false), shaped.phaseEnd(shaped.phases[1]))
    }

    @Test
    fun endsTheLastPhaseBeforeTheExamWithThePlanWhateverComesAfterTheExam() {
        val shaped = planOf(phase(0, "current"), phase(1, kind = "afterExam"), planEnd = "2026-12-12")
        assertEquals(day("2026-12-12"), (shaped.phaseEnd(shaped.phases[0]) as PlanEnd).date)
    }

    @Test
    fun namesAShortPlansPhaseByItsDays() {
        val shaped = planOf(phase(0, "current", "2026-11-17", short = short(1, 3)), shortPlan = true)
        assertEquals(PhaseEnd.Days(PlanPhaseShort(1, ShortExamFocus.PRACTICE, 3)), shaped.phaseEnd(shaped.phases[0]))
    }

    @Test
    fun leavesAPhaseAtItsLastLessonOnceItsChallengeIsBehindTheLearner() {
        val shaped = planOf(phase(0, "current", "2026-11-20", checkpoint = challenge(state = "done")))
        assertEquals(PlanEnd(day("2026-11-20"), estimate = false, month = false), shaped.phaseEnd(shaped.phases[0]))
    }

    @Test
    fun namesAPhaseByItsDayWhenThePlanIsntAShortOne() {
        val shaped = planOf(phase(0, "current", "2026-11-17", short = short(1, 3)))
        assertEquals(day("2026-11-17"), (shaped.phaseEnd(shaped.phases[0]) as PlanEnd).date)
    }

    @Test
    fun finishesALearningPlanOnItsActualCompletionDay() {
        val shaped =
            planOf(
                phase(0, "done", "2027-01-02", start = "2026-11-15"),
                target = EXAM_DAY,
                end = """{"kind":"finished","finishedOn":"2026-12-05"}""",
            )

        assertEquals(PlanEnd(day("2026-12-05"), estimate = false, month = false), shaped.finish(LEARN))
        assertEquals(day(EXAM_DAY), shaped.finish(EXAM)?.date)
        assertNull(shaped.overrun(LEARN))
    }

    @Test
    fun leavesAFinishedPlanWithoutAKnownCompletionDayUndated() {
        val shaped = planOf(phase(0, "done"), target = EXAM_DAY, end = """{"kind":"finished","finishedOn":null}""")
        assertNull(shaped.finish(LEARN))
    }

    @Test
    fun givesAPhaseStillBeingPlannedNoDate() {
        val shaped = planOf(phase(0), phase(1))
        assertNull(shaped.phaseEnd(shaped.phases[0]))
    }

    @Test
    fun theFinishIsTheExamsDateAnEstimateWhenTheDateIs() {
        val shaped = planOf(phase(0), target = EXAM_DAY, targetEstimated = true)
        assertEquals(PlanEnd(day(EXAM_DAY), estimate = true, month = false), shaped.finish(EXAM))
    }

    @Test
    fun theFinishIsThePlansOwnEndAboutWhenTheLearnerSetNoDate() {
        val shaped = planOf(phase(0), planEnd = "2026-12-12")
        assertEquals(PlanEnd(day("2026-12-12"), estimate = true, month = false), shaped.finish(LEARN))
    }

    @Test
    fun usesTheSavedFinishPrecisionForTheFinishRowAndThePhaseEndingOnThatDate() {
        val end = "2026-12-12"
        val shaped = planOf(phase(0, "current", end, checkpoint = challenge(end)), planEnd = end, precision = "month")
        val expected = PlanEnd(day(end), estimate = true, month = true)

        assertEquals(expected, shaped.finish(LEARN))
        assertEquals(expected, shaped.phaseEnd(shaped.phases[0]))
    }

    @Test
    fun aPhaseUnderWayIsSaidByHowNearItsEstimatedEndIsOrByItsYearWhenCoreSays() {
        val byDay = planOf(phase(0, "current", "2026-12-10", checkpoint = challenge("2026-12-10"), precision = "month"))
        val byYear = planOf(phase(0, "current", "2029-02-23", checkpoint = challenge("2029-02-23"), precision = "year"))

        assertEquals(PlanEnd(day("2026-12-10"), estimate = true, month = false), byDay.phaseEnd(byDay.phases[0]))
        assertEquals(PlanEnd(day("2029-02-23"), estimate = true, month = false, year = true), byYear.phaseEnd(byYear.phases[0]))
    }

    @Test
    fun aPausedGoalHasNoFinishFromItsPaceButKeepsItsOwnDates() {
        assertNull(planOf(phase(0), planEnd = "2026-12-12").finish(LEARN, paused = true))
        assertEquals(day(EXAM_DAY), planOf(phase(0), target = EXAM_DAY).finish(LEARN, paused = true)?.date)
        assertEquals(day(EXAM_DAY), planOf(phase(0), target = EXAM_DAY, targetEstimated = true).finish(EXAM, paused = true)?.date)
    }

    @Test
    fun noFinishForAPlanWithNoDateAndNoEndYetNorForAnExamWithoutADate() {
        assertNull(planOf(phase(0)).finish(LEARN))
        assertNull(planOf(phase(0), planEnd = "2026-12-12").finish(EXAM))
    }

    @Test
    fun theRoadmapDrawsNeitherThePhasesAfterTheExamNorThoseLeftOut() {
        val shaped = planOf(phase(0, "current"), phase(1, "leftOut"), phase(2), phase(3, kind = "afterExam"))
        assertEquals(listOf(0L, 2L), shaped.roadmapPhases.map { it.index })
    }

    @Test
    fun theAxisDatesTheCurrentPhaseAndEachAfterItButNotTheLast() {
        assertEquals(setOf(0L, 1L), axis(threePhases("2026-11-20", "2026-12-01", "2026-12-10")))
    }

    @Test
    fun theAxisDatesADayOnceWhenTwoPhasesEndOnIt() {
        assertEquals(setOf(1L), axis(threePhases("2026-11-20", "2026-11-20", "2026-12-01")))
    }

    @Test
    fun theAxisLeavesNoDateForAFinishedPhase() {
        assertEquals(setOf(1L), axis(threePhases("2026-11-10", "2026-11-20", "2026-12-01", states = listOf("done", "current"))))
    }

    @Test
    fun theAxisLeavesTheCurrentPhaseEndingTodayToTodayOnTheLearnersDay() {
        val learnersDay = "2026-11-16"
        val shaped = threePhases(learnersDay, "2026-11-25", "2026-12-01")
        assertEquals(setOf(1L), axis(shaped, today = learnersDay))
        assertEquals(setOf(0L, 1L), axis(shaped))
    }

    @Test
    fun theAxisLeavesAPhaseEndingOnTheGoalsDayToTheGoalsDate() {
        val shaped =
            planOf(
                phase(0, "current", "2026-11-20"),
                phase(1, end = EXAM_DAY),
                phase(2, end = EXAM_DAY),
                target = EXAM_DAY,
                targetEstimated = true,
            )
        assertEquals(setOf(0L), axis(shaped, goalKind = EXAM))
    }

    @Test
    fun theAxisLeavesAnyPhaseEndingOnTheLearnersTodayToToday() {
        assertEquals(emptySet<Long>(), axis(threePhases(TODAY, TODAY, "2026-12-01")))
    }

    @Test
    fun theAxisDatesOnlyThePhasesTheRoadmapDraws() {
        val shaped =
            planOf(
                phase(0, "current", "2026-11-20"),
                phase(1, "leftOut", "2026-11-25"),
                phase(2, end = "2026-12-01"),
                phase(3, end = "2026-12-10"),
                phase(4, end = "2027-01-10", kind = "afterExam"),
            )
        assertEquals(setOf(0L, 2L), axis(shaped))
    }

    @Test
    fun theAxisDatesAShortPlansPhasesOnceEach() {
        val shaped =
            planOf(
                phase(0, "current", "2026-11-16", short = short(1, 2)),
                phase(1, end = "2026-11-18", short = short(3, 4)),
                phase(2, end = "2026-11-19", short = short(5, 5)),
                shortPlan = true,
            )
        assertEquals(setOf(0L, 1L), axis(shaped))
    }

    @Test
    fun theAxisDatesNothingOnAOnePhasePlanWhoseEndIsTheGoals() {
        assertEquals(emptySet<Long>(), axis(planOf(phase(0, "current", "2026-12-01"))))
    }

    @Test
    fun theAxisDatesNothingWhileNoPhaseIsUnderWay() {
        assertEquals(emptySet<Long>(), axis(threePhases("2026-11-20", "2026-12-01", "2026-12-10", states = listOf("upcoming"))))
    }

    /** The reviewer's plan: the last phase under way ends today, the goal's day. */
    private val endsToday = planOf(phase(0, "done", "2026-11-10"), phase(1, "current", TODAY), target = TODAY)

    @Test
    fun theAxisLeavesTheGoalsDayToTodayWhenItsTheLearnersToday() {
        assertNull(endsToday.axisFinish(LEARN, day(TODAY)))
    }

    @Test
    fun theListAndTheFinishRowStillNameTheGoalsDayAndThePhasesEnd() {
        assertEquals(PlanEnd(day(TODAY), estimate = false, month = false), endsToday.finish(LEARN))
        assertEquals(PlanEnd(day(TODAY), estimate = false, month = false), endsToday.phaseEnd(endsToday.phases[1]))
    }

    @Test
    fun theAxisDatesTheGoalsDayWhenItsAnotherDay() {
        assertEquals(PlanEnd(day(TODAY), estimate = false, month = false), endsToday.axisFinish(LEARN, day("2026-11-14")))
    }

    @Test
    fun theAxisDatesTheGoalsDayWhileNoPhaseIsUnderWayWithNoTodayToSayIt() {
        val notStarted = planOf(phase(0, end = TODAY), target = TODAY)
        assertTrue(notStarted.axisFinish(LEARN, day(TODAY))?.date == day(TODAY))
    }

    private fun axis(
        shaped: Plan,
        goalKind: LearnerSummaryGoal.Kind = LEARN,
        today: String = TODAY,
    ) = shaped.axisDatedPhases(goalKind, day(today))

    /** Three phases ending on these days, the first under way unless [states] say otherwise. */
    private fun threePhases(
        vararg ends: String,
        states: List<String> = emptyList(),
    ) = planOf(
        *ends
            .mapIndexed { index, end ->
                phase(
                    index,
                    states.getOrElse(index) {
                        if (index ==
                            0
                        ) {
                            "current"
                        } else {
                            "upcoming"
                        }
                    },
                    end,
                )
            }.toTypedArray(),
    )

    private fun planOf(
        vararg phases: String,
        planEnd: String? = null,
        precision: String? = null,
        target: String? = null,
        targetEstimated: Boolean = false,
        shortPlan: Boolean = false,
        end: String = "null",
    ): Plan =
        plan(
            """
            "phases":[${phases.joinToString(",")}],
            "end":$end,
            "estimate":{"remainingHours":10,"totalHours":12,"endDate":${planEnd.json()},"precision":${precision.json()}},
            "schedule":{"dailyMinutes":20,"dailyTimes":[15,30,45],"fullCourse":false,"lightWeeks":[],"studyDays":5,"targetDate":${target.json()},
              "targetDateEstimated":$targetEstimated,"targetDateNamedMonth":false,"shape":{"canDiffer":false,"weekdayDays":[1,2,3,4,5],"weekdays":20,"weekend":null,"weekendDays":[]},"weekdayMinutes":[0,20,20,20,20,20,0]},
            "shortPlan":${if (shortPlan) """{"days":5,"mockDate":null}""" else "null"},
            "week":{"days":[],"endDate":"2026-11-21","startDate":"$TODAY"}
            """.trimIndent(),
        )

    private fun phase(
        index: Int,
        state: String = "upcoming",
        end: String? = null,
        kind: String = "learn",
        checkpoint: String? = null,
        short: String? = null,
        start: String? = null,
        precision: String? = null,
    ) =
        """{"chapterCount":0,"chapters":[],"checkpoint":${checkpoint ?: "null"},"startDate":${start.json()},"endDate":${end.json()},"hours":10,
        "index":$index,"kind":"$kind","lessonsDone":0,"lessonsTotal":0,"mocks":{"count":0},"name":"Phase $index","notPlannedReason":${if (state == "leftOut") "\"time\"" else "null"},"state":"$state",
        "short":${short ?: "null"},"precision":${precision.json()}}"""

    private fun challenge(
        date: String = "2026-11-22",
        state: String = "upcoming",
        precision: String? = null,
    ) = """{"date":"$date","locked":false,"planItemId":null,"precision":${precision.json()},"state":"$state","when":"date"}"""

    private fun short(
        first: Int,
        last: Int,
    ) = """{"firstDay":$first,"focus":"practice","lastDay":$last}"""

    private fun String?.json() = this?.let { "\"$it\"" } ?: "null"

    private fun day(iso: String) = LocalDate.parse(iso)

    private companion object {
        const val TODAY = "2026-11-15"
        const val EXAM_DAY = "2027-11-14"
        val LEARN = LearnerSummaryGoal.Kind.LEARN
        val EXAM = LearnerSummaryGoal.Kind.EXAM
    }
}
