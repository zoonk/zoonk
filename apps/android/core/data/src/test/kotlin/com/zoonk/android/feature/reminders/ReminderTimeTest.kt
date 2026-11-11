package com.zoonk.android.feature.reminders

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalTime

class ReminderTimeTest {
    @Test
    fun aPickedTimeRoundsToTheNearestQuarterHourAcrossMidnight() {
        assertEquals(LocalTime.of(20, 0), LocalTime.of(20, 7).nearestQuarterHour())
        assertEquals(LocalTime.of(20, 15), LocalTime.of(20, 8).nearestQuarterHour())
        assertEquals(LocalTime.of(20, 30), LocalTime.of(20, 30).nearestQuarterHour())
        assertEquals(LocalTime.MIDNIGHT, LocalTime.of(23, 53).nearestQuarterHour())
    }
}
