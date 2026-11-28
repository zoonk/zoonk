package com.zoonk.android.feature.activities

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.model.ActivityAnswer
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
 * Review screenshots of a language lesson's dialogue and pattern table, open and checked, written only on demand:
 * `./gradlew :feature:activities:testDebugUnitTest --tests '*LanguageActivityScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h900dp-xxhdpi")
class LanguageActivityScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    fun dialogue() = shoot("dialogue", dialogueSimulatorRenderer, "dialogueSimulator", answer = null, checked = false)

    @Test
    fun dialogueChecked() =
        shoot("dialogue-checked", dialogueSimulatorRenderer, "dialogueSimulator", selectionAnswer(listOf("blunt")), checked = true)

    @Test
    fun patternTable() = shoot("pattern-table", patternTableRenderer, "patternTable", answer = null, checked = false)

    @Test
    fun patternTableChecked() =
        shoot(
            "pattern-table-checked",
            patternTableRenderer,
            "patternTable",
            assignmentAnswer(mapOf("4" to "en", "5" to "en")),
            checked = true,
        )

    private fun shoot(
        name: String,
        renderer: ActivityRenderer,
        fixture: String,
        answer: ActivityAnswer?,
        checked: Boolean,
    ) {
        compose.setContent {
            ZoonkTheme {
                Surface {
                    Box(Modifier.padding(16.dp)) {
                        renderer.canvas(
                            ActivityProps(
                                content = ActivityFixtures.content(fixture),
                                answer = answer,
                                expected = ActivityFixtures.expected(fixture),
                                isCorrect = if (checked) false else null,
                                phase = if (checked) ActivityPhase.Checked else ActivityPhase.Answering,
                                isLocked = checked,
                                onAnswerChange = {},
                            ),
                        )
                    }
                }
            }
        }
        compose.waitForIdle()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        writeRender(file, compose.onRoot().captureRender(scenario = name).asAndroidBitmap())
        println("Screenshot ${file.path}")
    }
}
