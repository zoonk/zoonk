package com.zoonk.android.ui.format

import java.time.DayOfWeek
import java.time.format.TextStyle
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

/** A week's day names in one locale: "Monday" for a label of its own, "M" for a day's column. */
class WeekdayNames internal constructor(
    locale: Locale,
) {
    val full: Map<DayOfWeek, String> =
        DayOfWeek.entries.associateWith {
            it.getDisplayName(TextStyle.FULL_STANDALONE, locale).replaceFirstChar { c ->
                c.titlecase(locale)
            }
        }

    val narrow: Map<DayOfWeek, String> =
        DayOfWeek.entries.associateWith { it.getDisplayName(TextStyle.NARROW_STANDALONE, locale).uppercase(locale) }
}

private val weekdayNamesByLocale = ConcurrentHashMap<Locale, WeekdayNames>()

/** Kept per locale: a lookup loads the locale's calendar data, slow enough on a loaded device to stall composition. */
fun weekdayNames(locale: Locale): WeekdayNames = weekdayNamesByLocale.getOrPut(locale) { WeekdayNames(locale) }
