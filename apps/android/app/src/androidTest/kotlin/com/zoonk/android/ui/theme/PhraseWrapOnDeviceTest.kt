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
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

/**
 * Japanese wraps between phrases only in a short control, so a button never splits a word; a sentence or a question
 * wraps between characters by the normal rules, whatever the app's language. Line breaks come from the device's ICU
 * data, which the JVM tests don't have.
 */
@RunWith(AndroidJUnit4::class)
class PhraseWrapOnDeviceTest {
    @get:Rule
    val compose = createComposeRule()

    private val deviceLocale = Locale.getDefault()

    @After
    fun restoreLocale() = Locale.setDefault(deviceLocale)

    @Test
    fun aJapaneseControlBreaksOnlyBetweenPhrases() {
        val ends = narrowestLineEnds(LABEL, Locale.JAPANESE) { MaterialTheme.typography.labelLarge }
        assertTrue("breaks only after まだ: $ends", ends.all { it == 2 || it == LABEL.length })
    }

    /** A question as the lesson, practice, mock exam and catalog set it. */
    @Test
    fun aJapaneseQuestionBreaksBetweenCharacters() {
        val ends = narrowestLineEnds(LABEL, Locale.JAPANESE) { MaterialTheme.typography.titleLarge }
        assertEquals("a line per character", (1..LABEL.length).toList(), ends)
    }

    /** Japanese inside an English-language lesson: only loose rules let a line start with 々, which the web never does. */
    @Test
    fun aJapaneseQuestionInAnEnglishAppNeverStartsALineWithARepeatMark() {
        val question = "日本の様々な地域で使われている言葉はどれですか？"
        val ends = narrowestLineEnds(question, Locale.ENGLISH) { MaterialTheme.zoonkType.question }
        assertTrue("様々 stays together: $ends", question.indexOf('々') !in ends)
    }

    /** The line ends of [text] at its narrowest width, on a phone and in an app set to [locale]. */
    private fun narrowestLineEnds(
        text: String,
        locale: Locale,
        style: @Composable () -> TextStyle,
    ): List<Int> {
        Locale.setDefault(locale)
        lateinit var layout: TextLayoutResult
        compose.setContent {
            val configuration = Configuration(LocalConfiguration.current).apply { setLocale(locale) }
            CompositionLocalProvider(LocalConfiguration provides configuration) {
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
