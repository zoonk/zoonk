package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
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
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ListRowScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()
    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w390dp-h800dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w600dp-h900dp-xxhdpi")
    fun medium() = capture("medium")

    @Test
    @Config(qualifiers = "w1000dp-h900dp-xxhdpi")
    fun expanded() = capture("expanded")

    @Test
    @Config(qualifiers = "w390dp-h800dp-xxhdpi")
    fun dark() = capture("dark", dark = true)

    @Test
    @Config(qualifiers = "w390dp-h800dp-xxhdpi")
    fun darkMoreContrast() = capture("dark-more-contrast", dark = true, contrast = true)

    @Test
    @Config(qualifiers = "w390dp-h800dp-xxhdpi")
    fun largeText() {
        RuntimeEnvironment.setFontScale(2f)
        capture("font200")
    }

    private fun capture(
        suffix: String,
        dark: Boolean = false,
        contrast: Boolean = false,
    ) {
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = contrast) {
                Surface {
                    Column(Modifier.testTag("rows").padding(16.dp)) {
                        ListRow(headline = { Text("Mixed practice") }, meta = { Text("12 min") })
                        ListRow(
                            headline = { Text("Mixed practice\nfor your next lesson") },
                            meta = { Text("12 min") },
                            supporting = { Text("Mathematics") },
                        )
                    }
                }
            }
        }
        compose.waitForIdle()
        val file = File(folder, "android-list-row-$suffix.png")
        file.parentFile?.mkdirs()
        writeRender(file, compose.onNodeWithTag("rows").captureRender().asAndroidBitmap())
    }
}
