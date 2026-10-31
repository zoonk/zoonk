package com.zoonk.android.feature.stats

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review screenshots of every stats page, written only on demand: `--tests '*StatsScreenshots*' --rerun -Pzoonk.shots=<folder>`. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class StatsScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1800dp-xxhdpi")
    fun phone() = captureAll("stats-phone")

    @Test
    @Config(qualifiers = "w411dp-h1800dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = captureAll("stats-phone-dark-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h2600dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureAll("stats-phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h1200dp-xhdpi")
    fun tablet() = captureAll("stats-tablet")

    private fun captureAll(
        prefix: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        var shown by mutableIntStateOf(0)

        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface {
                    val context = LocalContext.current
                    val app = remember { AppContainer.preview(context) }
                    val session = remember { FakeSession(AuthenticatedSession("account", "token", "local")) }
                    val stats =
                        remember {
                            StatsStore(
                                FakeStatsApi(studied = true),
                                AppCache(
                                    session,
                                    CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
                                ),
                            )
                        }
                    StatsScreen(StatsPage.entries[shown], app, rememberAppNavigator(), stats)
                }
            }
        }

        StatsPage.entries.forEachIndexed { index, page ->
            shown = index
            compose.waitForIdle()
            val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
            val file = File(folder, "$prefix-${page.name.lowercase()}.png").apply { parentFile?.mkdirs() }
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }
}
