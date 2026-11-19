package com.zoonk.android.feature.today

import org.junit.Assert.assertEquals
import org.junit.Test

class LessonsLeftTodayTest {
    @Test
    fun todaysLessonsNeverOutnumberThoseLeft() {
        assertEquals(1, lessonsLeftToday(done = 9, today = 4, total = 10))
    }

    @Test
    fun lessonsDoneBeyondThePlansTotalLeaveNoneForToday() {
        assertEquals(0, lessonsLeftToday(done = 12, today = 2, total = 10))
    }
}
