package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review screenshots of invalid fields, the default shape and a composer's, written only on demand:
 * `./gradlew :core:designsystem:testDebugUnitTest --tests '*TextFieldScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TextFieldScreenshots {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before fun onlyOnDemand() = assumeTrue(folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h400dp-xxhdpi")
    fun invalid() = capture("text-field-invalid", dark = false)

    @Test
    @Config(qualifiers = "w411dp-h400dp-night-xxhdpi")
    fun invalidDark() = capture("text-field-invalid-dark", dark = true)

    private fun capture(
        name: String,
        dark: Boolean,
    ) {
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = false) {
                Surface {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        OutlinedTextField(
                            state = rememberTextFieldState("Lisbon"),
                            label = "Capital of Portugal",
                            isError = true,
                            supportingText = { Text("Check the spelling.") },
                        )
                        OutlinedTextField(
                            state = rememberTextFieldState("Why can't light escape?"),
                            modifier = Modifier.fillMaxWidth(),
                            isError = true,
                            shape = RoundedCornerShape(ZoonkRadius.xl),
                        )
                    }
                }
            }
        }
        compose.waitForIdle()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        writeRender(file, compose.onRoot().captureRender().asAndroidBitmap())
    }
}
