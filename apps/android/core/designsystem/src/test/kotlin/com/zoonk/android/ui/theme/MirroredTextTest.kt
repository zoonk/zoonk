package com.zoonk.android.ui.theme

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** A mirrored layout starts every paragraph on its right, while Latin words and signed numbers read as they're written. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w900dp-h1600dp-mdpi")
class MirroredTextTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aPortugueseParagraphStartsOnTheRightAndKeepsItsWordOrder() {
        val sentence = "O fio condutor da minha experiência é melhorar processos com dados todos os dias."
        val layout = mirrored(sentence)

        assertTrue("wraps: ${layout.lineCount}", layout.lineCount > 1)
        for (line in 0 until layout.lineCount) {
            assertEquals("line $line ends on the right", WIDTH_PX, layout.getLineRight(line), 1f)
        }
        val words = listOf("O", "fio", "condutor", "da")
        val lefts = words.map { layout.getBoundingBox(sentence.indexOf("$it ")).left }
        assertEquals("words in order: $lefts", lefts.sorted(), lefts)
        val stop = layout.getBoundingBox(sentence.lastIndex)
        val lastLine = layout.lineCount - 1
        assertTrue("the full stop ends the sentence: $stop", stop.right >= layout.getLineRight(lastLine) - 1f)
    }

    @Test
    fun aSignedNumberKeepsItsSignBeforeItsDigits() {
        val number = "+50 · −3 · <1%"
        val layout = mirrored(number, fill = false)
        for (sign in listOf("+", "−", "<")) {
            val at = number.indexOf(sign)
            val signBox = layout.getBoundingBox(at)
            val digit = layout.getBoundingBox(at + 1)
            assertTrue("$sign: sign at ${signBox.left}, digit at ${digit.left}", signBox.left < digit.left)
        }
    }

    private fun mirrored(
        text: String,
        fill: Boolean = true,
    ): TextLayoutResult {
        var result: TextLayoutResult? = null
        // As an app in a right-to-left language gets its direction: from the window, around the theme.
        compose.setContent {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                ZoonkTheme {
                    Box(Modifier.width(WIDTH)) {
                        Text(text, modifier = if (fill) Modifier.fillMaxWidth() else Modifier, onTextLayout = { result = it })
                    }
                }
            }
        }
        compose.waitForIdle()
        return checkNotNull(result)
    }

    private companion object {
        val WIDTH = 240.dp
        const val WIDTH_PX = 240f
    }
}
