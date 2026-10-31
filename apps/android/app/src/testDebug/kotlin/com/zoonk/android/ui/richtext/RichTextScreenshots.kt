package com.zoonk.android.ui.richtext

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
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

/**
 * Review screenshots of the rich text gallery, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*RichTextScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 * No goldens: people and agents look at them.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class RichTextScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h2000dp-xxhdpi")
    fun phoneLight() = capture("richtext-phone-light", dark = false)

    @Test
    @Config(qualifiers = "w411dp-h2000dp-night-xxhdpi")
    fun phoneDark() = capture("richtext-phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h2000dp-xxhdpi")
    fun phoneLightMoreContrast() = capture("richtext-phone-light-more-contrast", dark = false, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h2000dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("richtext-phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h3600dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("richtext-phone-font200", dark = false)
    }

    @Test
    @Config(qualifiers = "w840dp-h1600dp-xhdpi")
    fun tablet() = capture("richtext-tablet", dark = false)

    private fun capture(
        name: String,
        dark: Boolean,
        moreContrast: Boolean = false,
    ) {
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                RichTextGallery()
            }
        }

        val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        File(folder).mkdirs()
        File(folder, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
