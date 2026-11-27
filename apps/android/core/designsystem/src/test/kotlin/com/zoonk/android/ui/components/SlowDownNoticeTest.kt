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

/**
 * A short break says how long is left and counts it down, in minutes over a minute and in seconds under one,
 * until the learner can try again. What TalkBack hears stays the wait it was first given until the wait is over.
 */
@RunWith(AndroidJUnit4::class)
class SlowDownNoticeTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val clock by lazy { TestClock(rule.mainClock) }

    private fun show(limit: Limit.SlowDown) {
        rule.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    val words = limitWords(limit, LimitSubject.Messages)
                    Column {
                        Text("Shows: ${words.line}")
                        Text("Says: ${words.said}")
                    }
                }
            }
        }
    }

    private fun pass(seconds: Long) = rule.mainClock.advanceTimeBy(seconds * 1000)

    @Test
    fun theWaitCountsDownUntilItCanBeTriedAgain() {
        show(Limit.SlowDown(90, until = clock.start.plusSeconds(90)))
        val said = "Says: Take a short break. You can try again in 2 minutes."

        rule.onNodeWithText("Shows: Take a short break. You can try again in 2 minutes.").assertExists()
        rule.onNodeWithText(said).assertExists()

        pass(30)
        rule.onNodeWithText("Shows: Take a short break. You can try again in 1 minute.").assertExists()

        pass(1)
        rule.onNodeWithText("Shows: Take a short break. You can try again in 59 seconds.").assertExists()
        rule.onNodeWithText(said).assertExists()

        pass(59)
        rule.onNodeWithText("Shows: You can try again now.").assertExists()
        rule.onNodeWithText("Says: You can try again now.").assertExists()
    }

    @Test
    fun aBreakNothingTimedCountsFromWhenItShows() {
        show(Limit.SlowDown(30))
        pass(20)

        rule.onNodeWithText("Shows: Take a short break. You can try again in 10 seconds.").assertExists()
    }
}
