package com.zoonk.android.feature.questions

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.height
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** A solved board's cards glide to their rows while their sizes take the new rows' at once, as main's do. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp-xxhdpi")
class MatchBoardSlideTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun cardsSlideIntoRowsWhileTheirHeightsSnap() {
        var solved by mutableStateOf(false)
        compose.setContent {
            ZoonkTheme {
                // "long" makes its row tall: beside "b" while playing, beside "a" once solved.
                MatchBoard(LEFT, RIGHT, solved = if (solved) listOf("a" to "long", "b" to "short") else null) { _, item, modifier ->
                    Box(modifier.testTag(item)) { Text(if (item == "long") "a reply\nlong enough\nfor three lines" else item) }
                }
            }
        }
        val before = bounds()
        compose.mainClock.autoAdvance = false
        compose.runOnIdle {
            solved = true
            Snapshot.sendApplyNotifications()
        }
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.advanceTimeBy(EARLY_IN_THE_SLIDE)
        val midway = bounds()
        compose.mainClock.autoAdvance = true
        compose.waitForIdle()
        val after = bounds()

        // "a" stays in its row but the row grows: its height is the new row's from the start.
        assertEquals(after.getValue("a").height, midway.getValue("a").height)
        assertTrue(before.getValue("a").height < after.getValue("a").height)
        // "short" moves down a row, partway there early in the slide.
        val (from, to) = before.getValue("short").top to after.getValue("short").top
        val shown = midway.getValue("short").top
        assertTrue("$from < $shown < $to", shown > from + 1.dp && shown < to - 1.dp)
    }

    private fun bounds(): Map<String, DpRect> = (LEFT + RIGHT).associateWith { compose.onNodeWithTag(it).getUnclippedBoundsInRoot() }

    private companion object {
        val LEFT = listOf("a", "b")
        val RIGHT = listOf("short", "long")
        const val EARLY_IN_THE_SLIDE = 40L
    }
}
