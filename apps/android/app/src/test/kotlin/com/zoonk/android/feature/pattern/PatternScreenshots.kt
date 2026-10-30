package com.zoonk.android.feature.pattern

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MistakePattern
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
 * Review screenshots of a mistake pattern, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*PatternScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PatternScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private fun show(
        name: String,
        kind: MistakePattern.Kind = MistakePattern.Kind.PATTERN,
        dark: Boolean = false,
        sheet: Boolean = false,
        play: () -> Unit = {},
    ) {
        val viewModel = patternViewModel()
        viewModel.begin(pattern(kind))

        rule.setContent {
            ZoonkTheme(darkTheme = dark) {
                val drill by viewModel.state.collectAsStateWithLifecycle()
                drill?.let { PatternContent(it, viewModel, AppContainer.preview(rule.activity)) }
            }
        }
        play()
        rule.waitForIdle()
        val root = if (sheet) rule.onNode(isDialog()) else rule.onRoot()
        val bitmap = root.captureToImage().asAndroidBitmap()
        File(
            folder,
            "pattern-$name.png",
        ).apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun start() = rule.onNodeWithText("Practice this", substring = true).performClick()

    private fun answer(option: String) {
        rule.onNodeWithText(option).performClick()
        rule.onNodeWithText("Check").performClick()
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneIntro() = show("intro-phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneIntroDark() = show("intro-phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h2400dp-xhdpi")
    fun phoneIntroAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        show("intro-phone-font200")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneQuestion() = show("question-phone") { start() }

    @Test
    @Config(qualifiers = "w411dp-h2400dp-xhdpi")
    fun phoneQuestionAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        show("question-phone-font200") { start() }
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneWrongAnswer() =
        show("wrong-phone") {
            start()
            answer("am agree")
        }

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneRightAnswerDark() =
        show("right-phone-dark", dark = true) {
            start()
            answer("agree")
        }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneRuleSheet() =
        show("rule-sheet-phone", sheet = true) {
            start()
            rule.onNodeWithText("See the rule").performClick()
        }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletQuestion() =
        show("question-tablet") {
            start()
            answer("agree")
        }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneResult() =
        show("result-phone") {
            start()
            answer("agree")
            rule.onNodeWithText("Continue").performClick()
            answer("are agree")
            rule.onNodeWithText("See how you did").performClick()
        }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneTypos() = show("typos-phone", kind = MistakePattern.Kind.TYPOS)
}
