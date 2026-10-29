package com.zoonk.android.feature.plan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate

class PlanSlotItemsTest {
    private val fix = PaceFix("Study 10 more minutes a day.", adjust = false)

    private fun keys(
        extra: String,
        kind: String = "goal",
    ): List<String> {
        val summary = learnerSummary()
        val page = PlanPageState(summary.goals.first(), coveragePlan(kind = kind, extra = extra), summary)
        return slotItems(page, fix).map { it.key }
    }

    @Test
    fun whatTheLearnersTimeCouldAddComesAfterThePace() {
        assertEquals(listOf("behind", "fitLessons", "coverage"), keys("$BEHIND,$FIT_OFFER"))
    }

    @Test
    fun aPassedDateLeavesOutWhatTheTimeCouldAdd() {
        assertEquals(listOf("pastDate"), keys("""$FIT_OFFER,"status":{"kind":"pastDate","lessons":4}"""))
    }

    @Test
    fun anOverFreeWeekLeavesOutWhatTheTimeCouldAdd() {
        assertEquals(listOf("freeWeekOver"), keys("""$FIT_OFFER,"access":{"freeWeekOver":true,"mocksRequirePlus":false}"""))
    }

    @Test
    fun aGoalMovesItsDateWhenAskedOrWhenNoTimeCoversEverything() {
        val fitting = timeToCover(recommended = 45, fittingDate = "2027-04-18")
        val date = CoverageChange.Date(LocalDate.parse("2027-04-18"))

        assertEquals(CoverageChange.Time(45), coverageChange(isExam = false, CoverageIntent.Time, fitting))
        assertEquals(date, coverageChange(isExam = false, CoverageIntent.Date, fitting))
        assertEquals(date, coverageChange(isExam = false, CoverageIntent.Time, timeToCover(recommended = null, fittingDate = "2027-04-18")))
        assertNull(coverageChange(isExam = false, CoverageIntent.Date, timeToCover(recommended = 45)))
    }

    @Test
    fun anExamsDateNeverMoves() {
        val fitting = timeToCover(recommended = null, core = 240, fittingDate = "2027-04-18")

        assertNull(coverageChange(isExam = true, CoverageIntent.Time, fitting))
        assertEquals(CoverageChange.Time(45), coverageChange(isExam = true, CoverageIntent.Time, timeToCover(recommended = 45)))
    }

    private companion object {
        const val BEHIND = """"status":{"kind":"behind","days":2,"extraMinutesPerDay":10,"lessons":null}"""
        const val FIT_OFFER =
            """"fitOffer":{"canApply":true,"effect":{"lessonsAdded":6,"lessonsRemoved":0},"fits":false,"operations":[{"kind":"fitLessons"}]}"""
    }
}
