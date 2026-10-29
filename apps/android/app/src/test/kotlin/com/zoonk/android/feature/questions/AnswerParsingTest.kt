package com.zoonk.android.feature.questions

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.format.formatMathAnswer
import com.zoonk.android.ui.format.parseLocalizedNumber
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

/** The cases are main's `localized-number` and `numeric-entry` tests. */
@RunWith(AndroidJUnit4::class)
class AnswerParsingTest {
    private val en = Locale.ENGLISH
    private val pt = Locale.forLanguageTag("pt")
    private val fr = Locale.FRENCH

    @Test
    fun readsADecimalPointOrCommaInAnyLanguage() {
        assertEquals(3.5, parseLocalizedNumber("3.5", en))
        assertEquals(3.5, parseLocalizedNumber("3,5", en))
        assertEquals(3.5, parseLocalizedNumber("3,5", pt))
        assertEquals(0.25, parseLocalizedNumber("0.25", pt))
        assertEquals(3.0, parseLocalizedNumber("3,", en))
    }

    @Test
    fun readsThousandsGroupedTheLanguagesWay() {
        assertEquals(1000.0, parseLocalizedNumber("1,000", en))
        assertEquals(1000.0, parseLocalizedNumber("1.000", pt))
        assertEquals(3869.68, parseLocalizedNumber("3,869.68", en))
        assertEquals(3869.68, parseLocalizedNumber("3.869,68", pt))
    }

    @Test
    fun acceptsSignsTheTypographicMinusAndSpaces() {
        assertEquals(-3.0, parseLocalizedNumber(" -3 ", en))
        assertEquals(-3.0, parseLocalizedNumber("−3", en))
        assertEquals(1000.5, parseLocalizedNumber("1 000,5", fr))
    }

    @Test
    fun rejectsAnythingThatIsntOnePlainNumber() {
        listOf("", "3.5.1", "12 kg", "1e5").forEach { assertNull(it, parseLocalizedNumber(it, en)) }
    }

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
