package com.zoonk.android.feature.today

import com.zoonk.android.feature.session.EmptyDay
import com.zoonk.android.feature.session.day
import com.zoonk.android.feature.session.step
import com.zoonk.api.models.StudyBlock
import org.junit.Assert.assertEquals
import org.junit.Test

class TodayDayStateTest {
    private val completed = StudyBlock.Status.COMPLETED

    @Test
    fun aDayIsUnderwayWhileABlockIsLeftEvenBeforeItsOpened() {
        assertEquals(DayState.Underway, day().dayState())
        assertEquals(DayState.Underway, day(steps = listOf(step(0, saved = false)), saved = false).dayState())
    }

    @Test
    fun aDayIsDoneOnceEveryBlockIsBehindTheLearner() {
        assertEquals(
            DayState.Done,
            day(steps = listOf(step(0, completed), step(1, StudyBlock.Status.SKIPPED)), nextPosition = null).dayState(),
        )
    }

    @Test
    fun theDailyLimitStopsADayWithBlocksLeftButNotOneAlreadyDone() {
        assertEquals(DayState.Limit, day(limitReached = true).dayState())
        assertEquals(DayState.Done, day(steps = listOf(step(0, completed)), nextPosition = null, limitReached = true).dayState())
    }

    @Test
    fun aStudyDayWithoutBlocksWaitsForItsLessonsOrHasNothingNew() {
        assertEquals(DayState.Waiting, day(steps = emptyList(), emptyDay = EmptyDay.LessonsComing).dayState())
        assertEquals(DayState.Ahead, day(steps = emptyList(), emptyDay = EmptyDay.NothingNew).dayState())
        assertEquals(DayState.Prepare, day(steps = emptyList(), emptyDay = EmptyDay.LessonsToPrepare).dayState())
    }

    @Test
    fun aDayThePlanGivesNoTimeRestsWhateverItsEmptyReason() {
        assertEquals(DayState.Rest, day(steps = emptyList(), dailyGoal = 0.0, emptyDay = EmptyDay.LessonsComing).dayState())
        assertEquals(DayState.Rest, day(steps = emptyList(), dailyGoal = 0.0).dayState())
    }

    @Test
    fun aNextPositionTheDayDoesNotHoldIsNotUnderway() {
        assertEquals(DayState.Done, day(steps = listOf(step(0, completed)), nextPosition = 3).dayState())
    }

    @Test
    fun theQueueSplitsFinishedWorkFromWhatComesBeforeAndAfterTheNextBlock() {
        val skipped = step(1, StudyBlock.Status.SKIPPED)
        val queue = day(steps = listOf(step(0, completed), skipped, step(2), step(3), step(4, completed), step(5))).queue(nextPosition = 3)

        assertEquals(listOf(0L, 1L, 4L), queue.done.map { it.position })
        assertEquals(listOf(2L), queue.before.map { it.position })
        assertEquals(listOf(5L), queue.after.map { it.position })
    }

    @Test
    fun minutesLeftCountOnlyUnfinishedBlocks() {
        assertEquals(7L, day(steps = listOf(step(0, completed, minutes = 5), step(1, minutes = 3), step(2, minutes = 4))).minutesLeft())
    }
}
