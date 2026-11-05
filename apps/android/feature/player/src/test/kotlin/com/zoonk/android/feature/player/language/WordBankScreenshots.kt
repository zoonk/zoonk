package com.zoonk.android.feature.player.language

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.summaryStep
import com.zoonk.android.ui.testing.captureRender
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review screenshots of word banks as the answer grows, one per word placed, written only on demand:
 * `./gradlew :feature:player:testDebugUnitTest --tests '*WordBankScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class WordBankScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val tempFolder = TemporaryFolder()

    private val folder = System.getProperty("zoonk.shots").orEmpty()
    private val harness = LessonPlayerHarness(rule) { tempFolder.newFolder() }

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private fun capture(name: String) {
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureRender().asAndroidBitmap()
        File(folder, "$name.png").apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun build(
        name: String,
        step: LessonStep = longReading("read"),
        words: List<String> = LONG_SENTENCE,
        layoutDirection: LayoutDirection? = null,
    ) {
        harness.play(listOf(step, summaryStep("end")), layoutDirection = layoutDirection)
        capture("$name-0")
        words.forEachIndexed { index, word ->
            harness.tap(word)
            capture("$name-${index + 1}")
        }
        harness.tap("Check")
        capture("$name-checked")
    }

    @Test
    @Config(qualifiers = "w360dp-h800dp-xxhdpi")
    fun smallPhone() = build("reading-small-phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = build("reading-phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDark() = build("reading-phone-dark")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneRightToLeft() = build("reading-phone-rtl", layoutDirection = LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        build("reading-phone-font200")
    }

    @Test
    @Config(qualifiers = "w700dp-h1000dp-xhdpi")
    fun medium() = build("reading-medium")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun expanded() = build("reading-expanded")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneFillBlank() = build("fill-blank-phone", fillBlank("blank"), listOf("pay"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneFillBlankDark() = build("fill-blank-phone-dark", fillBlank("blank"), listOf("pay"))
}
