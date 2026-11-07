package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertAll
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasAnySibling
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.height
import androidx.compose.ui.unit.size
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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
    fun busyRowKeepsItsSize() {
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

        assertEquals(atRest, heights())
        val spinners = spinners()
        spinners.assertCountEquals(WIDTHS.count())
        spinners.assertAll(SemanticsMatcher.keyIsDefined(SemanticsProperties.HideFromAccessibility))

        // A spinner still running when the test ends makes later captureRender calls in this JVM read a stale frame.
        busy = false
        compose.waitForIdle()
    }

    /** From the press, a button's spinner takes its icon's place beside its words, or covers the words of one without an icon, and neither changes size. */
    @Test
    @Config(qualifiers = "w500dp-h900dp-xhdpi", fontScale = 2f)
    fun busyButtonKeepsItsSizeAndItsWords() {
        var busy by mutableStateOf(false)
        compose.setContent {
            ZoonkTheme {
                Column {
                    Button(
                        onClick = {
                        },
                        Modifier.testTag(
                            "icon",
                        ),
                        busy = busy,
                        icon = { Icon(painterResource(R.drawable.ic_play_arrow), contentDescription = null) },
                    ) {
                        Text("Start session")
                    }
                    OutlinedButton(onClick = {}, Modifier.testTag("words"), busy = busy) { Text("Check") }
                }
            }
        }
        val atRest = buttonSizes()

        busy = true
        compose.waitForIdle()

        assertEquals(atRest, buttonSizes())
        spinners().assertCountEquals(2)
        val spinner = spinnerIn("Start session").getUnclippedBoundsInRoot()
        val words = compose.onNodeWithText("Start session", useUnmergedTree = true).getUnclippedBoundsInRoot()
        assertTrue(spinner.right <= words.left)
        spinnerIn("Check").assertExists()

        busy = false
        compose.waitForIdle()
    }

    private fun heights() = WIDTHS.associateWith { compose.onNodeWithTag("row-$it").getUnclippedBoundsInRoot().height }

    private fun buttonSizes() = listOf("icon", "words").map { compose.onNodeWithTag(it).getUnclippedBoundsInRoot().size }

    private fun spinners() = compose.onAllNodes(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate), useUnmergedTree = true)

    private fun spinnerIn(button: String) =
        compose.onNode(
            hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate) and hasAnySibling(hasText(button)),
            useUnmergedTree = true,
        )

    private companion object {
        val WIDTHS = 350..366
    }
}
