package com.zoonk.android.feature.testout

import com.zoonk.android.feature.plan.chapter
import com.zoonk.android.feature.plan.phase
import com.zoonk.android.feature.plan.plan
import com.zoonk.api.models.PlanPhase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.UUID

class PlanChapterTest {
    private val id = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1f01"

    private fun phases(vararg rows: List<String>): List<PlanPhase> {
        val json = rows.mapIndexed { index, chapters -> phase(index, "Phase $index", "current", "2026-10-01", "2026-11-01", 0, 10, chapters) }
        return plan(""""phases":[${json.joinToString(",")}]""").phases
    }

    @Test
    fun namesTheChapterWithTheLessonsItStillHasOnThePlan() {
        val found = planChapter(phases(listOf(chapter(id, "Atoms", "current", done = 1, total = 4))), UUID.fromString(id))

        assertEquals(PlanChapter("Atoms", lessonsLeft = 3), found)
    }

    @Test
    fun countsAChapterThatGoesDeeperInALaterPhaseAcrossBoth() {
        val found =
            planChapter(
                phases(
                    listOf(chapter(id, "Atoms", "done", done = 4, total = 4)),
                    listOf(chapter(id, "Atoms", "current", done = 0, total = 2)),
                ),
                UUID.fromString(id),
            )

        assertEquals(PlanChapter("Atoms", lessonsLeft = 2), found)
    }

    @Test
    fun findsNothingWhenThePlanDoesNotHaveTheChapter() {
        assertNull(planChapter(phases(listOf(chapter(null, "Atoms", "current", done = 0, total = 4))), UUID.fromString(id)))
    }
}
