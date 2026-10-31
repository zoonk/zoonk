package com.zoonk.android.feature.buddy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MissionsRingTest {
    @Test
    fun aLoneMissionIsTheWholeRingButItsGapAtTheTop() {
        val arc = missionArcs(done = 0, total = 1).single()
        val end = arc.startDegrees + arc.sweepDegrees

        assertTrue(arc.startDegrees in -90f..0f)
        assertTrue(end in 180f..270f)
    }

    @Test
    fun severalMissionsShareTheRingInOrderWithAGapBetweenEach() {
        for (total in listOf(2, 3, 5)) {
            val arcs = missionArcs(done = 0, total = total)
            val ends = arcs.map { it.startDegrees + it.sweepDegrees }
            val nextStarts = arcs.drop(1).map { it.startDegrees } + (arcs.first().startDegrees + 360f)

            assertTrue(arcs.all { it.sweepDegrees in 0f..180f })
            assertTrue(ends.zip(nextStarts).all { (end, next) -> end < next })
        }
    }

    @Test
    fun theFirstDoneArcsDarkenUntilEveryOneIsDone() {
        assertEquals(List(3) { MissionArcTone.Open }, missionArcs(done = 0, total = 3).map { it.tone })
        assertEquals(
            listOf(MissionArcTone.Done, MissionArcTone.Done, MissionArcTone.Open),
            missionArcs(done = 2, total = 3).map { it.tone },
        )
        assertEquals(List(3) { MissionArcTone.Complete }, missionArcs(done = 3, total = 3).map { it.tone })
    }
}
