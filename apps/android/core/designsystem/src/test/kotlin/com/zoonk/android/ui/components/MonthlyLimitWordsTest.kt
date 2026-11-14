package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.TimeZone

/** Every cap counted over the last 30 days says when more comes back, from the refusal's `availableAt`, in the learner's calendar. */
@RunWith(AndroidJUnit4::class)
class MonthlyLimitWordsTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val zone = TimeZone.getDefault()
    private val now = Instant.now()

    /** The device's clock reads noon, so an hour from now is later today and a day from now is tomorrow. */
    @Before
    fun noonOnTheDevice() {
        val sinceMidnight =
            Duration.between(
                now
                    .atZone(ZoneOffset.UTC)
                    .toLocalDate()
                    .atStartOfDay(ZoneOffset.UTC)
                    .toInstant(),
                now,
            )
        val offset =
            Duration
                .ofHours(12)
                .minus(sinceMidnight)
                .toMinutes()
                .let { if (it > 12 * 60) it - 24 * 60 else it }
        TimeZone.setDefault(TimeZone.getTimeZone(ZoneOffset.ofTotalSeconds((offset * 60).toInt())))
    }

    @After
    fun restoreZone() = TimeZone.setDefault(zone)

    private fun show(
        limit: Limit.Reached,
        subject: LimitSubject,
    ) {
        rule.setContent {
            ZoonkTheme {
                val words = limitWords(limit, subject)
                Column {
                    words.title?.let { Text(it) }
                    words.line?.let { Text(it) }
                }
            }
        }
    }

    private fun free(after: Duration) = Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, now.plus(after))

    @Test
    fun theLessonGateNamesTheDayMoreComesBack() {
        val day = now.plus(Duration.ofDays(5)).atZone(ZoneId.systemDefault()).toLocalDate()
        show(free(Duration.ofDays(5)), LimitSubject.Lessons)

        rule.onNodeWithText("You've used your free lessons").assertExists()
        rule
            .onNodeWithText(
                "More on ${day.format(DateTimeFormatter.ofPattern("MMMM d", Locale.ENGLISH))}, or subscribe to keep going.",
            ).assertExists()
    }

    @Test
    fun theLessonGateSaysLaterToday() {
        show(free(Duration.ofHours(1)), LimitSubject.Lessons)

        rule.onNodeWithText("More later today, or subscribe to keep going.").assertExists()
    }

    @Test
    fun theBuddysMessagesSayTomorrow() {
        show(free(Duration.ofDays(1)), LimitSubject.Messages)

        rule.onNodeWithText("You've used your messages").assertExists()
        rule.onNodeWithText("More tomorrow, or subscribe to keep going.").assertExists()
    }

    @Test
    fun aSubscriberIsNeverOfferedToSubscribe() {
        show(Limit.Reached(LimitTier.Plus, LimitPeriod.Rolling30Days, now.plus(Duration.ofHours(1))), LimitSubject.Messages)

        rule.onNodeWithText("You've used your messages").assertExists()
        rule.onNodeWithText("More later today.").assertExists()
    }

    @Test
    fun theDayHasComeWhileTheGateIsOpen() {
        show(free(Duration.ofSeconds(-1)), LimitSubject.Messages)

        rule.onNodeWithText("You've used your messages").assertExists()
        rule.onNodeWithText("You can try again now.").assertExists()
    }

    /** A speaking task needs its whole length: the line says when there'll be enough, for the day's cap and the month's. */
    @Test
    fun aStartOfASetLengthSaysWhenThereWillBeEnough() {
        rule.setContent {
            ZoonkTheme {
                Column {
                    enoughLine(Limit.Reached(LimitTier.Free, LimitPeriod.Day))?.let { Text(it) }
                    enoughLine(Limit.Reached(LimitTier.Plus, LimitPeriod.Rolling30Days, now.plus(Duration.ofHours(1))))?.let { Text(it) }
                }
            }
        }

        rule.onNodeWithText("You'll have enough tomorrow, or subscribe to keep going.").assertExists()
        rule.onNodeWithText("You'll have enough later today.").assertExists()
    }

    /** Daily caps are unchanged. */
    @Test
    fun aDailyCapStillSaysToday() {
        show(Limit.Reached(LimitTier.Free, LimitPeriod.Day), LimitSubject.Messages)

        rule.onNodeWithText("No more messages today").assertExists()
        rule.onNodeWithText("More tomorrow, or subscribe to keep going.").assertExists()
    }
}
