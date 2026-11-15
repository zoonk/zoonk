package com.zoonk.android.ui.components

import androidx.compose.ui.test.MainTestClock
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * A [LocalClock] that follows the compose test's [main] clock, so a limit's day comes when the test
 * says, whatever the machine's speed or date. It starts at noon on a fixed day, so [opening] is
 * "later today"; what stamps a refusal on arrival takes this clock too.
 */
class TestClock(
    private val main: MainTestClock,
) : Clock() {
    private val origin = main.currentTime
    val start: Instant = Instant.parse("2026-03-16T12:00:00Z")

    /** A limit's instant: far beyond the frames a test runs before it calls [passOpening]. */
    val opening: Instant = start.plus(WAIT)

    /** The time passes [opening], and the screen waiting for it wakes. */
    fun passOpening() = main.advanceTimeBy(WAIT.toMillis())

    override fun instant(): Instant = start.plusMillis(main.currentTime - origin)

    override fun getZone(): ZoneId = ZoneOffset.UTC

    override fun withZone(zone: ZoneId): Clock = this

    private companion object {
        val WAIT: Duration = Duration.ofMinutes(2)
    }
}
