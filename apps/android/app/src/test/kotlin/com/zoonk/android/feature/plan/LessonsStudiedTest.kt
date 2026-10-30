package com.zoonk.android.feature.plan

import com.zoonk.android.feature.goalcontent.modulesSyllabus
import org.junit.Assert.assertEquals
import org.junit.Test

class LessonsStudiedTest {
    @Test
    fun theLessonsSkippedAsKnownArentStudied() {
        assertEquals(1L, lessonsStudied(done = 25, known = 24))
    }

    @Test
    fun moreKnownLessonsThanDoneLeaveNoneStudied() {
        assertEquals(0L, lessonsStudied(done = 3, known = 5))
    }

    @Test
    fun aLearnGoalsStandingKeepsTheKnownLessonsOfItsPlan() {
        val summary = learnerSummary()
        val page = PlanPageState(summary.goals.first(), learnPlan(), summary)

        assertEquals(
            Standing.Progress(progress(), done = 3, known = 2, total = 20),
            standingOf(page, progress(), modulesSyllabus()),
        )
    }
}
