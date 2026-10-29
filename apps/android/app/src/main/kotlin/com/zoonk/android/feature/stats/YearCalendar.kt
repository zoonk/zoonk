package com.zoonk.android.feature.stats

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.components.SectionHeader
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters
import java.time.temporal.WeekFields
import java.util.Locale

/** A day's band from 0 (nothing) to [levels]. */
internal data class CalendarDay(
    val date: LocalDate,
    val band: Int,
)

/**
 * Main's year calendars (Activity, Energy): a week per column, oldest at the start, each day in its
 * band of [color]. Drawn for the eye; TalkBack reads [summary] instead, as main's figure caption.
 */
@Composable
internal fun YearCalendar(
    title: String,
    days: List<CalendarDay>,
    levels: Int,
    color: Color,
    low: String,
    high: String,
    summary: String,
    locale: Locale,
    modifier: Modifier = Modifier,
) {
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val firstDay = WeekFields.of(locale).firstDayOfWeek
    val newest = days.maxOfOrNull { it.date } ?: return
    val start = newest.minusWeeks(WEEKS - 1L).with(TemporalAdjusters.previousOrSame(firstDay))
    val bands = days.associate { it.date to it.band }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(title)

        Canvas(
            Modifier
                .fillMaxWidth()
                .aspectRatio(WEEKS / DAYS_PER_WEEK.toFloat())
                .clearAndSetSemantics { contentDescription = summary },
        ) {
            val gap = 2.dp.toPx()
            val cell = (size.width - gap * (WEEKS - 1)) / WEEKS
            val radius = CornerRadius(cell / 4)

            for (week in 0 until WEEKS) {
                for (row in 0 until DAYS_PER_WEEK) {
                    val date = start.plusDays(week * DAYS_PER_WEEK.toLong() + row)
                    if (date.isAfter(newest)) continue

                    val band = bands[date] ?: 0
                    val fill = if (band == 0) track else color.copy(alpha = band.toFloat() / levels)
                    val column = if (rtl) WEEKS - 1 - week else week
                    drawRoundRect(fill, Offset(column * (cell + gap), row * (cell + gap)), Size(cell, cell), radius)
                }
            }
        }

        Row(
            modifier = Modifier.clearAndSetSemantics {},
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(low, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
            (0..levels).forEach { band ->
                Canvas(Modifier.size(10.dp)) {
                    drawRoundRect(
                        if (band ==
                            0
                        ) {
                            track
                        } else {
                            color.copy(alpha = band.toFloat() / levels)
                        },
                        cornerRadius = CornerRadius(2.dp.toPx()),
                    )
                }
            }
            Text(high, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
        }
    }
}

/** Main's relative bands: a quieter day reads apart from a busier one even while the counts are small. */
internal fun activityBand(
    count: Long,
    maximum: Long,
): Int = if (count == 0L || maximum == 0L) 0 else maxOf(1, Math.ceil(count.toDouble() / maximum * ACTIVITY_LEVELS).toInt())

/** Energy's 0–100% is absolute, so its bands are fixed; the strongest is full Energy alone. */
internal fun energyBand(energy: Double?): Int =
    when {
        energy == null || energy <= 0 -> 0
        energy >= FULL_ENERGY -> ENERGY_LEVELS
        else -> Math.ceil(energy / ENERGY_STEP).toInt()
    }

internal const val ACTIVITY_LEVELS = 4
internal const val ENERGY_LEVELS = 5
private const val ENERGY_STEP = 25.0
private const val FULL_ENERGY = 100.0
private const val WEEKS = 53
private const val DAYS_PER_WEEK = 7
