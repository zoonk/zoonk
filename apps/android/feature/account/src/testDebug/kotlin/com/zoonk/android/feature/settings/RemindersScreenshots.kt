package com.zoonk.android.feature.settings

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performFirstLinkClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * The Reminders page's line, whose "study days" opens the Plan. Its review screenshots are written only on demand:
 * `--tests '*RemindersScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class RemindersScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Test
    fun studyDaysOpensThePlan() {
        lateinit var navigator: AppNavigator
        show { navigator = it }

        compose.onNodeWithText("study days", substring = true).performFirstLinkClick()
        compose.waitForIdle()

        assertEquals(AppTab.Plan, navigator.selectedTab)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("reminders-phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDark() = capture("reminders-phone-dark")

    @Test
    @Config(qualifiers = "de-w360dp-h800dp-xxhdpi")
    fun smallPhoneGerman() = capture("reminders-small-phone-de")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletLandscape() = capture("reminders-tablet-land")

    private fun show(onNavigator: (AppNavigator) -> Unit = {}) {
        compose.setContent {
            val context = LocalContext.current
            val app = remember { AppContainer.preview(context) }
            val navigator = rememberAppNavigator()
            onNavigator(navigator)
            ZoonkTheme { RemindersScreen(app, navigator) }
        }
        compose.waitForIdle()
    }

    private fun capture(name: String) {
        assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())
        show()
        val bitmap = compose.onRoot().captureRender().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
