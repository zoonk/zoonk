package com.zoonk.android.ui.testing

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h891dp-xxhdpi")
class CaptureRenderTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun firstActivity() = captureContent()

    @Test
    fun anotherActivityInTheSameProcess() = captureContent()

    private fun captureContent() {
        var color by mutableStateOf(Color.Red)
        compose.setContent { Box(Modifier.fillMaxSize().background(color)) }
        assertColor(compose.onRoot(), Color.Red)
        color = Color.Blue
        assertColor(compose.onRoot(), Color.Blue)
    }

    @Test
    fun croppedNode() {
        compose.setContent {
            Box(Modifier.fillMaxSize().background(Color.Red)) {
                Box(
                    Modifier
                        .offset(20.dp, 30.dp)
                        .size(40.dp, 50.dp)
                        .background(Color.Blue)
                        .testTag("crop"),
                )
            }
        }
        val image = compose.onNodeWithTag("crop").captureRender()
        assertEquals(120, image.width)
        assertEquals(150, image.height)
        assertEquals(Color.Blue.toArgb(), image.asAndroidBitmap().getPixel(60, 75))
    }

    @Test
    fun dialogWindow() {
        compose.setContent {
            Box(Modifier.fillMaxSize().background(Color.Red))
            Dialog(onDismissRequest = {}) { Box(Modifier.size(100.dp).background(Color.Blue)) }
        }
        assertColor(compose.onNode(isDialog()), Color.Blue)
    }

    private fun assertColor(
        node: SemanticsNodeInteraction,
        expected: Color,
    ) {
        val image = node.captureRender().asAndroidBitmap()
        assertEquals(expected.toArgb(), image.getPixel(image.width / 2, image.height / 2))
    }
}
