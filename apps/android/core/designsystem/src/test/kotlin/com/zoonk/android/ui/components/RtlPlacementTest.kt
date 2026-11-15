package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** In a right-to-left layout, a suggestion's line is its left-to-right line mirrored, its action beside its words or under them. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w900dp-h1600dp-xhdpi")
class RtlPlacementTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private var direction by mutableStateOf(LayoutDirection.Ltr)

    @Test
    fun aSuggestionsActionBesideItsWordsMirrorsInRtl() {
        val (ltr, rtl) = both("Add six lessons", "Add")

        assertTrue("beside: $ltr", ltr.action.top < ltr.words.bottom)
        assertMirrored(ltr, rtl)
    }

    @Test
    fun aSuggestionsActionUnderItsWordsMirrorsInRtl() {
        val (ltr, rtl) = both("Add six lessons about web apps to this week", "Add these lessons to my plan")

        assertTrue("under: $ltr", ltr.action.top >= ltr.words.bottom)
        assertMirrored(ltr, rtl)
    }

    private data class Line(
        val words: DpRect,
        val action: DpRect,
    )

    private fun both(
        words: String,
        action: String,
    ): Pair<Line, Line> {
        compose.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalLayoutDirection provides direction) {
                    Box(Modifier.width(WIDTH)) {
                        Suggestion(
                            label = "Suggestion",
                            summary = words,
                            layout = SuggestionLayout.Line,
                            lineAction = { SuggestionAction(onClick = {}, modifier = Modifier.testTag(ACTION)) { Text(action) } },
                        ) {}
                    }
                }
            }
        }

        fun line() =
            Line(
                compose.onNodeWithText(words, useUnmergedTree = true).getUnclippedBoundsInRoot(),
                compose.onNodeWithTag(ACTION, useUnmergedTree = true).getUnclippedBoundsInRoot(),
            )
        direction = LayoutDirection.Ltr
        compose.waitForIdle()
        val ltr = line()
        direction = LayoutDirection.Rtl
        compose.waitForIdle()
        return ltr to line()
    }

    private fun assertMirrored(
        ltr: Line,
        rtl: Line,
    ) {
        for ((name, left, right) in listOf(Triple("words", ltr.words, rtl.words), Triple("action", ltr.action, rtl.action))) {
            assertEquals("$name's left in RTL: $right against $left", (WIDTH - left.right).value, right.left.value, 1f)
            assertEquals("$name's top in RTL: $right against $left", left.top.value, right.top.value, 1f)
        }
    }

    private companion object {
        const val ACTION = "action"
        val WIDTH = 320.dp
    }
}
