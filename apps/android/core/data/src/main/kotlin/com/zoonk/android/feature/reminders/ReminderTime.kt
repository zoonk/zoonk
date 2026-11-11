package com.zoonk.android.feature.reminders

import java.time.LocalTime

/** Reminders go out every 15 minutes, so a reminder's time is the nearest quarter hour, as the server takes it. */
fun LocalTime.nearestQuarterHour(): LocalTime {
    val minutes = (hour * MINUTES_PER_HOUR + minute + QUARTER / 2) / QUARTER * QUARTER
    return LocalTime.MIDNIGHT.plusMinutes(minutes.toLong())
}

private const val MINUTES_PER_HOUR = 60
private const val QUARTER = 15
