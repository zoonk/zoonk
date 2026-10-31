package com.zoonk.android.feature.recap

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.WeeklyRecap
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review screenshots of each logbook step for a real recap saved as `recap.json` (GET
 * /v1/me/weekly-recap) in the shots folder: `-Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LogbookScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()
    private val recap = File(folder, "recap.json")

    @Before
    fun onlyOnDemand() = assumeTrue("Save a recap.json in -Pzoonk.shots=<folder>", recap.isFile)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDark() = capture("phone-dark", dark = true)

    private fun capture(
        name: String,
        dark: Boolean = false,
    ) {
        val read = ApiJson.decodeFromString<WeeklyRecap>(recap.readText())
        compose.setContent { ZoonkTheme(darkTheme = dark) { Logbook(read, "Ana", onClose = {}, onStart = {}) } }

        var step = 0
        while (true) {
            compose.waitForIdle()
            write("logbook-$step-$name", compose.onRoot().captureToImage().asAndroidBitmap())
            val next =
                compose
                    .onAllNodes(
                        androidx.compose.ui.test
                            .hasText("Continue"),
                    ).fetchSemanticsNodes()
            if (next.isEmpty()) break
            compose.onNodeWithText("Continue").performClick()
            step++
        }
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
