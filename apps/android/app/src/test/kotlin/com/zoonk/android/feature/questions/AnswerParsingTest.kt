package com.zoonk.android.feature.questions

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.format.formatMathAnswer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

/** The cases are main's `numeric-entry` and `math-answer` tests. */
@RunWith(AndroidJUnit4::class)
class AnswerParsingTest {
    private val en = Locale.ENGLISH
    private val pt = Locale.forLanguageTag("pt")

    @Test
    fun aFractionBoxTakesAFractionAndAWholeNumberBoxNoDecimals() {
        val fraction = NumericEntry(NumericEntry.Kind.Fraction)
        val integer = NumericEntry(NumericEntry.Kind.Integer)

        assertEquals(2.0 / 3, parseEntryAnswer(fraction, "2/3", en)!!, 1e-9)
        assertEquals(-0.375, parseEntryAnswer(fraction, " -1,5 / 4 ", pt))
        assertEquals(0.667, parseEntryAnswer(fraction, ".667", en))
        assertNull(parseEntryAnswer(null, "2/3", en))
        assertNull(parseEntryAnswer(fraction, "2/0", en))
        assertNull(parseEntryAnswer(fraction, "1/2/3", en))
        assertEquals(12.0, parseEntryAnswer(integer, "12", en))
        assertNull(parseEntryAnswer(integer, "12,5", pt))
        assertEquals(2.5, parseEntryAnswer(null, "2,5", pt))
    }

    @Test
    fun rightAnswersReadAsMainWritesThem() {
        val plain = { text: String -> text.replace(Regex("[\\u00A0\\u202F]"), " ") }

        assertEquals(listOf("2.5", "0.004 m", "12%", "1,234.57 km", "R$3.50", "7°"), mathAnswers(en).map(plain))
        assertEquals(listOf("2,5", "0,004 m", "12%", "1.234,57 km", "R$ 3,50", "7°"), mathAnswers(pt).map(plain))
    }

    private fun mathAnswers(locale: Locale) =
        listOf(2.5 to null, 0.004 to "m", 12.0 to "%", 1234.567 to "km", 3.5 to "R$", 7.0 to "°").map { (value, unit) ->
            formatMathAnswer(value, locale, unit)
        }
}
