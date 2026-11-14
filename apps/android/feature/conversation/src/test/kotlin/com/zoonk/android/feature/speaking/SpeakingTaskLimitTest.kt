package com.zoonk.android.feature.speaking

import androidx.activity.ComponentActivity
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
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.Duration
import java.time.Instant
import java.util.UUID

/** A refused task's call-time notice sits under its own Start, and under no other task. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class SpeakingTaskLimitTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val notice = "You've used your call time"

    private fun startAt(index: Int) = rule.onAllNodesWithText("Start")[index]

    private fun noticeTops(): List<Dp> =
        rule.onAllNodesWithText(notice).fetchSemanticsNodes().indices.map {
            rule.onAllNodesWithText(notice)[it].getBoundsInRoot().top
        }

    @Test
    fun eachRefusedTaskShowsTheNoticeUnderItsOwnStart() {
        val limited = CallStart.Limited(Limit.Reached(LimitTier.Plus, LimitPeriod.Rolling30Days, Instant.now().plus(Duration.ofDays(5))))
        rule.setContent {
            ZoonkTheme {
                SpeakingPaperSection(
                    paper = speakingPaper(),
                    goalId = UUID.randomUUID(),
                    openTask = "1",
                    start = callStarter { limited },
                    open = {},
                    openWeb = {},
                    onRefused = {},
                )
            }
        }
        rule.onNodeWithText("Describir una situación").performClick()

        startAt(0).performClick()
        rule.waitForIdle()

        val secondTask = rule.onNodeWithText("Describir una situación").getBoundsInRoot().top
        val firstStart = startAt(0).getBoundsInRoot().bottom
        assertEquals(1, noticeTops().size)
        assertTrue("under the refused task's Start", noticeTops().single() > firstStart && noticeTops().single() < secondTask)

        startAt(1).performClick()
        rule.waitForIdle()

        val secondStart = startAt(1).getBoundsInRoot().bottom
        val tops = noticeTops().sorted()
        assertEquals(2, tops.size)
        assertTrue("the first stays under its Start", tops[0] > firstStart && tops[0] < secondTask)
        assertTrue("the second sits under its own Start", tops[1] > secondStart)
    }
}
