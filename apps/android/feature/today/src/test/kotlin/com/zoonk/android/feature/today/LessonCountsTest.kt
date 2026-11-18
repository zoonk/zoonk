package com.zoonk.android.feature.today

import org.junit.Assert.assertEquals
import org.junit.Test

class LessonCountsTest {
    @Test
    fun theSyllabusKnownLessonsNeverOutnumberThoseDone() {
        val counts = LessonCounts.of(done = 3, today = 2, total = 10, syllabusKnown = 7)

        assertEquals(3, counts.known)
        assertEquals(0, counts.studied)
    }

    @Test
    fun todaysLessonsNeverOutnumberThoseLeft() {
        assertEquals(1, LessonCounts.of(done = 9, today = 4, total = 10, syllabusKnown = 0).today)
    }

    @Test
    fun lessonsDoneBeyondThePlansTotalLeaveNoneForToday() {
        assertEquals(0, LessonCounts.of(done = 12, today = 2, total = 10, syllabusKnown = 0).today)
    }
}
