package com.zoonk.android.ui.components

import androidx.compose.ui.test.MainTestClock
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

/**
 * A [LocalClock] that follows the compose test's [main] clock, so a limit's day comes when the test
 * says, whatever the machine's speed. It starts at today's noon, so [opening] is "later today".
 */
class TestClock(
    private val main: MainTestClock,
) : Clock() {
    private val origin = main.currentTime
    val start: Instant =
        LocalDate
            .now()
            .atTime(LocalTime.NOON)
            .atZone(ZoneId.systemDefault())
            .toInstant()

    /** A limit's instant: far beyond the frames a test runs before it calls [passOpening]. */
    val opening: Instant = start.plus(WAIT)

    /** The time passes [opening], and the screen waiting for it wakes. */
    fun passOpening() = main.advanceTimeBy(WAIT.toMillis())

    override fun instant(): Instant = start.plusMillis(main.currentTime - origin)

    override fun getZone(): ZoneId = ZoneId.systemDefault()

    override fun withZone(zone: ZoneId): Clock = this

    private companion object {
        val WAIT: Duration = Duration.ofMinutes(2)
    }
}
