package com.zoonk.android.feature.today

import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.day
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.step
import com.zoonk.api.models.StudyBlock.Status.COMPLETED
import com.zoonk.api.models.StudyExtraTime
import com.zoonk.api.models.StudyExtraTimeLessonsInner
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.Today
import org.junit.Assert.assertEquals
import org.junit.Test

class TodayMainActionTest {
    private val finished = listOf(step(0, COMPLETED), step(1, COMPLETED))

    private fun action(
        state: StudySession.State,
        steps: List<DayStep> = finished,
        extraTime: StudyExtraTime = StudyExtraTime(available = false, lessons = emptyList(), minutes = 10, reason = null),
    ): TodayMainAction? {
        val day = day(steps).copy(state = state, extraTime = extraTime)
        return TodayDayModel(TodayRead.Day(decodeFixture<Today>("today"), day), writingStalled = false).action
    }

    @Test
    fun aDoneDayContinuesOnTheExtraWorkNext() {
        val extra = step(2).copy(extra = true)

        assertEquals(TodayMainAction.Continue, action(StudySession.State.DONE, finished + extra))
    }

    @Test
    fun aDoneDayWithNothingNextKeepsLearning() {
        val lessons = listOf(StudyExtraTimeLessonsInner(minutes = 6, title = "Meiosis"))
        val more = StudyExtraTime(available = true, lessons = lessons, minutes = 10, reason = null)

        assertEquals(TodayMainAction.KeepLearning, action(StudySession.State.DONE, extraTime = more))
        assertEquals(TodayMainAction.Summary, action(StudySession.State.DONE))
    }
}
