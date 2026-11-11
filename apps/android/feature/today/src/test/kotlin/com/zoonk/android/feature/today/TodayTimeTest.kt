package com.zoonk.android.feature.today

import com.zoonk.android.feature.session.day
import com.zoonk.android.feature.session.step
import com.zoonk.api.models.StudyBlock
import org.junit.Assert.assertEquals
import org.junit.Test

class TodayTimeTest {
    private val steps = listOf(step(0).copy(estimatedMinutes = 20), step(1).copy(estimatedMinutes = 41))
    private val day = day(steps, dailyGoal = 240.0)

    @Test fun heldTimeUsesTheAuthoritativeRemainderWithEitherPreparationFlag() {
        assertEquals(179.0, day.copy(lessonsComing = true).heldMinutes, 0.0)
        assertEquals(179.0, day.copy(lessonsToPrepare = true).heldMinutes, 0.0)
        assertEquals(179.0, day.copy(lessonsComing = true, lessonsToPrepare = true).heldMinutes, 0.0)
    }

    @Test fun aResidualWithoutPreparationFlagsDoesNotAddAHeldSegment() {
        assertEquals(0.0, day.heldMinutes, 0.0)
    }

    @Test fun theFoldIncludesHeldTimeAfterOnlyUnfinishedShownRowsAreSubtracted() {
        val done = step(2, status = StudyBlock.Status.COMPLETED).copy(estimatedMinutes = 30)
        val skipped = step(3, status = StudyBlock.Status.SKIPPED).copy(estimatedMinutes = 25)
        val withFinished = day.copy(steps = steps + done + skipped)
        assertEquals(220.0, withFinished.minutesAfter(listOf(steps.first(), done, skipped)), 0.0)
        assertEquals(179.0, withFinished.copy(lessonsComing = true).heldMinutes, 0.0)
    }

    @Test fun heldAndFoldTimeKeepFractionalMinutesAndClampAtZero() {
        val fractional = day.copy(minutes = day.minutes.copy(left = 61.5))
        assertEquals(0.5, fractional.copy(lessonsComing = true).heldMinutes, 0.0)
        assertEquals(41.5, fractional.minutesAfter(steps.take(1)), 0.0)
        val short = day.copy(minutes = day.minutes.copy(left = 10.0), lessonsComing = true)
        assertEquals(0.0, short.heldMinutes, 0.0)
        assertEquals(0.0, short.minutesAfter(steps), 0.0)
    }
}
