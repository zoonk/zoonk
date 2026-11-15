package com.zoonk.android.feature.speaking

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.Dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.feature.conversation.callStarter
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.LocalClock
import com.zoonk.android.ui.components.TestClock
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.Duration
import java.util.UUID

/** The answer to the last Start tapped shows under that task only; the server decides again on every tap. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class SpeakingTaskLimitTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val clock by lazy { TestClock(rule.mainClock) }
    private val notice = "You've used your call time"
    private val failed = "The task didn't start. Try again in a moment."

    private fun startAt(index: Int) = rule.onAllNodesWithText("Start")[index]

    private fun tops(text: String): List<Dp> =
        rule
            .onAllNodesWithText(text)
            .fetchSemanticsNodes()
            .indices
            .map { rule.onAllNodesWithText(text)[it].getBoundsInRoot().top }

    /** Whether [top] sits under task [index]'s Start and above the next task. */
    private fun underTask(
        index: Int,
        top: Dp,
    ): Boolean {
        val start = startAt(index).getBoundsInRoot().bottom
        val next = if (index == 0) rule.onNodeWithText("Describir una situación").getBoundsInRoot().top else Dp.Infinity
        return top > start && top < next
    }

    @Test
    fun theLastStartsAnswerShowsUnderItsTaskOnly() {
        val limited = CallStart.Limited(Limit.Reached(LimitTier.Plus, LimitPeriod.Rolling30Days, clock.start.plus(Duration.ofDays(5))))
        val answers = ArrayDeque(listOf(limited, limited, CallStart.Failed))
        rule.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    SpeakingPaperSection(
                        paper = speakingPaper(),
                        goalId = UUID.randomUUID(),
                        openTask = "1",
                        start = callStarter { answers.removeFirst() },
                        open = {},
                        openWeb = {},
                        onRefused = {},
                    )
                }
            }
        }
        rule.onNodeWithText("Describir una situación").performClick()

        startAt(0).performClick()
        rule.waitForIdle()
        assertTrue("refused task 1: under task 1", tops(notice).size == 1 && underTask(0, tops(notice).single()))

        startAt(1).performClick()
        rule.waitForIdle()
        assertTrue("refused task 2: under task 2 only", tops(notice).size == 1 && underTask(1, tops(notice).single()))

        startAt(0).performClick()
        rule.waitForIdle()
        assertEquals("no stale notice anywhere", 0, tops(notice).size)
        assertTrue("task 1's failure under task 1", tops(failed).size == 1 && underTask(0, tops(failed).single()))
    }
}
