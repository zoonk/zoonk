package com.zoonk.android.feature.activities

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale

@RunWith(AndroidJUnit4::class)
class GuessAmountsTest {
    @Test
    fun freeTextUnitsNeverHaveToAgreeWithTheGuess() {
        assertEquals("1", formatGuessAmount(1.0, Locale.ENGLISH, "days"))
        assertEquals("2", formatGuessAmount(2.0, Locale.ENGLISH, "days"))
        assertEquals("25", formatGuessAmount(25.0, Locale.ENGLISH, "°C"))
        assertEquals("1K", formatGuessAmount(1000.0, Locale.ENGLISH, "days", compact = true))
    }

    @Test
    fun moneyKeepsItsCurrencyOnEveryNumber() {
        assertEquals("$1", formatGuessAmount(1.0, Locale.ENGLISH, "$"))
        assertEquals("$1 per day", formatGuessAmount(1.0, Locale.ENGLISH, "$ per day"))
        assertEquals("$1K", formatGuessAmount(1000.0, Locale.ENGLISH, "$", compact = true))
    }
}
