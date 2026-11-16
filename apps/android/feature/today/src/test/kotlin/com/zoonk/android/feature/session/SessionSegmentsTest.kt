package com.zoonk.android.feature.session

import com.zoonk.android.ui.components.TaskSegment
import com.zoonk.api.models.StudyBlock
import org.junit.Assert.assertEquals
import org.junit.Test

class SessionSegmentsTest {
    private val steps = listOf(step(0), step(1))

    @Test fun theHeaderMarksTheLearnersPlace() {
        assertEquals(listOf(TaskSegment.Current, TaskSegment.Ahead), sessionSegments(steps, position = 0, counted = false))
    }

    @Test fun beside_0_of_2_done_nothingIsLit() {
        assertEquals(listOf(TaskSegment.Ahead, TaskSegment.Ahead), sessionSegments(steps, position = 0, counted = true))
    }

    @Test fun aCountedBarLightsWhatsDone() {
        val day = listOf(step(0, StudyBlock.Status.COMPLETED), step(1))
        assertEquals(listOf(TaskSegment.Done, TaskSegment.Ahead), sessionSegments(day, position = 1, counted = true))
    }
}
