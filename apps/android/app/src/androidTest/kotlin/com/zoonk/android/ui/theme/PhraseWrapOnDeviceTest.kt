package com.zoonk.android.ui.theme

import android.content.res.Configuration
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

/**
 * A Japanese label wraps between phrases, so its narrowest width is its longest phrase, never one character; a paragraph
 * still wraps between characters. Phrase breaks come from the device's ICU data, which the JVM tests don't have.
 */
@RunWith(AndroidJUnit4::class)
class PhraseWrapOnDeviceTest {
    @get:Rule
    val compose = createComposeRule()

    private val deviceLocale = Locale.getDefault()

    /** A Japanese phone's own language, which text without a locale of its own is broken by. */
    @Before
    fun speakJapanese() = Locale.setDefault(Locale.JAPANESE)

    @After
    fun restoreLocale() = Locale.setDefault(deviceLocale)

    @Test
    fun aJapaneseLabelAtItsNarrowestBreaksOnlyBetweenPhrases() {
        val ends = narrowestLineEnds { MaterialTheme.typography.labelLarge }
        assertTrue("breaks only after まだ: $ends", ends.all { it == 2 || it == LABEL.length })
    }

    /** A paragraph wraps between characters, as Japanese body text does on the web and in Android's own text past a few lines. */
    @Test
    fun aJapaneseParagraphStillBreaksBetweenCharacters() {
        val ends = narrowestLineEnds { MaterialTheme.typography.bodyLarge }
        assertEquals("a line per character", (1..LABEL.length).toList(), ends)
    }

    /** A question is a paragraph too, though its lines are balanced like a title's. */
    @Test
    fun aJapaneseQuestionStillBreaksBetweenCharacters() {
        val ends = narrowestLineEnds { MaterialTheme.zoonkType.question }
        assertEquals("a line per character", (1..LABEL.length).toList(), ends)
    }

    /** Only Japanese's loosest rules let a line start with a mark that belongs to the character before it, which the web never does. */
    @Test
    fun aJapaneseQuestionNeverStartsALineWithARepeatMark() {
        val question = "日本の様々な地域で使われている言葉はどれですか？"
        val ends = narrowestLineEnds(question) { MaterialTheme.zoonkType.question }
        assertTrue("様々 stays together: $ends", question.indexOf('々') !in ends)
    }

    private fun narrowestLineEnds(
        text: String = LABEL,
        style: @Composable () -> TextStyle,
    ): List<Int> {
        lateinit var layout: TextLayoutResult
        compose.setContent {
            val japanese = Configuration(LocalConfiguration.current).apply { setLocale(Locale.JAPANESE) }
            CompositionLocalProvider(LocalConfiguration provides japanese) {
                ZoonkTheme {
                    Box(Modifier.width(IntrinsicSize.Min)) {
                        Text(text, style = style(), onTextLayout = { layout = it })
                    }
                }
            }
        }
        compose.waitForIdle()
        return (0 until layout.lineCount).map { layout.getLineEnd(it) }
    }

    private companion object {
        const val LABEL = "まだわからない"
    }
}
