package com.zoonk.android.feature.search

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.rememberAppNavigator
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

/** Review screenshots of search, written only on demand: `--tests '*SearchScreenshots*' --rerun -Pzoonk.shots=<folder>`. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class SearchScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("search-phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("search-phone-font200")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun overAPageAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        lateinit var search: AppSearch
        compose.setContent {
            ZoonkTheme {
                Surface {
                    val context = LocalContext.current
                    val app = remember { AppContainer.preview(context) }
                    SearchHost(app, rememberAppNavigator(), signedIn = true) { search = checkNotNull(LocalAppSearch.current) }
                }
            }
        }
        compose.runOnIdle { search.open() }
        write("search-over-page-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-xhdpi")
    fun tablet() = capture("search-tablet")

    private fun capture(name: String) {
        compose.setContent {
            ZoonkTheme {
                Surface {
                    val context = LocalContext.current
                    val app = remember { AppContainer.preview(context) }
                    Column { TabSearchBar(app, rememberAppNavigator()) }
                }
            }
        }
        write("$name-closed")
        compose.onNodeWithText("Search or ask…").performClick()
        write("$name-open")
        compose.onAllNodes(hasSetTextAction()).onLast().performTextInput("set")
        compose.mainClock.advanceTimeBy(500)
        write("$name-query")
    }

    private fun write(name: String) {
        compose.waitForIdle()
        val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
