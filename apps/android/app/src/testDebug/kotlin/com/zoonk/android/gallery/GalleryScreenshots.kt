package com.zoonk.android.gallery

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
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
 * Review screenshots of the gallery, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*GalleryScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 * No goldens: people and agents look at them.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class GalleryScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w1560dp-h2400dp-xhdpi")
    fun everySectionInEveryScheme() = captureSections("scheme", SCHEMES)

    @Test
    @Config(qualifiers = "w800dp-h4000dp-xhdpi")
    fun everySectionAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureSections("font200", listOf(SCHEMES.first(), SCHEMES.last()))
    }

    @Test
    @Config(qualifiers = "w800dp-h2400dp-xhdpi")
    fun everySectionRightToLeft() = captureSections("rtl", SCHEMES.take(2), LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = captureScreen("phone", dark = false)

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = captureScreen("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = captureScreen("tablet", dark = false)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-night-xhdpi")
    fun tabletDark() = captureScreen("tablet-dark", dark = true)

    private fun captureScreen(
        name: String,
        dark: Boolean,
        moreContrast: Boolean = false,
    ) {
        compose.setContent { ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) { ComponentGallery() } }
        compose.waitForIdle()
        write(name, compose.onRoot().captureToImage().asAndroidBitmap())
    }

    private fun captureSections(
        prefix: String,
        schemes: List<Scheme>,
        direction: LayoutDirection = LayoutDirection.Ltr,
    ) {
        var index by mutableIntStateOf(0)

        compose.setContent {
            CompositionLocalProvider(LocalLayoutDirection provides direction) {
                Row(Modifier.testTag(SHOT)) {
                    schemes.forEach { scheme -> SchemeColumn(scheme) { GallerySectionBlock(gallerySections[index]) } }
                }
            }
        }

        gallerySections.indices.forEach { section ->
            index = section
            compose.waitForIdle()
            val slug = gallerySections[section].title.lowercase().replace(' ', '-')
            write("$prefix-${"%02d".format(section + 1)}-$slug", compose.onNodeWithTag(SHOT).captureToImage().asAndroidBitmap())
        }
    }

    @Composable
    private fun SchemeColumn(
        scheme: Scheme,
        content: @Composable () -> Unit,
    ) {
        ZoonkTheme(darkTheme = scheme.dark, moreContrast = scheme.moreContrast) {
            Surface(Modifier.width(COLUMN_WIDTH)) {
                Box(Modifier.padding(16.dp)) { content() }
            }
        }
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("Screenshot ${file.path}")
    }

    private class Scheme(
        val dark: Boolean,
        val moreContrast: Boolean,
    )

    private companion object {
        const val SHOT = "shot"
        val COLUMN_WIDTH = 380.dp
        val SCHEMES =
            listOf(
                Scheme(dark = false, moreContrast = false),
                Scheme(dark = true, moreContrast = false),
                Scheme(dark = false, moreContrast = true),
                Scheme(dark = true, moreContrast = true),
            )
    }
}
