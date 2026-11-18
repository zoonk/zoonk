package com.zoonk.android.feature.missions

import com.zoonk.android.feature.session.DayMission
import com.zoonk.api.models.StudyMission
import org.junit.Assert.assertEquals
import org.junit.Test

class MissionTrackTest {
    private val lesson = mission(StudyMission.Kind.SOMETHING_NEW, done = true)
    private val review = mission(StudyMission.Kind.REVIEW, done = false)

    @Test
    fun theMomentSaysOneMissionIsDoneWhileAnotherIsLeft() {
        val facts = MissionMomentFacts(listOf(lesson, review), completed = listOf(lesson.kind), bonus = 20, bonusPaid = false)

        assertEquals(MissionMomentTitle.Done(1), facts.title)
    }

    @Test
    fun theMomentSaysTheDaysMissionsAreDoneOnceNoneAreLeft() {
        val missions = listOf(lesson, review.copy(done = true))
        val facts = MissionMomentFacts(missions, completed = listOf(StudyMission.Kind.REVIEW), bonus = 20, bonusPaid = true)

        assertEquals(MissionMomentTitle.AllDone, facts.title)
    }

    @Test
    fun theMeterFillsOnlyFinishedMissions() {
        val complete = lesson.copy(progress = 0, total = 0)

        assertEquals(listOf(1f to 1f, 0f to 0f), MissionProgress(listOf(review, complete)).fills())
    }

    @Test
    fun aMissionJustFinishedFillsFromEmpty() {
        val facts = MissionMomentFacts(listOf(lesson, review), completed = listOf(lesson.kind), bonus = 20, bonusPaid = false)

        assertEquals(listOf(0f to 1f, 0f to 0f), facts.progress.fills(facts.justDone))
    }

    private fun mission(
        kind: StudyMission.Kind,
        done: Boolean,
    ) = DayMission(kind, done, progress = 1, total = 2, minutes = null, firstStep = false, waitReason = null, detail = null, opens = null)
}
