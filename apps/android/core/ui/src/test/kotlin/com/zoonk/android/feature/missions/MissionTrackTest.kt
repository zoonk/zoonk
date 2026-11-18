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
    fun eachPartFillsAsFarAsItsMissionGotFurthestFirst() {
        val started = review.copy(progress = 1, total = 3)
        val untouched = mission(StudyMission.Kind.ESSAY, done = false).copy(progress = 0)

        assertEquals(
            listOf(1f to 1f, 1f / 3 to 1f / 3, 0f to 0f),
            MissionProgress(listOf(untouched, started, lesson)).fills(),
        )
    }

    @Test
    fun aMissionJustFinishedFillsFromTheStepBeforeIt() {
        val finished = review.copy(done = true, progress = 3, total = 3)
        val facts = MissionMomentFacts(listOf(finished), completed = listOf(finished.kind), bonus = 20, bonusPaid = false)

        assertEquals(listOf(2f / 3 to 1f), facts.progress.fills(facts.justDone))
    }

    private fun mission(
        kind: StudyMission.Kind,
        done: Boolean,
    ) = DayMission(kind, done, progress = 1, total = 2, minutes = null, firstStep = false, waitReason = null, detail = null, opens = null)
}
