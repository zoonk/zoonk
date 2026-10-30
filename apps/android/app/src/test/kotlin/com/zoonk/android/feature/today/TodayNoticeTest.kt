package com.zoonk.android.feature.today

import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.Today
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.UUID

class TodayNoticeTest {
    private val goal = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d41")
    private val day = LocalDate(2026, 10, 29)

    @Test
    fun theFirstPickHoldsForTheVisitWhileTodayMovesOn() {
        val hold = null.next(goal, day, Today.Notice.INSIGHT, insight = null)

        assertEquals(Today.Notice.INSIGHT, hold.next(goal, day, Today.Notice.SUGGESTED_GOAL, insight = null).kind)
    }

    @Test
    fun anotherGoalOrANewDayIsANewVisit() {
        val hold = null.next(goal, day, Today.Notice.SUGGESTED_GOAL, insight = null)

        assertEquals(Today.Notice.EXAM, hold.next(UUID.randomUUID(), day, Today.Notice.EXAM, insight = null).kind)
        assertNull(hold.next(goal, LocalDate(2026, 10, 30), picked = null, insight = null).kind)
    }

    @Test
    fun theAnsweredInsightStaysAfterTodayStopsCarryingIt() {
        val insight = decodeFixture<MemoryInsight>("memory-insight")
        val hold = null.next(goal, day, Today.Notice.INSIGHT, insight)

        assertEquals(insight, hold.next(goal, day, picked = null, insight = null).insight)
    }
}
