package com.zoonk.android.feature.missions
import org.junit.Assert.assertEquals
import org.junit.Test

class MissionTrackTest {
    @Test fun theMissionMeterCountsFinishedMissionsLikeItsHeading() {
        assertEquals(0f, missionTrackFill(done = false, progress = 1, total = 2))
        assertEquals(1f, missionTrackFill(done = true, progress = 2, total = 2))
        assertEquals(1f, missionTrackFill(done = true, progress = 0, total = 0))
    }
}
