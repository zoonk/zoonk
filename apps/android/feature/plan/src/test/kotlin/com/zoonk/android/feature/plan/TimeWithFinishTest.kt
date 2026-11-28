package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.components.DailyTimePicker
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.time.LocalDate

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h900dp")
class TimeWithFinishTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    /** At twice the text size, a language aim and its "by" line stay one block at the time's end, as main's do, never wrapped under it. */
    @Test
    fun theAimAndWhenItIsReachedEndOnTheSameEdgeBesideTheTime() {
        RuntimeEnvironment.setFontScale(2f)
        compose.setContent {
            ZoonkTheme {
                TimeWithFinish(PlanForecast.On(LocalDate.of(2027, 11, 1), year = false), Modifier.padding(horizontal = 16.dp), aim = "B1") {
                    DailyTimePicker(times = listOf(90L), minutes = 90, label = "Time a day", onChange = {})
                }
            }
        }

        val time = bounds("30", substring = true)
        val aim = bounds("B1")
        val by = bounds("by November", substring = true)

        assertEquals(aim.right.value, by.right.value, 0.5f)
        assertTrue("the finish sits beside the time, not under it", by.left >= time.right && by.top < time.bottom)
    }

    private fun bounds(
        text: String,
        substring: Boolean = false,
    ): DpRect = compose.onNodeWithText(text, substring = substring, useUnmergedTree = true).getBoundsInRoot()
}
