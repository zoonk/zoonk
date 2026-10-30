package com.zoonk.android.feature.activities

import org.junit.Assert.assertEquals
import org.junit.Test

class JavaScriptNumberTest {
    @Test
    fun writesPlainNumbersAsJavaScriptsStringDoes() {
        assertEquals(
            listOf("7", "2.5", "-3", "0", "0.5", "12345678.5", "0.30000000000000004", "123456789012", "0.000001", "0.1", "4.35"),
            listOf(7.0, 2.5, -3.0, -0.0, 0.5, 12345678.5, 0.1 + 0.2, 123456789012.0, 1e-6, 0.1, 4.35).map(::jsNumberText),
        )
        assertEquals(
            listOf("0.3333333333333333", "0.6666666666666666", "9007199254740992", "1.2345678901234566e-7"),
            listOf(1.0 / 3, 2.0 / 3, 9007199254740993.0, 1.2345678901234566e-7).map(::jsNumberText),
        )
    }

    @Test
    fun writesLargeAndSmallNumbersInJavaScriptsExponentForm() {
        assertEquals(
            listOf("1e-7", "1.0000000000000001e-7", "-3.0000000000000004e-7", "9.5367431640625e-7", "1.23e-18", "5e-324"),
            listOf(1e-7, 1e-4 * 1e-3, -2e-4 * 1.5e-3, 9.5367431640625e-7, 123e-20, Double.MIN_VALUE).map(::jsNumberText),
        )
        assertEquals(
            listOf("1e+21", "1e+23", "-7.5e+22", "1.1805916207174113e+21", "4.8726570057e+288", "1.7976931348623157e+308"),
            listOf(1e11 * 1e10, 1e23, -3e11 * 2.5e11, 1180591620717411303424.0, 4.8726570057e288, Double.MAX_VALUE).map(::jsNumberText),
        )
        assertEquals(listOf("Infinity", "-Infinity", "NaN"), listOf(1e200 * 1e200, -1e200 * 1e200, Double.NaN).map(::jsNumberText))
    }

    @Test
    fun writesTheShortestDigitsWhereOlderRuntimesWriteMore() {
        assertEquals(
            listOf("1152921504606847000", "-1152921504606847000", "9223372036854776000"),
            listOf(1073741824.0 * 1073741824.0, -1152921504606846976.0, 9223372036854775807.0).map(::jsNumberText),
        )
    }
}
