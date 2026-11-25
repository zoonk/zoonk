package com.zoonk.android.feature.activities.code

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
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
 * Review screenshots of the SQL editor with a query longer than a phone's line, written only on demand:
 * `./gradlew :feature:activities:testDebugUnitTest --tests '*CodeEditorScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CodeEditorScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h400dp-xxhdpi")
    fun phone() {
        compose.setContent {
            ZoonkTheme {
                Surface {
                    CodeEditor(
                        state = rememberTextFieldState(LONG_QUERY),
                        language = CodeLanguage.Sql,
                        label = "Your query",
                        placeholder = "SELECT",
                        focusRequester = remember { FocusRequester() },
                        onSubmit = {},
                        readOnly = false,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            }
        }
        compose.waitForIdle()
        val file = File(folder, "sql-editor-long-query-phone.png").apply { parentFile?.mkdirs() }
        writeRender(file, compose.onRoot().captureRender().asAndroidBitmap())
        println("Screenshot ${file.path}")
    }

    private companion object {
        const val LONG_QUERY =
            "SELECT name, city FROM customers WHERE city = 'Lisbon' AND signed_up > '2024-01-01' ORDER BY name;\nSELECT 1;"
    }
}
