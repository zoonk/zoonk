package com.zoonk.android.feature.testout

import com.zoonk.api.models.PlanPhase
import java.util.UUID

data class PlanChapter(
    val title: String,
    val lessonsLeft: Int,
)

/** A chapter whose lessons go deeper in a later phase shows in each of them, so its lessons are counted across them. */
fun planChapter(
    phases: List<PlanPhase>,
    chapterId: UUID,
): PlanChapter? {
    val rows = phases.flatMap { phase -> phase.chapters.filter { it.chapterId == chapterId } }
    val first = rows.firstOrNull() ?: return null
    return PlanChapter(first.title, rows.sumOf { maxOf(0, it.lessonsTotal - it.lessonsDone) }.toInt())
}
