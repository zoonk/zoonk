package com.zoonk.android.feature.plan

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import java.time.LocalDate
import java.util.Locale

/** Main's `plan-date-style.test.ts`: a date in another calendar year names its year, and only then. */
@RunWith(AndroidJUnit4::class)
class PlanDateTest {
    private val today = LocalDate.of(2026, 11, 14)
    private val en = Locale.ENGLISH

    private fun date(iso: String) = LocalDate.parse(iso)

    @Test
    fun theSameDayAYearAheadNamesItsYearSoItDoesntReadAsToday() {
        assertEquals("Nov 14, 2027", formatPlanDate(date("2027-11-14"), today, en))
    }

    @Test
    fun aDayEarlyNextYearNamesItsYear() {
        assertEquals("Jan 24, 2027", formatPlanDate(date("2027-01-24"), today, en))
    }

    @Test
    fun aDayLaterThisYearLeavesTheYearOut() {
        assertEquals("Dec 14", formatPlanDate(date("2026-12-14"), today, en))
    }

    @Test
    fun aDayLastYearNamesItsYear() {
        assertEquals("Nov 14, 2025", formatPlanDate(date("2025-11-14"), today, en))
    }

    @Test
    fun anEstimateSaysItsMonthAndItsYearOnlyInAnotherYear() {
        assertEquals("Dec", formatPlanDate(date("2026-12-02"), today, en, month = true))
        assertEquals("Mar 2027", formatPlanDate(date("2027-03-02"), today, en, month = true))
    }

    @Test
    fun anExamDayPutsItsWeekdayWhereEachLanguageDoes() {
        assertEquals("Sat, Nov 21", formatPlanDate(date("2026-11-21"), today, en, weekday = true))
        assertEquals("Sun, Nov 14, 2027", formatPlanDate(date("2027-11-14"), today, en, weekday = true))
        assertEquals("sáb., 21 de nov.", formatPlanDate(date("2026-11-21"), today, Locale.forLanguageTag("pt"), weekday = true))
    }
}
