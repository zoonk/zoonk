package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import kotlin.math.abs

/** The edge's pixel blends with the background a little. */
private const val BLENDED = 0.1f

private data class Look(
    val dark: Boolean,
    val moreContrast: Boolean,
)

private class Roles(
    val background: Color,
    val outline: Color,
    val outlineVariant: Color,
)

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h900dp-xhdpi")
class OutlinedButtonsTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val looks = listOf(false, true).flatMap { dark -> listOf(false, true).map { Look(dark, it) } }

    @Test
    fun anOutlinedButtonsBorderIsTheInputOutlineInEveryLook() {
        val roles = mutableMapOf<Look, Roles>()

        compose.setContent {
            Column {
                looks.forEach { look ->
                    ZoonkTheme(darkTheme = look.dark, moreContrast = look.moreContrast) {
                        val scheme = MaterialTheme.colorScheme
                        roles[look] = Roles(scheme.background, scheme.outline, scheme.outlineVariant)
                        Surface {
                            OutlinedButton(onClick = {}, modifier = Modifier.padding(8.dp).testTag("$look")) { Text("Not now") }
                        }
                    }
                }
            }
        }

        looks.forEach { look ->
            val role = roles.getValue(look)
            val pixels = compose.onNodeWithTag("$look").captureToImage().toPixelMap()
            val border = (0 until 4).map { pixels[pixels.width / 2, it] }.maxBy { distance(it, role.background) }

            assertTrue(
                "$look draws its border $border, not outline ${role.outline} (outlineVariant is ${role.outlineVariant})",
                distance(border, role.outline) < BLENDED,
            )
        }
    }

    private fun distance(
        a: Color,
        b: Color,
    ) = abs(a.red - b.red) + abs(a.green - b.green) + abs(a.blue - b.blue)
}
