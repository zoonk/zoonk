package com.zoonk.android.feature.missions

import androidx.compose.ui.graphics.Color
import com.zoonk.android.feature.session.DayMission
import com.zoonk.android.ui.components.MeterPart
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
            val meterFull = facts.progress.parts(Color.Black).all { it.fill is MeterPart.Fill.Solid }
            assertEquals(meterFull, facts.announcesCompletion)
        }
    }

    @Test
    fun theMeterFillsOnlyFinishedMissions() {
        val complete = mission(StudyMission.Kind.SOMETHING_NEW, done = true).copy(progress = 0, total = 0)
        val partial = mission(StudyMission.Kind.REVIEW, done = false)
        val progress = MissionProgress(listOf(partial, complete))

        assertEquals(
            listOf(MeterPart.Fill.Solid(Color.Black), MeterPart.Fill.Track),
            progress.parts(Color.Black).map(MeterPart::fill),
        )
    }

    private fun mission(
        kind: StudyMission.Kind,
        done: Boolean,
    ) = DayMission(kind, done, progress = 1, total = 2, minutes = null, firstStep = false, waitReason = null, detail = null, opens = null)
}
