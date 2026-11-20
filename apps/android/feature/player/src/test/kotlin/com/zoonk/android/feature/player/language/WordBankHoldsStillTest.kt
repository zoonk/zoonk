package com.zoonk.android.feature.player.language

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.Dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.summaryStep
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Main's word bank after Check: what the check adds (its feedback, or "fix it yourself") takes the room the bank leaves,
 * right above the bank on a phone and under it on a wide window, so neither the bank nor the answer above it moves.
 */
@RunWith(AndroidJUnit4::class)
class WordBankHoldsStillTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private fun top(node: () -> SemanticsNodeInteraction): Dp {
        rule.waitForIdle()
        return node().getBoundsInRoot().top
    }

    private fun bank() = rule.onNode(hasContentDescription("Word bank"))

    private fun assertHoldsStill(
        step: LessonStep,
        words: List<String>,
        correct: Boolean,
    ) {
        harness.play(listOf(step, summaryStep("end"))) { grade = { _, _ -> checkResult(isCorrect = correct) } }
        words.forEach(harness::tap)
        val bankTop = top(::bank)
        val answerTop = top { rule.onNodeWithText(words.first()) }

        harness.tap("Check")
        rule.waitUntil(5_000) { rule.onAllNodesWithText("Continue").fetchSemanticsNodes().isNotEmpty() || selfCorrect().isNotEmpty() }

        assertEquals(bankTop, top(::bank))
        assertEquals(answerTop, top { rule.onNodeWithText(words.first()) })
    }

    private fun selfCorrect() = rule.onAllNodesWithText("fix it yourself", substring = true).fetchSemanticsNodes()

    /** "Fix it yourself" is right above the bank in one narrow column (a phone, a book's page), under it on a wide one. */
    private fun assertLineSits(above: Boolean) {
        val line = selfCorrect().single().boundsInRoot
        val words = bank().getBoundsInRoot()
        with(rule.density) {
            if (above) assertTrue(line.bottom.toDp() <= words.top) else assertTrue(line.top.toDp() >= words.bottom)
        }
    }

    private fun translateRight() = assertHoldsStill(longReading("read"), LONG_SENTENCE, correct = true)

    private fun translateWrong(above: Boolean = true) {
        assertHoldsStill(longReading("read"), LONG_SENTENCE.take(2), correct = false)
        assertLineSits(above)
    }

    private fun fillInRight() = assertHoldsStill(fillBlank("blank"), listOf("pay"), correct = true)

    private fun fillInWrong(above: Boolean = true) {
        assertHoldsStill(fillBlank("blank"), listOf("rent"), correct = false)
        assertLineSits(above)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun aRightTranslationOnAPhone() = translateRight()

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun aWrongTranslationOnAPhone() = translateWrong()

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun aRightFillInOnAPhone() = fillInRight()

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun aWrongFillInOnAPhone() = fillInWrong()

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aRightTranslationOnATablet() = translateRight()

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aWrongTranslationOnATablet() = translateWrong()

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aRightFillInOnATablet() = fillInRight()

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aWrongFillInOnATablet() = fillInWrong()

    @Test
    @Config(qualifiers = "w800dp-h1280dp")
    fun aWrongTranslationOnATabletUpright() = translateWrong()

    @Test
    @Config(qualifiers = "w800dp-h1280dp")
    fun aRightFillInOnATabletUpright() = fillInRight()

    /** At twice the text size a 900dp window is too narrow for two pages, so it lays out wide in one column. */
    @Test
    @Config(qualifiers = "w900dp-h700dp-land")
    fun aWrongTranslationWideInOneColumn() {
        RuntimeEnvironment.setFontScale(2f)
        translateWrong(above = false)
    }

    @Test
    @Config(qualifiers = "w900dp-h700dp-land")
    fun aRightFillInWideInOneColumn() {
        RuntimeEnvironment.setFontScale(2f)
        fillInRight()
    }

    @Test
    @Config(qualifiers = "w900dp-h700dp-land")
    fun aWrongFillInWideInOneColumn() {
        RuntimeEnvironment.setFontScale(2f)
        fillInWrong(above = false)
    }
}
