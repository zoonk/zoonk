package com.zoonk.android.feature.today

import org.junit.Assert.assertEquals
import org.junit.Test

class LessonCellsTest {
    @Test
    fun eachLessonHasItsCellWhileTheyFitStudiedThenKnownThenToday() {
        val cells = lessonCells(LessonCounts(known = 1, studied = 2, today = 1, total = 5))

        assertEquals(
            listOf(
                LessonCell(studied = 1f, known = 0f, planned = false),
                LessonCell(studied = 1f, known = 0f, planned = false),
                LessonCell(studied = 0f, known = 1f, planned = false),
                LessonCell(studied = 0f, known = 0f, planned = true),
                LessonCell(studied = 0f, known = 0f, planned = false),
            ),
            cells,
        )
    }

    @Test
    fun aLongPlanSharesThirtyCellsAndFillsTheOneItReachesInPart() {
        val cells = lessonCells(LessonCounts(known = 0, studied = 4, today = 2, total = 90))

        assertEquals(30, cells.size)
        assertEquals(listOf(1f, 1f / 3, 0f), cells.take(3).map { it.studied })
        assertEquals(emptyList<LessonCell>(), cells.filter { it.planned })
    }

    @Test
    fun aPlanWithoutLessonsHasNoCells() {
        assertEquals(emptyList<LessonCell>(), lessonCells(LessonCounts(known = 0, studied = 0, today = 0, total = 0)))
    }

    @Test
    fun lessonsDoneBeyondThePlansTotalFillEveryCellAndLeaveNoneForToday() {
        val counts = LessonCounts.of(done = 25, today = 3, total = 20, syllabusKnown = 0)

        assertEquals(0L, counts.today)
        assertEquals(List(20) { LessonCell(studied = 1f, known = 0f, planned = false) }, lessonCells(counts))
    }

    @Test
    fun theSyllabusKnownLessonsNeverOutnumberThoseDoneNorTodayThoseLeft() {
        assertEquals(
            LessonCounts(known = 3, studied = 0, today = 2, total = 5),
            LessonCounts.of(done = 3, today = 4, total = 5, syllabusKnown = 7),
        )
    }
}
