package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.assertTouchHeightIsEqualTo
import androidx.compose.ui.test.click
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** A small or medium button's layout is the button it draws, and a tap past its ink, in its 48dp target, still presses it. */
@RunWith(AndroidJUnit4::class)
class ButtonBoxTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aSmallButtonSitsAtItsColumnsGapAndTakesTapsAroundIt() {
        var pressed = 0
        compose.setContent {
            ZoonkTheme {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.height(20.dp))
                    OutlinedButton(onClick = { pressed++ }, size = ButtonSize.Small) { Text("Subscribe") }
                    Box(Modifier.height(40.dp))
                }
            }
        }
        val button = compose.onNodeWithText("Subscribe", useUnmergedTree = false)

        val drawn = button.getUnclippedBoundsInRoot()
        assertEquals(28.dp, drawn.top)
        button.assertTouchHeightIsEqualTo(48.dp)
        // Above the drawn button, 1dp inside its 48dp target.
        val past = (48.dp - (drawn.bottom - drawn.top)) / 2 - 1.dp
        button.performTouchInput { click(Offset(centerX, -past.toPx())) }
        assertEquals(1, pressed)
    }
}
