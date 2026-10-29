package com.zoonk.android.ui.format

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import java.time.LocalDate
import java.time.LocalTime
import java.util.Locale

/**
 * Expected values are what main's formatters write for the same input, except the narrow no-break
 * space ICU puts before "PM", which V8 swaps for a plain space.
 */
@RunWith(AndroidJUnit4::class)
class FormattersTest {
    private val en = Locale.ENGLISH
    private val pt = Locale.forLanguageTag("pt")
    private val es = Locale.forLanguageTag("es")
    private val fr = Locale.FRENCH
    private val de = Locale.GERMAN

    @Test
    fun durationRoundsToSecondsMinutesThenHoursAndMinutes() {
        val cases =
            mapOf(
                0L to "0 min",
                45L to "45 sec",
                89L to "1 min",
                90L to "2 min",
                720L to "12 min",
                3_599L to "1 hr",
                5_400L to "1 hr 30 min",
                7_200L to "2 hr",
            )

        cases.forEach { (seconds, expected) -> assertEquals(expected, formatDuration(seconds, en)) }
        assertEquals("0 min", formatDuration(-5, en))
    }

    @Test
    fun durationReadsAsMainWritesItInEveryLanguage() {
        assertEquals("45 s", formatDuration(45, pt))
        assertEquals("1 h 30 min", formatDuration(5_400, pt))
        assertEquals("1 h 30 min", formatDuration(5_400, es))
        assertEquals("1 h 30 min", formatDuration(5_400, fr))
        assertEquals("45 s", formatDuration(45, fr))
        assertEquals("1 Std. 30 Min.", formatDuration(5_400, de))
        assertEquals("45 Sek.", formatDuration(45, de))
        assertEquals("45 min", formatMinutes(45, en))
    }

    @Test
    fun numbersFollowTheLanguageAndRoundHalfAwayFromZero() {
        assertEquals("1,234.5", formatNumber(1_234.5, en))
        assertEquals("1.234,5", formatNumber(1_234.5, de))
        assertEquals("1.234,5", formatNumber(1_234.5, pt))
        assertEquals("1.234,5", formatNumber(1_234.5, es))
        assertEquals("1 234,5", formatNumber(1_234.5, fr))
        assertEquals("0.13", formatNumber(0.125, en))
        assertEquals("1960", formatNumber(1_960.0, en, grouping = false))
    }

    @Test
    fun signsUseAPlusAndATypographicMinus() {
        assertEquals("−3", formatNumber(-3.0, en))
        assertEquals("+50", formatNumber(50.0, en, signed = true))
        assertEquals("0", formatNumber(-0.001, en, signed = true))
        assertEquals("0", formatNumber(0.0, en, signed = true))
    }

    @Test
    fun sharesAreWholePercentagesHonestAtTheirEnds() {
        assertEquals("46%", formatPercent(0.456, en))
        assertEquals("13%", formatPercent(0.125, en))
        assertEquals("46 %", formatPercent(0.456, fr))
        assertEquals("<1%", formatProgressShare(0.004, en))
        assertEquals("1%", formatProgressShare(0.005, en))
        assertEquals(">99%", formatProgressShare(0.996, en))
        assertEquals("99%", formatProgressShare(0.994, en))
        assertEquals("0%", formatProgressShare(0.0, en))
        assertEquals("100%", formatProgressShare(1.0, en))
    }

    @Test
    fun datesNameTheYearOnlyWhenItIsAnotherYear() {
        val today = LocalDate.of(2026, 10, 28)
        val day = LocalDate.of(2026, 10, 26)

        assertEquals("Oct 26", formatDate(day, en, today = today))
        assertEquals("Jan 5, 2027", formatDate(LocalDate.of(2027, 1, 5), en, today = today))
        assertEquals("26 de out.", formatDate(day, pt, today = today))
        assertEquals("26. Okt.", formatDate(day, de, today = today))
        assertEquals("Monday, October 26", formatDate(day, en, DateStyle.WeekdayDay, today))
        assertEquals("segunda-feira, 26 de outubro", formatDate(day, pt, DateStyle.WeekdayDay, today))
        assertEquals("October 2026", formatDate(day, en, DateStyle.Month, today))
        assertEquals("October 26", formatDate(LocalDate.of(2027, 10, 26), en, DateStyle.DayMonth, today))
    }

    @Test
    fun timesFollowTheDevicesClock() {
        val time = LocalTime.of(13, 30)

        assertEquals("1:30 PM", formatTimeOfDay(time, en, is24Hour = false))
        assertEquals("13:30", formatTimeOfDay(time, en, is24Hour = true))
        assertEquals("13:30", formatTimeOfDay(time, pt, is24Hour = true))
    }

    @Test
    fun hourRangesNameTheDayPeriodOnceWhenTheyShareIt() {
        fun plain(range: String) = range.replace('\u2009', ' ').replace('\u202F', ' ')

        assertEquals("12 – 6 AM", plain(formatHourRange(0, 6, en, is24Hour = false)))
        assertEquals("6 AM – 12 PM", plain(formatHourRange(6, 12, en, is24Hour = false)))
        assertEquals("6 PM – 12 AM", plain(formatHourRange(18, 24, en, is24Hour = false)))
        assertEquals("18 – 00", plain(formatHourRange(18, 24, en, is24Hour = true)))
        assertEquals("00h - 06h", plain(formatHourRange(0, 6, pt, is24Hour = true)))
    }
}
