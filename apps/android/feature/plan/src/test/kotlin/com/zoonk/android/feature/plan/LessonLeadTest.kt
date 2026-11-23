package com.zoonk.android.feature.plan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LessonLeadTest {
    @Test
    fun moreTimeThatAddsManyLessonsWhileAMockTakesAFewLeadsWithTheMoreThatCome() {
        assertEquals(LessonLead(count = 90, fewer = false), lessonLead(added = 102, removed = 12))
    }

    @Test
    fun aChangeThatTakesOutMoreThanItAddsLeadsWithTheFewer() {
        assertEquals(LessonLead(count = 6, fewer = true), lessonLead(added = 4, removed = 10))
    }

    @Test
    fun aChangeThatOnlyAddsOrOnlyTakesOutLeadsWithThatCount() {
        assertEquals(LessonLead(count = 14, fewer = false), lessonLead(added = 14, removed = 0))
        assertEquals(LessonLead(count = 8, fewer = true), lessonLead(added = 0, removed = 8))
    }

    @Test
    fun aChangeThatMovesAsManyLessonsAsItTakesOutLeadsWithNoCount() {
        assertNull(lessonLead(added = 5, removed = 5))
        assertNull(lessonLead(added = 0, removed = 0))
    }
}
