package com.zoonk.android.feature.essay

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.LayoutDirection
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
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
 * Review screenshots of the essay, written only on demand:
 * `./gradlew :feature:exam:testDebugUnitTest --tests '*EssayScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class EssayScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule(order = 2)
    val drafts = TemporaryFolder()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private fun show(
        name: String,
        drafted: Boolean = false,
        tooShort: Boolean = false,
        text: String = "",
        grading: Boolean = false,
        rewrite: Boolean = false,
        secondStep: Boolean = false,
        status: String = "active",
        refusal: String? = null,
        withTexts: Boolean = true,
        fold: Boolean = false,
        dark: Boolean = false,
        direction: LayoutDirection = LayoutDirection.Ltr,
    ) {
        val read = essay(drafted, tooShort, status, withTexts)
        val viewModel = essayViewModel(read, drafts.root, refusal)
        rule.waitForIdle()
        if (rewrite) viewModel.rewrite()
        if (text.isNotEmpty()) viewModel.write(text)
        if (grading || refusal != null) viewModel.send()

        rule.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = dark) {
                CompositionLocalProvider(LocalLayoutDirection provides direction) {
                    val ui by viewModel.ui.collectAsStateWithLifecycle()
                    val navigator = rememberAppNavigator()
                    val grade = ui.grade
                    if (ui.closed && grade == null) {
                        SkippedEssay(read, navigator)
                    } else if ((ui.mode == EssayMode.Grade || ui.closed) && grade != null) {
                        EssayGradeSteps(
                            read,
                            grade,
                            finished = false,
                            closed = ui.closed,
                            announce = false,
                            finishing = false,
                            finishFailures = 0,
                            viewModel,
                            navigator,
                        )
                    } else {
                        EssayWrite(read, ui, finishing = false, finishFailures = 0, viewModel, navigator)
                    }
                }
            }
        }
        rule.mainClock.advanceTimeBy(1_000)
        if (secondStep) rule.onNodeWithText("Continue").performClick()
        if (fold) rule.unfoldBook(folds)
        write(name)
    }

    private fun write(name: String) {
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureRender().asAndroidBitmap()
        File(folder, "$name.png").apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneWrite() = show("phone-write", text = "A mobilidade urbana é um dos maiores desafios das cidades brasileiras.")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneGrading() = show("phone-grading", text = "A mobilidade urbana é um desafio.", grading = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneSignUpRequired() = show("phone-sign-up-required", text = "A mobilidade urbana é um desafio.", refusal = "SIGN_UP_REQUIRED")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletWrite() = show("tablet-write", text = "A mobilidade urbana é um dos maiores desafios das cidades brasileiras.")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneGrade() = show("phone-grade", drafted = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneNextStep() = show("phone-next-step", drafted = true, secondStep = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneNextStepLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        show("phone-next-step-font200", drafted = true, secondStep = true)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletGrade() = show("tablet-grade", drafted = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneClosedNextStep() = show("phone-closed-next-step", drafted = true, secondStep = true, status = "completed")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneSkipped() = show("phone-skipped", status = "skipped")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneClosedTooShort() = show("phone-closed-too-short", drafted = true, tooShort = true, status = "completed")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneRewrite() = show("phone-rewrite", drafted = true, rewrite = true)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletRewrite() = show("tablet-rewrite", drafted = true, rewrite = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneTooShort() = show("phone-too-short", drafted = true, tooShort = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneRewriteTooShort() = show("phone-rewrite-too-short", drafted = true, tooShort = true, rewrite = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookWrite() = show("essay-book-write", text = "A mobilidade urbana é um desafio.", withTexts = false, fold = true)

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun smallBookWrite() = show("essay-small-book-write", text = "A mobilidade urbana é um desafio.", withTexts = false, fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookWriteWithTexts() = show("essay-book-write-texts", text = "A mobilidade urbana é um desafio.", fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookRewrite() = show("essay-book-rewrite", drafted = true, rewrite = true, withTexts = false, fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookGrade() = show("essay-book-grade", drafted = true, fold = true)

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun smallBookGrade() = show("essay-small-book-grade", drafted = true, fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookNextStep() = show("essay-book-next-step", drafted = true, secondStep = true, fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookTooShort() = show("essay-book-too-short", drafted = true, tooShort = true, fold = true)

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun smallBookTooShort() = show("essay-small-book-too-short", drafted = true, tooShort = true, fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookSkipped() = show("essay-book-skipped", status = "skipped", fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-night-xhdpi")
    fun bookSkippedDarkMoreContrast() = show("essay-book-skipped-dark-more-contrast", status = "skipped", fold = true, dark = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookSkippedAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        show("essay-book-skipped-font200", status = "skipped", fold = true)
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookSkippedRightToLeft() = show("essay-book-skipped-rtl", status = "skipped", fold = true, direction = LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletSkipped() = show("essay-tablet-skipped", status = "skipped")

    @Test
    @Config(qualifiers = "w852dp-h883dp-night-xhdpi")
    fun bookWriteDarkMoreContrast() =
        show("essay-book-write-dark-more-contrast", text = "A mobilidade urbana é um desafio.", withTexts = false, fold = true, dark = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookRewriteAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        show("essay-book-rewrite-font200", drafted = true, rewrite = true, fold = true)
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookWriteRightToLeft() =
        show("essay-book-write-texts-rtl", text = "A mobilidade urbana é um desafio.", fold = true, direction = LayoutDirection.Rtl)

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun smallBookWriteWithTexts() = show("essay-small-book-write-texts", text = "A mobilidade urbana é um desafio.", fold = true)

    @Test
    @Config(qualifiers = "w700dp-h840dp-xhdpi")
    fun mediumWrite() = show("essay-medium-write", text = "A mobilidade urbana é um desafio.")

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookClosedTooShort() = show("essay-book-closed-too-short", drafted = true, tooShort = true, status = "completed", fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookClosedGrade() = show("essay-book-closed-grade", drafted = true, status = "completed", fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookGradeAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        show("essay-book-grade-font200", drafted = true, fold = true)
    }
}
