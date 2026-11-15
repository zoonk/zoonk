package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Duration
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Every cap counted over the last 30 days says when more comes back, from the refusal's `availableAt`, in the learner's calendar. */
@RunWith(AndroidJUnit4::class)
class MonthlyLimitWordsTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    /** Noon, so an hour from now is later today and a day from now is tomorrow. */
    private val clock by lazy { TestClock(rule.mainClock) }
    private val now by lazy { clock.start }

    private fun show(
        limit: Limit.Reached,
        subject: LimitSubject,
    ) {
        rule.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    val words = limitWords(limit, subject)
                    Column {
                        words.title?.let { Text(it) }
                        words.line?.let { Text(it) }
                    }
                }
            }
        }
    }

    private fun free(after: Duration) = Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, now.plus(after))

    @Test
    fun theLessonGateNamesTheDayMoreComesBack() {
        val day = now.plus(Duration.ofDays(5)).atZone(clock.zone).toLocalDate()
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

    /** Once the day comes, the title and the offer to subscribe go with the refusal. */
    @Test
    fun theDayHasComeWhileTheGateIsOpen() {
        show(free(Duration.ofSeconds(-1)), LimitSubject.Messages)

        rule.onNodeWithText("You've used your messages").assertDoesNotExist()
        rule.onNodeWithText("You can try again now.").assertExists()
    }

    /** The device's clock is ahead of the server's: a day already past when the refusal arrived keeps the gate, with no day. */
    @Test
    fun aDayPastOnArrivalKeepsTheGate() {
        show(free(Duration.ofSeconds(-1)).received(now), LimitSubject.Messages)

        rule.onNodeWithText("You've used your messages").assertExists()
        rule.onNodeWithText("You can try again now.").assertDoesNotExist()
    }

    /** Daily caps are unchanged. */
    @Test
    fun aDailyCapStillSaysToday() {
        show(Limit.Reached(LimitTier.Free, LimitPeriod.Day), LimitSubject.Messages)

        rule.onNodeWithText("No more messages today").assertExists()
        rule.onNodeWithText("More tomorrow, or subscribe to keep going.").assertExists()
    }
}
