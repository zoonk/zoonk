package com.zoonk.android.ui.format

import android.icu.math.BigDecimal
import android.icu.text.DateFormat
import android.icu.text.DecimalFormatSymbols
import android.icu.text.MeasureFormat
import android.icu.text.NumberFormat
import android.icu.util.Measure
import android.icu.util.MeasureUnit
import android.icu.util.TimeZone
import android.icu.util.ULocale
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.platform.LocalConfiguration
import java.time.LocalDate
import java.time.LocalTime
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

/*
 * Numbers, durations, dates and times in the learner's language, written as main writes them
 * (`@zoonk/utils/{duration,localized-number}`, `@zoonk/learn` `iso-date` and `percent`) so a
 * value reads the same on every platform. ICU, like the web's `Intl`, rounds half away from zero.
 */

/** The app's language, for the formatters below. */
@Composable
@ReadOnlyComposable
fun currentLocale(): Locale = LocalConfiguration.current.locales[0]

/**
 * A number the way people read it in their language, rounded for display only. `signed` adds a
 * plus to positive amounts ("+50"); negatives take a typographic minus ("−3"). `grouping` is off
 * for numbers like years, which read wrong as "1,960".
 */
fun formatNumber(
    value: Double,
    locale: Locale,
    maximumFractionDigits: Int = 2,
    signed: Boolean = false,
    grouping: Boolean = true,
): String {
    val format =
        NumberFormat.getInstance(ULocale.forLocale(locale)).apply {
            this.maximumFractionDigits = maximumFractionDigits.coerceIn(0, MAX_FRACTION_DIGITS)
            isGroupingUsed = grouping
            roundingMode = BigDecimal.ROUND_HALF_UP
        }
    val digits = format.format(abs(value))
    val roundsToZero = digits.none { Character.getNumericValue(it) in 1..9 }

    return when {
        value < 0 && !(signed && roundsToZero) -> MINUS_SIGN + digits
        value > 0 && signed && !roundsToZero -> DecimalFormatSymbols.getInstance(ULocale.forLocale(locale)).plusSign + digits
        else -> digits
    }
}

/** A share from 0 to 1 as a whole percentage ("46%", "46 %"). */
fun formatPercent(
    share: Double,
    locale: Locale,
): String =
    NumberFormat
        .getPercentInstance(ULocale.forLocale(locale))
        .apply {
            maximumFractionDigits = 0
            roundingMode = BigDecimal.ROUND_HALF_UP
        }.format(share)

/**
 * A share of something done, honest at its ends: begun reads "<1%", never "0%" beside a bar that
 * shows it begun, and nearly done reads ">99%", never "100%" before all of it is.
 */
fun formatProgressShare(
    share: Double,
    locale: Locale,
): String =
    when {
        share > 0 && share < WHOLE_PERCENT / 2 -> "<" + formatPercent(WHOLE_PERCENT, locale)
        share < 1 && share >= 1 - WHOLE_PERCENT / 2 -> ">" + formatPercent(1 - WHOLE_PERCENT, locale)
        else -> formatPercent(share, locale)
    }

/**
 * Compact learning time: seconds below a minute, rounded minutes below an hour, then hours and
 * minutes ("45 sec", "12 min", "1 hr 30 min"). Each number keeps its unit on its line; a line may
 * break only between hours and minutes.
 */
fun formatDuration(
    totalSeconds: Long,
    locale: Locale,
): String {
    val seconds = totalSeconds.coerceAtLeast(0)
    val format = MeasureFormat.getInstance(ULocale.forLocale(locale), MeasureFormat.FormatWidth.SHORT)

    fun unit(
        value: Long,
        unit: MeasureUnit,
    ) = format.format(Measure(value, unit)).replace(' ', NO_BREAK_SPACE)

    if (seconds == 0L) return unit(0, MeasureUnit.MINUTE)
    if (seconds < SECONDS_PER_MINUTE) return unit(seconds, MeasureUnit.SECOND)

    val totalMinutes = (seconds.toDouble() / SECONDS_PER_MINUTE).roundToLong()

    if (totalMinutes < MINUTES_PER_HOUR) return unit(totalMinutes, MeasureUnit.MINUTE)

    val hours = unit(totalMinutes / MINUTES_PER_HOUR, MeasureUnit.HOUR)
    val minutes = totalMinutes % MINUTES_PER_HOUR

    return if (minutes == 0L) hours else "$hours ${unit(minutes, MeasureUnit.MINUTE)}"
}

/** Study time given in minutes ("45 min", "1 hr 30 min"), as `formatDuration` writes it. */
fun formatMinutes(
    minutes: Int,
    locale: Locale,
): String = formatDuration(minutes * SECONDS_PER_MINUTE, locale)

/**
 * A time of day ("13:30" from the API) on the device's clock: "1:30 PM" or "13:30", following the
 * device's 24-hour setting (`android.text.format.DateFormat.is24HourFormat`).
 */
fun formatTimeOfDay(
    time: LocalTime,
    locale: Locale,
    is24Hour: Boolean,
): String = formatUtc(Date(time.toSecondOfDay() * MILLIS_PER_SECOND), if (is24Hour) "Hm" else "hm", locale)

/** How a calendar day reads, by what the screen needs (main's `useFormatIsoDate` styles). */
enum class DateStyle(
    internal val skeleton: String,
    /** Names the year once the day isn't in this year, so a date in 2028 never reads as this year's. */
    internal val yearWhenAnotherYear: Boolean = false,
) {
    /** "Oct 26" ("Oct 26, 2027" in another year). */
    Day("MMMd", yearWhenAnotherYear = true),

    /** "October 26", never with a year: for lists whose year is stated beside them. */
    DayMonth("MMMMd"),

    /** "October 26" ("October 26, 2027" in another year). */
    Long("MMMMd", yearWhenAnotherYear = true),

    /** "October 26, 2026". */
    LongYear("yMMMMd"),

    /** "October 2026". */
    Month("yMMMM"),

    /** "Oct 2026". */
    MonthShort("yMMM"),

    /** "Oct 26, 2026". */
    Short("yMMMd"),

    /** "Monday". */
    Weekday("EEEE"),

    /** "Monday, October 26". */
    WeekdayDay("MMMMEEEEd"),

    /** "Mon". */
    WeekdayShort("EEE"),
}

/**
 * A calendar day (the API's "YYYY-MM-DD", the learner's own day) in the learner's language.
 * `today` decides whether a day falls in another year.
 */
fun formatDate(
    date: LocalDate,
    locale: Locale,
    style: DateStyle = DateStyle.Day,
    today: LocalDate = LocalDate.now(),
): String {
    val skeleton = if (style.yearWhenAnotherYear && date.year != today.year) "y${style.skeleton}" else style.skeleton
    return formatUtc(Date(date.toEpochDay() * MILLIS_PER_DAY), skeleton, locale)
}

/** Calendar days and times of day carry no time zone, so they're written as UTC instants in UTC. */
private fun formatUtc(
    date: Date,
    skeleton: String,
    locale: Locale,
): String =
    DateFormat
        .getInstanceForSkeleton(skeleton, ULocale.forLocale(locale))
        .apply { timeZone = TimeZone.GMT_ZONE }
        .format(date)

private const val MAX_FRACTION_DIGITS = 20
private const val MINUS_SIGN = "−"
private const val NO_BREAK_SPACE = ' '
private const val SECONDS_PER_MINUTE = 60L
private const val MINUTES_PER_HOUR = 60L
private const val MILLIS_PER_SECOND = 1_000L
private const val MILLIS_PER_DAY = 86_400_000L

/** The least share a whole percentage shows: under half of it, a begun share would read "0%". */
private const val WHOLE_PERCENT = 0.01
