package com.zoonk.android.feature.buddy

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

/** In a right-to-left layout, the buddy's name and its day line are their left-to-right places mirrored, beside or under. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w900dp-h1600dp-xhdpi")
class NameAndLineRtlTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private var direction by mutableStateOf(LayoutDirection.Ltr)

    @Test
    fun aDayLineBesideTheNameMirrorsInRtl() {
        val (ltr, rtl) = both("Studied today")

        assertTrue("beside: $ltr", ltr.second.top < ltr.first.bottom)
        assertMirrored(ltr, rtl)
    }

    @Test
    fun aDayLineUnderTheNameMirrorsInRtl() {
        val (ltr, rtl) = both("Studied today, three lessons and a practice round before lunch")

        assertTrue("under: $ltr", ltr.second.top >= ltr.first.bottom)
        assertMirrored(ltr, rtl)
    }

    private fun both(line: String): Pair<Pair<DpRect, DpRect>, Pair<DpRect, DpRect>> {
        compose.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalLayoutDirection provides direction) {
                    Box(Modifier.width(WIDTH)) {
                        NameAndLine(Modifier, line = { Text(line, Modifier.testTag(LINE)) }) { Text("Pip", Modifier.testTag(NAME)) }
                    }
                }
            }
        }

        fun places() =
            compose.onNodeWithTag(NAME, useUnmergedTree = true).getUnclippedBoundsInRoot() to
                compose.onNodeWithTag(LINE, useUnmergedTree = true).getUnclippedBoundsInRoot()
        direction = LayoutDirection.Ltr
        compose.waitForIdle()
        val ltr = places()
        direction = LayoutDirection.Rtl
        compose.waitForIdle()
        return ltr to places()
    }

    private fun assertMirrored(
        ltr: Pair<DpRect, DpRect>,
        rtl: Pair<DpRect, DpRect>,
    ) {
        for ((name, left, right) in listOf(Triple("name", ltr.first, rtl.first), Triple("line", ltr.second, rtl.second))) {
            assertEquals("$name's left in RTL: $right against $left", (WIDTH - left.right).value, right.left.value, 1f)
            assertEquals("$name's top in RTL: $right against $left", left.top.value, right.top.value, 1f)
        }
    }

    private companion object {
        const val NAME = "name"
        const val LINE = "line"
        val WIDTH = 240.dp
    }
}
