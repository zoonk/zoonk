package com.zoonk.android.feature.language

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.conversation.CallStart
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

/** Review screenshots of a language unit's page: `-Pzoonk.shots=<folder>`. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LanguageUnitScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder>", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = walk("phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDark() = walk("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        walk("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-mdpi")
    fun tablet() = walk("tablet")

    @Test
    @Config(qualifiers = "w851dp-h882dp-xhdpi")
    fun foldOpen() = walk("fold-open")

    private fun walk(
        name: String,
        dark: Boolean = false,
    ) {
        val actions = UnitActions(open = {}, start = { CallStart.Started(UUID.randomUUID()) })
        compose.setContent { ZoonkTheme(darkTheme = dark) { Surface { UnitPage(languageUnit(), upNext = true, actions = actions) } } }
        shot("unit-top-$name")
        listOf("Your mistakes", "Words in this unit", "Grammar tips", "Unit summary").forEach { row ->
            scrollTo(row)
            compose.onNodeWithText(row).performClick()
        }
        scrollTo("Unit summary")
        shot("unit-bottom-$name")
    }

    /** Beside the lessons, the aside scrolls on its own; on a phone the page is one list. */
    private fun scrollTo(text: String) {
        val lists = compose.onAllNodes(hasScrollAction()).fetchSemanticsNodes().size
        val list = if (lists == 1) hasScrollAction() else hasScrollAction() and hasAnyDescendant(hasText(text))
        compose.onNode(list).performScrollToNode(hasText(text))
    }

    private fun shot(name: String) {
        compose.waitForIdle()
        val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
