package com.zoonk.android.feature.session

import com.zoonk.api.models.StudyBlock.Kind
import com.zoonk.api.models.StudyBlock.Status
import org.junit.Assert.assertEquals
import org.junit.Test

class DayPartsTest {
    @Test
    fun aBlockFinishedOutOfOrderFillsItsOwnPart() {
        val lesson = step(0)
        val steps = listOf(lesson, step(1, Status.SKIPPED), step(2, Status.COMPLETED, Kind.REVIEW), step(3))

        val parts = dayParts(steps, isNext = { it == lesson })

        assertEquals(
            listOf(0L to DayPart.State.Current, 2L to DayPart.State.Done, 3L to DayPart.State.Ahead),
            parts.map { it.step.position to it.state },
        )
    }

    @Test
    fun extraWorkNeverAddsAPart() {
        val extra = step(2).copy(extra = true)
        val steps = listOf(step(0, Status.COMPLETED), step(1, Status.COMPLETED), extra)

        val parts = dayParts(steps, isNext = { it == extra })

        assertEquals(listOf(0L to DayPart.State.Done, 1L to DayPart.State.Done), parts.map { it.step.position to it.state })
    }
}
