package com.zoonk.android.feature.settings

import androidx.activity.ComponentActivity
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.AppShell
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
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

/** Review screenshots of the settings hub beside one of its pages, written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class SettingsScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    /** Reminders open beside the hub, so its row is the highlighted one between two others. */
    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletWithAPageOpen() {
        lateinit var navigator: AppNavigator
        compose.setContent {
            val context = LocalContext.current
            val app = remember { AppContainer.preview(context) }
            navigator = rememberAppNavigator()
            val entries =
                remember(navigator) { entryProvider<NavKey>(fallback = { key -> NavEntry(key) {} }) { settingsEntries(app, navigator) } }
            ZoonkTheme { AppShell(navigator, entries, onSendFeedback = {}) }
        }
        compose.runOnIdle { navigator.open(AppRoute.Settings) }
        compose.runOnIdle { navigator.openSettingsPage(AppRoute.Reminders) }
        compose.waitForIdle()
        val file = File(folder, "settings-reminders-open-tablet.png").apply { parentFile?.mkdirs() }
        writeRender(file, compose.onRoot().captureRender().asAndroidBitmap())
    }
}
