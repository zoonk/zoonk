package com.zoonk.android.ui.format

import android.icu.math.BigDecimal
import android.icu.text.DateFormat
import android.icu.text.DateIntervalFormat
import android.icu.text.DecimalFormatSymbols
import android.icu.text.ListFormatter
import android.icu.text.MeasureFormat
import android.icu.text.NumberFormat
import android.icu.util.DateInterval
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
 * These write what main's `@zoonk/utils` and `@zoonk/learn` formatters write, so a value reads the
 * same on every platform; ICU rounds half-even unless told to round half up as `Intl` does.
 */

@Composable
@ReadOnlyComposable
fun currentLocale(): Locale = LocalConfiguration.current.locales[0]

/** "a, b and c", as main's `format.list` writes a conjunction. */
fun formatList(
    items: List<String>,
    locale: Locale,
): String = ListFormatter.getInstance(locale).format(items)

/** Turn `grouping` off for numbers like years, which read wrong as "1,960". */
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

/** A tenth of a point (`maximumFractionDigits = 1`) is main's `formatMetricPercent`, for averages and scores. */
fun formatPercent(
    share: Double,
    locale: Locale,
    maximumFractionDigits: Int = 0,
): String =
    NumberFormat
        .getPercentInstance(ULocale.forLocale(locale))
        .apply {
            this.maximumFractionDigits = maximumFractionDigits
            roundingMode = BigDecimal.ROUND_HALF_UP
        }.format(share)

/** Begun never reads "0%" beside a bar that shows it begun, nor nearly done "100%". */
fun formatProgressShare(
    share: Double,
    locale: Locale,
): String =
    when {
        share > 0 && share < WHOLE_PERCENT / 2 -> "<" + formatPercent(WHOLE_PERCENT, locale)
        share < 1 && share >= 1 - WHOLE_PERCENT / 2 -> ">" + formatPercent(1 - WHOLE_PERCENT, locale)
        else -> formatPercent(share, locale)
    }

/** Each number keeps its unit on its line; a line may break only between hours and minutes. */
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

fun formatMinutes(
    minutes: Int,
    locale: Locale,
): String = formatDuration(minutes * SECONDS_PER_MINUTE, locale)

/** Pass the device's clock setting, `android.text.format.DateFormat.is24HourFormat`. */
fun formatTimeOfDay(
    time: LocalTime,
    locale: Locale,
    is24Hour: Boolean,
): String = formatUtc(Date(time.toSecondOfDay() * MILLIS_PER_SECOND), if (is24Hour) "Hm" else "hm", locale)

/**
 * Whole hours from [startHour] to [endHour] in the locale's interval style ("12–6 AM", "18–00").
 * Both are read on one day, since a range ending on the next day's midnight would name both dates.
 */
fun formatHourRange(
    startHour: Int,
    endHour: Int,
    locale: Locale,
    is24Hour: Boolean,
): String =
    DateIntervalFormat
        .getInstance(if (is24Hour) "HH" else "h", ULocale.forLocale(locale))
        .apply { timeZone = TimeZone.GMT_ZONE }
        .format(DateInterval(startHour * MILLIS_PER_HOUR, endHour % HOURS_PER_DAY * MILLIS_PER_HOUR))

enum class DateStyle(
    internal val skeleton: String,
    /** Names the year once the day isn't in this year, so a date in 2028 never reads as this year's. */
    internal val yearWhenAnotherYear: Boolean = false,
) {
    Day("MMMd", yearWhenAnotherYear = true),

    /** Never with a year: for lists whose year is stated beside them. */
    DayMonth("MMMMd"),

    Long("MMMMd", yearWhenAnotherYear = true),

    LongYear("yMMMMd"),

    Month("yMMMM"),

    MonthShort("yMMM"),

    Short("yMMMd"),

    Weekday("EEEE"),

    WeekdayDay("MMMMEEEEd"),

    /** "Sunday, November 14, 2027": an exam's day, whose edition may be years ahead. */
    WeekdayDayYear("yMMMMEEEEd"),

    /** "Wed, Oct 28": Today's date line. */
    WeekdayDayShort("MMMEEEd"),

    WeekdayShort("EEE"),
}

fun formatDate(
    date: LocalDate,
    locale: Locale,
    style: DateStyle = DateStyle.Day,
    today: LocalDate = LocalDate.now(),
): String {
    val skeleton = if (style.yearWhenAnotherYear && date.year != today.year) "y${style.skeleton}" else style.skeleton
    return formatUtc(Date(date.toEpochDay() * MILLIS_PER_DAY), skeleton, locale)
}

/** Calendar days and times of day carry no time zone, so they're formatted as UTC instants in UTC. */
private fun formatUtc(
    date: Date,
    skeleton: String,
    locale: Locale,
): String =
    DateFormat
        .getInstanceForSkeleton(skeleton, ULocale.forLocale(locale))
        .apply { timeZone = TimeZone.GMT_ZONE }
        .format(date)

internal const val MAX_FRACTION_DIGITS = 20
internal const val MINUS_SIGN = "−"
internal const val NO_BREAK_SPACE = ' '
private const val SECONDS_PER_MINUTE = 60L
private const val MINUTES_PER_HOUR = 60L
private const val MILLIS_PER_SECOND = 1_000L
private const val MILLIS_PER_HOUR = 3_600_000L
private const val HOURS_PER_DAY = 24
private const val MILLIS_PER_DAY = 86_400_000L

private const val WHOLE_PERCENT = 0.01
