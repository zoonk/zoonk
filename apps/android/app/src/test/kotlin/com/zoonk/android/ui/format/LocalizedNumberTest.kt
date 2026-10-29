package com.zoonk.android.ui.format

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Locale

class LocalizedNumberTest {
    private val english = Locale.forLanguageTag("en")
    private val portuguese = Locale.forLanguageTag("pt-BR")

    @Test
    fun aLoneSeparatorIsADecimalPointUnlessItGroupsThousandsTheLocalesWay() {
        assertEquals(1.5, parseLocalizedNumber("1,5", portuguese))
        assertEquals(1.5, parseLocalizedNumber("1.5", portuguese))
        assertEquals(1000.0, parseLocalizedNumber("1.000", portuguese))
        assertEquals(1000.0, parseLocalizedNumber("1,000", english))
        assertEquals(1.5, parseLocalizedNumber("1,5", english))
    }

    @Test
    fun bothSeparatorsFollowTheLocaleAndSignsAndSpacesAreRead() {
        assertEquals(1234.5, parseLocalizedNumber("1.234,5", portuguese))
        assertEquals(1234.5, parseLocalizedNumber("1,234.5", english))
        assertEquals(-2.5, parseLocalizedNumber("−2,5", portuguese))
        assertEquals(12000.0, parseLocalizedNumber("12 000", english))
    }

    @Test
    fun anythingElseIsNotANumber() {
        assertNull(parseLocalizedNumber("", english))
        assertNull(parseLocalizedNumber("12a", english))
        assertNull(parseLocalizedNumber("1.2.3", english))
    }

    @Test
    fun aWrongAnswerKeepsADigitBeyondItsDifference() {
        assertEquals(2, exactFractionDigitsFor(expected = 20.0, allowed = 0.5))
        assertEquals(3, exactFractionDigitsFor(expected = 20.0, allowed = 0.005, value = 20.01))
    }
}
