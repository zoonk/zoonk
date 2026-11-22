package com.zoonk.android.feature.today

import com.zoonk.api.models.StudyWeekDay
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class WeekDayShareTest {
    private fun day(
        completed: Long,
        total: Long,
        hitGoal: Boolean = false,
        minutes: Long = 0,
    ) = StudyWeekDay(
        completed = completed,
        date = LocalDate(2026, 10, 28),
        goalMinutes = 20.0,
        hitGoal = hitGoal,
        isToday = true,
        kind = StudyWeekDay.Kind.STUDY,
        minutes = minutes,
        studied = minutes > 0,
        total = total,
    )

    @Test
    fun aDayFillsByItsBlocksNotItsMinutes() {
        assertEquals(1f / 3, day(completed = 1, total = 3, minutes = 40).share, 0f)
    }

    @Test
    fun aFinishedDayIsWhole() {
        assertEquals(1f, day(completed = 3, total = 3, hitGoal = true).share, 0f)
    }

    @Test
    fun aDayWithoutAListStaysEmptyUntilCoreCallsItDone() {
        assertEquals(0f, day(completed = 0, total = 0, minutes = 12).share, 0f)
        assertEquals(1f, day(completed = 0, total = 0, hitGoal = true, minutes = 12).share, 0f)
    }
}
