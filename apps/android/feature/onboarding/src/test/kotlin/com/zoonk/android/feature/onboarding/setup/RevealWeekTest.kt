package com.zoonk.android.feature.onboarding.setup

import com.zoonk.api.models.PlanDay
import com.zoonk.api.models.PlanItem
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RevealWeekTest {
    @Test
    fun theWeekCountsOnlyTheDaysItLists() {
        val week = listOf(day(1, minutes = 20.0, lessons = 1), day(2), day(3, minutes = 25.0, lessons = 2)).studyWeek()

        assertEquals(RevealWeekCount(days = 2, minutes = 45), week)
    }

    @Test
    fun aWeekOfRestDaysShowsNothing() {
        assertNull(List(6) { day(it + 1) }.studyWeek())
    }

    private fun day(
        dayOfMonth: Int,
        minutes: Double = 0.0,
        lessons: Int = 0,
    ) = PlanDay(
        date = LocalDate(2026, 11, dayOfMonth),
        items =
            List(lessons) {
                PlanItem(
                    chapterId = null,
                    id = null,
                    kind = PlanItem.Kind.LESSON,
                    lessonId = null,
                    lessons = 1L,
                    minutes = null,
                    requiresPlus = false,
                    scheduledFor = null,
                    skillId = null,
                    status = PlanItem.Status.TODO,
                    title = "Lesson $it",
                    writing = false,
                )
            },
        minutes = minutes,
        mockFunding = null,
        state = if (lessons == 0) PlanDay.State.REST else PlanDay.State.UPCOMING,
    )
}
