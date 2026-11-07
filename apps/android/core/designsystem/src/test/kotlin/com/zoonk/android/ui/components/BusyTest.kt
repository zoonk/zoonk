package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertAll
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.height
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class BusyTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    /** A busy row's spinner covers its chevron without taking room from its words, so a wrap-prone row keeps its size at 200% font, and screen readers skip it. */
    @Test
    @Config(qualifiers = "w500dp-h900dp-xhdpi", fontScale = 2f)
    fun slowBusyRowKeepsItsSize() {
        var busy by mutableStateOf(false)
        compose.setContent {
            ZoonkTheme {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    for (width in WIDTHS) {
                        ListRow(
                            headline = { Text("Practice this chapter") },
                            modifier = Modifier.width(width.dp).testTag("row-$width"),
                            onClick = {},
                            busy = busy,
                            leading = { KindDot(LearnKind.Practice) },
                        )
                    }
                }
            }
        }
        val atRest = heights()

        busy = true
        compose.waitForIdle()
        compose.mainClock.advanceTimeBy(3_000)
        compose.waitForIdle()

        assertEquals(atRest, heights())
        val spinners = compose.onAllNodes(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate), useUnmergedTree = true)
        spinners.assertCountEquals(WIDTHS.count())
        spinners.assertAll(SemanticsMatcher.keyIsDefined(SemanticsProperties.HideFromAccessibility))

        // A spinner still running when the test ends makes later captureRender calls in this JVM read a stale frame.
        busy = false
        compose.waitForIdle()
    }

    private fun heights() = WIDTHS.associateWith { compose.onNodeWithTag("row-$it").getUnclippedBoundsInRoot().height }

    private companion object {
        val WIDTHS = 350..366
    }
}
