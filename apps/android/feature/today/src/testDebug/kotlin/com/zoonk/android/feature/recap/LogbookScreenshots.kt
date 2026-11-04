package com.zoonk.android.feature.recap

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.WeeklyRecap
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
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
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
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

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w700dp-h840dp-xhdpi")
    fun medium() = capture("medium")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = capture("tablet")

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun book() = capture("book", fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-night-xhdpi")
    fun bookDarkMoreContrast() = capture("book-dark-more-contrast", dark = true, moreContrast = true, fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookRightToLeft() = capture("book-rtl", fold = true, layoutDirection = LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("book-font200", fold = true)
    }

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun smallBook() = capture("small-book", fold = true)

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        fold: Boolean = false,
        layoutDirection: LayoutDirection = LayoutDirection.Ltr,
    ) {
        val read = ApiJson.decodeFromString<WeeklyRecap>(recap.readText())
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                CompositionLocalProvider(LocalLayoutDirection provides layoutDirection) {
                    Logbook(read, "Ana", onClose = {}, onStart = {})
                }
            }
        }

        if (fold) compose.unfoldBook(folds)
        var step = 0
        while (true) {
            compose.waitForIdle()
            write("logbook-$step-$name", compose.onRoot().captureToImage().asAndroidBitmap())
            if (compose.onAllNodes(hasText("Continue")).fetchSemanticsNodes().isEmpty()) break
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
