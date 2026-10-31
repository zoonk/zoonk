package com.zoonk.android.feature.activities.music

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
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
 * Review screenshots of melodies engraved as main's abcjs draws them (326dp is a phone's staff, 640dp a tablet's), written
 * only on demand: `./gradlew :app:testDebugUnitTest --tests '*NotationScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class NotationScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("phone", width = 326, tunes = MusicTunes.all.keys)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = capture("tablet", width = 640, tunes = MusicTunes.all.keys)

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDarkMoreContrast() =
        capture("phone-dark-more-contrast", width = 326, tunes = setOf("jig", "chords"), dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h2400dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200", width = 326, tunes = setOf("scale", "chords"))
    }

    private fun capture(
        name: String,
        width: Int,
        tunes: Set<String>,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val shots = tunes.flatMap { tune -> listOf(false, true).map { tab -> tune to tab } }
        var index by mutableIntStateOf(0)

        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                val (tune, tab) = shots[index]
                val parsed = AbcTune.parse(MusicTunes.all.getValue(tune))
                // The second note of the first bar shows the playing highlight.
                val playing = NotationElementId(parsed.playOrder.first(), 1)

                Surface(color = MaterialTheme.colorScheme.surfaceContainer, modifier = Modifier.testTag("shot")) {
                    key(index) {
                        Box(Modifier.padding(16.dp).width(width.dp)) {
                            NotationStaff(parsed, showsTab = tab, playing = { playing })
                        }
                    }
                }
            }
        }

        shots.indices.forEach { shot ->
            index = shot
            compose.waitForIdle()
            val (tune, tab) = shots[shot]
            write("notation-$tune-${if (tab) "tab" else "staff"}-$name", compose.onNodeWithTag("shot").captureToImage().asAndroidBitmap())
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
}
