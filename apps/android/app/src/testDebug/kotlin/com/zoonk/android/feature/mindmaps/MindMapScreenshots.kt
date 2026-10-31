package com.zoonk.android.feature.mindmaps

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.PrivatePictures
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

/**
 * Review screenshots of the mind maps page, a chapter's mind map card and the viewer, written only
 * on demand: `./gradlew :app:testDebugUnitTest --tests '*MindMapScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 * Pictures don't load on the JVM, so they show as their muted surface.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MindMapScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1800dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h1800dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h3600dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w700dp-h1400dp-xhdpi")
    fun medium() = capture("medium")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun expanded() = capture("expanded")

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        var index by mutableIntStateOf(0)
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                val context = LocalContext.current
                val pictures = remember { PrivatePictures(AppContainer.preview(context).images, SESSION) }
                CompositionLocalProvider(LocalPrivatePictures provides pictures) {
                    Surface { key(index) { SCREENS[index].second() } }
                }
            }
        }
        SCREENS.indices.forEach { screen ->
            index = screen
            compose.waitForIdle()
            write("${SCREENS[screen].first}-$name", compose.onRoot().captureToImage().asAndroidBitmap())
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

    private companion object {
        val SESSION = AuthenticatedSession("ana", "token-a", "local-a")
        val FREE_CAP = Limit.Reached(LimitTier.Free, LimitPeriod.Day)
        val NO_ACTIONS = MindMapsActions({}, {}, {}, {}, {}, {})
        val CARD_ACTIONS = MindMapCardActions({}, {}, {}, {})

        @Composable
        fun Grid(cap: Limit? = null) {
            val stuck = mapOf(UUID.fromString(mapChapter(11)) to MindMapLocal(stuck = true))
            MindMapsPage(goalMindMaps(), stuck, cap, NO_ACTIONS, rememberAppNavigator())
        }

        @Composable
        fun Cards() {
            val navigator = rememberAppNavigator()
            Column(Modifier.padding(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(32.dp)) {
                MindMapCardContent(chapterMindMap("available"), MindMapShown.Available, null, null, CARD_ACTIONS, navigator)
                MindMapCardContent(chapterMindMap("generating"), MindMapShown.Generating, null, null, CARD_ACTIONS, navigator)
                MindMapCardContent(chapterMindMap("failed"), MindMapShown.Unreachable, null, FREE_CAP, CARD_ACTIONS, navigator)
                MindMapCardContent(chapterMindMap("ready"), MindMapShown.Ready, null, null, CARD_ACTIONS, navigator)
            }
        }

        val SCREENS: List<Pair<String, @Composable () -> Unit>> =
            listOf(
                "mind-maps" to { Grid() },
                "mind-maps-capped" to { Grid(FREE_CAP) },
                "mind-maps-empty" to {
                    MindMapsPage(
                        goalMindMaps(emptyList(), next = """{"chapterId":"${mapChapter(3)}","lessonsLeft":2,"title":"Waves and sound"}"""),
                        emptyMap(),
                        null,
                        NO_ACTIONS,
                        rememberAppNavigator(),
                    )
                },
                "mind-map-cards" to { Cards() },
                "mind-map-text" to {
                    MindMapCardContent(
                        chapterMindMap("ready", image = false),
                        MindMapShown.Ready,
                        null,
                        null,
                        CARD_ACTIONS,
                        rememberAppNavigator(),
                    )
                },
                "mind-map-viewer" to {
                    val map = chapterMindMap("ready")
                    MindMapViewer(ViewedMap(map.title, map.image!!, map.outline), onClose = {}, onSave = {})
                },
            )
    }
}
