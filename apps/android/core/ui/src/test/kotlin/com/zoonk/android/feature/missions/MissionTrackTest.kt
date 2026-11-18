package com.zoonk.android.feature.missions

import com.zoonk.android.feature.session.DayMission
import com.zoonk.api.models.StudyMission
import org.junit.Assert.assertEquals
import org.junit.Test

class MissionTrackTest {
    @Test
    fun theMissionHeadingAnnouncesCompletionOnlyWithAFullMeter() {
        val lesson = mission(StudyMission.Kind.SOMETHING_NEW, done = true)
        val review = mission(StudyMission.Kind.REVIEW, done = false)

        listOf(listOf(lesson, review), listOf(lesson, review.copy(done = true))).forEach { missions ->
            val facts = MissionMomentFacts(missions, completed = listOf(lesson.kind), bonus = 20, bonusPaid = false)
            val meterFull = missions.all { missionTrackFill(it.done, it.progress, it.total) == 1f }
            assertEquals(meterFull, facts.announcesCompletion)
        }
    }

    @Test fun theMissionMeterCountsFinishedMissionsLikeItsHeading() {
        assertEquals(0f, missionTrackFill(done = false, progress = 1, total = 2))
        assertEquals(1f, missionTrackFill(done = true, progress = 2, total = 2))
        assertEquals(1f, missionTrackFill(done = true, progress = 0, total = 0))
    }

    private fun mission(
        kind: StudyMission.Kind,
        done: Boolean,
    ) = DayMission(kind, done, progress = 1, total = 2, minutes = null, firstStep = false, waitReason = null, detail = null, opens = null)
}
