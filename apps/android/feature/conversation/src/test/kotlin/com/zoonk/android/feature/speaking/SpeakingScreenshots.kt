package com.zoonk.android.feature.speaking

import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.feature.conversation.callStarter
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
import java.util.UUID

/** Review screenshots of a speaking paper with its first task open: `-Pzoonk.shots=<folder>`. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h891dp-xxhdpi")
class SpeakingScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    fun openTaskPhone() = capture("speaking-task-phone")

    @Test
    fun openTaskPhoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("speaking-task-phone-font200")
    }

    private fun capture(name: String) {
        compose.setContent {
            ZoonkTheme {
                Surface {
                    SpeakingPaperSection(
                        paper = speakingPaper(),
                        goalId = UUID.randomUUID(),
                        openTask = "1",
                        start = callStarter { CallStart.Failed },
                        open = {},
                        openWeb = {},
                        onRefused = {},
                    )
                }
            }
        }
        compose.waitForIdle()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        writeRender(file, compose.onRoot().captureRender().asAndroidBitmap())
    }
}
