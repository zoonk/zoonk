package com.zoonk.android.feature.today

import com.zoonk.android.feature.today.LessonCell.Known
import com.zoonk.android.feature.today.LessonCell.Rest
import com.zoonk.android.feature.today.LessonCell.Studied
import com.zoonk.android.feature.today.LessonCell.Today
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.ceil
import kotlin.random.Random

class LessonCellsTest {
    @Test
    fun eachLessonHasItsCellWhileTheyFitStudiedThenKnownThenToday() {
        val cells = lessonCells(LessonCounts(known = 1, studied = 2, today = 1, total = 5))

        assertEquals(listOf(Studied, Studied, Known, Today, Rest), cells)
    }

    @Test
    fun aLongPlanGivesEachStateWholeCellsEveryStateItHasAtLeastOne() {
        val cells = lessonCells(LessonCounts(known = 4, studied = 10, today = 3, total = 227))

        assertEquals(29, cells.size)
        assertEquals(listOf(Studied, Known, Today, Rest), cells.take(4))
    }

    @Test
    fun aStatesCellsAreItsShareOfThePlanRounded() {
        val cells = lessonCells(LessonCounts(known = 0, studied = 40, today = 20, total = 300))

        assertEquals(4, cells.count { it == Studied })
        assertEquals(2, cells.count { it == Today })
    }

    @Test
    fun todaysCellStaysWhenTheRestOfALongPlanIsDone() {
        val cells = lessonCells(LessonCounts(known = 1, studied = 88, today = 1, total = 90))

        assertEquals(28, cells.count { it == Studied })
        assertEquals(1, cells.count { it == Known })
        assertEquals(1, cells.count { it == Today })
    }

    @Test
    fun everyStateWithLessonsHasACellInOrderAndAStateWithoutHasNone() {
        val random = Random(SEED)
        val cases = List(CASES) { List(4) { random.nextLong(0, MAX_LESSONS + 1) } } + edges()

        cases.forEach { (studied, known, today, rest) ->
            val total = studied + known + today + rest
            val cells = lessonCells(LessonCounts(known = known, studied = studied, today = today, total = total))
            val size = maxOf(1L, ceil(total / 30.0).toLong())
            val case = "studied $studied, known $known, today $today, rest $rest"

            assertEquals(case, ceil(total.toDouble() / size).toInt(), cells.size)
            assertTrue(case, cells.size <= 30)
            assertEquals(case, cells.sortedBy { it.ordinal }, cells)
            listOf(studied, known, today, rest).zip(LessonCell.entries).forEach { (lessons, state) ->
                assertEquals("$case: $state", lessons > 0, state in cells)
            }
        }
    }

    @Test
    fun aPlanWithoutLessonsHasNoCells() {
        assertEquals(emptyList<LessonCell>(), lessonCells(LessonCounts(known = 0, studied = 0, today = 0, total = 0)))
    }

    @Test
    fun lessonsDoneBeyondThePlansTotalFillEveryCellAndLeaveNoneForToday() {
        val counts = LessonCounts.of(done = 25, today = 3, total = 20, syllabusKnown = 0)

        assertEquals(0L, counts.today)
        assertEquals(List(20) { Studied }, lessonCells(counts))
    }

    @Test
    fun theSyllabusKnownLessonsNeverOutnumberThoseDoneNorTodayThoseLeft() {
        assertEquals(
            LessonCounts(known = 3, studied = 0, today = 2, total = 5),
            LessonCounts.of(done = 3, today = 4, total = 5, syllabusKnown = 7),
        )
    }

    private fun edges(): List<List<Long>> {
        val values = listOf(0L, 1L, 29L, 30L, 31L, MAX_LESSONS)
        return values.flatMap { a -> values.flatMap { b -> values.flatMap { c -> values.map { d -> listOf(a, b, c, d) } } } }
    }

    private companion object {
        const val SEED = 2748
        const val CASES = 5_000
        const val MAX_LESSONS = 1_000L
    }
}
