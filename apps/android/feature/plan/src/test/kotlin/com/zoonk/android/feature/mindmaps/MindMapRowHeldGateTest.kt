package com.zoonk.android.feature.mindmaps

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.time.Instant
import java.util.UUID

/** A row's own gate leaves its slot as tall as it was when its day comes, so what follows doesn't move. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MindMapRowHeldGateTest {
    @get:Rule
    val rule = createComposeRule()

    private val limit = Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, Instant.now().plusSeconds(5))
    private val map = MapFacts(UUID.randomUUID(), "Waves", 1, MindMapShown.Available, 0, null)
    private val actions = MindMapRowActions(create = {}, navigate = {}, open = {})

    /** The top of what follows the row, before and after the gate's day comes. */
    private fun followingTops(row: @Composable () -> Unit): Pair<Float, Float> {
        rule.setContent {
            ZoonkTheme {
                Column {
                    row()
                    Text("Following row")
                }
            }
        }
        rule.onNodeWithText("You've used your mind maps").assertExists()
        val before =
            rule
                .onNodeWithText("Following row")
                .getBoundsInRoot()
                .top.value
        rule.waitUntil(10_000) { rule.onAllNodesWithText("You've used your mind maps").fetchSemanticsNodes().isEmpty() }
        return before to
            rule
                .onNodeWithText("Following row")
                .getBoundsInRoot()
                .top.value
    }

    @Test
    fun aRefusedRowsGateKeepsTheNextRowInPlace() {
        val (before, after) =
            followingTops {
                MindMapRow(map, MindMapPlace.Library, MindMapShown.Refused, MindMapLocal(limit = limit), null, false, actions)
            }
        assertEquals(before, after)
    }

    @Test
    fun theChaptersGateKeepsWhatSitsUnderItInPlace() {
        val (before, after) =
            followingTops {
                MindMapRow(map, MindMapPlace.Chapter, MindMapShown.Available, null, limit, false, actions)
            }
        assertEquals(before, after)
    }
}
