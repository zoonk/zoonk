package com.zoonk.android.feature.plan

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.isRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
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

/** Review screenshots of the Plan, written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PlanScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1900dp-xxhdpi")
    fun phone() = capture("plan-phone")

    @Test
    @Config(qualifiers = "w411dp-h1900dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("plan-phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h3200dp-xhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("plan-phone-font200")
    }

    @Test
    @Config(qualifiers = "w700dp-h1600dp-xhdpi")
    fun medium() = capture("plan-medium")

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-xhdpi")
    fun expanded() = capture("plan-expanded")

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-night-xhdpi")
    fun expandedDark() = capture("plan-expanded-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phonePaceSheet() {
        show()
        compose.onNodeWithText("Pace").performClick()
        captureTopWindow("plan-sheet-pace")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneProgressSheet() {
        show()
        compose.onNodeWithText("Progress").performClick()
        captureTopWindow("plan-sheet-progress")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneMenu() {
        show()
        compose.onNodeWithContentDescription("Plan options").performClick()
        captureTopWindow("plan-menu")
    }

    @Test
    @Config(qualifiers = "w1280dp-h900dp-land-xhdpi")
    fun expandedPhaseDetails() {
        show()
        compose.onNodeWithContentDescription("Data structures, you are here").performClick()
        captureTopWindow("plan-sheet-phase-details")
    }

    private fun captureTopWindow(name: String) {
        compose.waitForIdle()
        write(
            name,
            compose
                .onAllNodes(isRoot())
                .onLast()
                .captureToImage()
                .asAndroidBitmap(),
        )
    }

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        show(dark, moreContrast)
        compose.waitForIdle()
        write(name, compose.onRoot().captureToImage().asAndroidBitmap())
    }

    private fun show(
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val page = PlanPageState(learnerSummary().goals.first(), learnPlan(), learnerSummary())
        compose.setContent {
            val navigator = rememberAppNavigator()
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface {
                    PlanContent(
                        page = page,
                        standing = Standing.Progress(progress(), done = 13, total = 46),
                        links = PlanLinks(navigator, page),
                        resumeChangesPlan = false,
                        isSaving = false,
                        onSetStatus = {},
                    )
                }
            }
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
