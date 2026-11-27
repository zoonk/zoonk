package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId

/**
 * The notice a short break shows says how long is left and counts it down, in minutes over a minute and in
 * seconds under one, until the learner can try again. TalkBack hears the wait it was first given until the wait
 * is over, and a device clock changed during the wait doesn't move the count.
 */
@RunWith(AndroidJUnit4::class)
class SlowDownNoticeTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val testClock by lazy { TestClock(rule.mainClock) }

    /** The device's clock: the test's, moved by [jump] as a learner changing their clock would. */
    private val clock by lazy {
        object : Clock() {
            var jump: Duration = Duration.ZERO

            override fun instant(): Instant = testClock.instant().plus(jump)

            override fun getZone(): ZoneId = testClock.zone

            override fun withZone(zone: ZoneId): Clock = this
        }
    }

    /** What the notice draws, read from the words it drew them from. */
    private var shown: String? = null

    private fun show(limit: Limit.SlowDown) {
        rule.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    shown = limitWords(limit, LimitSubject.Messages).line
                    LimitNotice(limit, LimitSubject.Messages, onCreateAccount = {}, onSubscribe = {})
                }
            }
        }
    }

    private fun pass(seconds: Long) = rule.mainClock.advanceTimeBy(seconds * 1000)

    private fun shows(line: String) {
        rule.waitForIdle()
        assertEquals(line, shown)
    }

    private fun says(line: String) = rule.onNodeWithContentDescription(line).assertExists()

    @Test
    fun theWaitCountsDownUntilItCanBeTriedAgain() {
        show(Limit.SlowDown(90, testClock.start.plusSeconds(90)))
        val first = "Take a short break. You can try again in 2 minutes."

        shows(first)
        says(first)

        pass(30)
        shows("Take a short break. You can try again in 1 minute.")

        pass(1)
        shows("Take a short break. You can try again in 59 seconds.")
        says(first)

        pass(59)
        shows("You can try again now.")
        says("You can try again now.")
    }

    @Test
    fun aClockChangedDuringTheWaitDoesNotMoveIt() {
        show(Limit.SlowDown(30, testClock.start.plusSeconds(30)))

        pass(10)
        clock.jump = Duration.ofMinutes(5)
        pass(1)

        shows("Take a short break. You can try again in 19 seconds.")
    }

    @Test
    fun theLongestWaitStillCountsInMinutes() {
        show(Limit.SlowDown(Int.MAX_VALUE, testClock.start.plusSeconds(Int.MAX_VALUE.toLong())))

        shows("Take a short break. You can try again in 35,791,395 minutes.")
    }
}
