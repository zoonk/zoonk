package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import kotlin.math.abs

/** Anti-aliased edges blend with the track. */
private const val NEAR = 0.25f

private fun distance(
    a: Color,
    b: Color,
) = abs(a.red - b.red) + abs(a.green - b.green) + abs(a.blue - b.blue)

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h900dp-xhdpi")
class MeterTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aMeterThatReadsZeroPercentShowsNoProgress() {
        var progress = Color.Unspecified

        compose.setContent {
            ZoonkTheme(darkTheme = false) {
                progress = MaterialTheme.colorScheme.tertiary
                Surface {
                    Meter(share = 0.004f, modifier = Modifier.padding(16.dp).width(200.dp).testTag("meter"))
                }
            }
        }

        val pixels = compose.onNodeWithTag("meter").captureToImage().toPixelMap()
        val painted = (0 until pixels.width).flatMap { x -> (0 until pixels.height).map { y -> pixels[x, y] } }

        assertFalse("A meter that reads 0% paints progress blue", painted.any { distance(it, progress) < NEAR })
    }
}
