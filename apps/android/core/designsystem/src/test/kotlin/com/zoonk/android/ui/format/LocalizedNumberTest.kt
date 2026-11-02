package com.zoonk.android.ui.format

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Locale

class LocalizedNumberTest {
    private val english = Locale.forLanguageTag("en")
    private val portuguese = Locale.forLanguageTag("pt-BR")
    private val german = Locale.forLanguageTag("de")
    private val french = Locale.forLanguageTag("fr")

    @Test
    fun aDecimalPointOrCommaReadsInAnyLanguage() {
        assertEquals(3.5, parseLocalizedNumber("3.5", english))
        assertEquals(3.5, parseLocalizedNumber("3,5", english))
        assertEquals(3.5, parseLocalizedNumber("3,5", portuguese))
        assertEquals(12.5, parseLocalizedNumber("12,5", portuguese))
        assertEquals(2.5, parseLocalizedNumber("2,5", german))
        assertEquals(0.25, parseLocalizedNumber("0.25", portuguese))
        assertEquals(3.0, parseLocalizedNumber("3,", english))
    }

    @Test
    fun thousandsGroupedTheLocalesWayRead() {
        assertEquals(1000.0, parseLocalizedNumber("1,000", english))
        assertEquals(12_000.0, parseLocalizedNumber("12,000", english))
        assertEquals(1_234_567.0, parseLocalizedNumber("1,234,567", english))
        assertEquals(1000.0, parseLocalizedNumber("1.000", portuguese))
        assertEquals(12_000.0, parseLocalizedNumber("12.000", portuguese))
        assertEquals(3869.68, parseLocalizedNumber("3,869.68", english))
        assertEquals(3869.68, parseLocalizedNumber("3.869,68", portuguese))
    }

    @Test
    fun theLastMarkIsTheDecimalPointWhenBothAppearInAnyLanguage() {
        assertEquals(1234.5, parseLocalizedNumber("1.234,5", english))
        assertEquals(1234.5, parseLocalizedNumber("1,234.5", portuguese))
        assertEquals(1234.5, parseLocalizedNumber("1.234,5", german))
        assertEquals(1234.5, parseLocalizedNumber("1,234.5", german))
    }

    @Test
    fun aNumberStartingWithZeroIsNeverGrouped() {
        assertEquals(0.125, parseLocalizedNumber("0,125", english))
        assertEquals(-0.125, parseLocalizedNumber("-0,125", english))
        assertEquals(0.125, parseLocalizedNumber("0.125", portuguese))
        assertEquals(0.125, parseLocalizedNumber("0,125", german))
    }

    @Test
    fun signsTheTypographicMinusAndSpacesRead() {
        assertEquals(-3.0, parseLocalizedNumber(" -3 ", english))
        assertEquals(-3.0, parseLocalizedNumber("\u22123", english))
        assertEquals(1000.5, parseLocalizedNumber("1\u202F000,5", french))
    }

    @Test
    fun anythingThatIsNotOnePlainNumberIsNull() {
        assertNull(parseLocalizedNumber("", english))
        assertNull(parseLocalizedNumber("3.5.1", english))
        assertNull(parseLocalizedNumber("1.234,5,6", english))
        assertNull(parseLocalizedNumber("12 kg", english))
        assertNull(parseLocalizedNumber("1e5", english))
    }

    @Test
    fun aWrongAnswerKeepsADigitBeyondItsDifference() {
        assertEquals(2, exactFractionDigitsFor(expected = 20.0, allowed = 0.5))
        assertEquals(3, exactFractionDigitsFor(expected = 20.0, allowed = 0.005, value = 20.01))
    }
}
