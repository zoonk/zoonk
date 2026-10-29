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
import java.time.temporal.ChronoUnit

/** A day's band from 0 (nothing) to [levels]. */
internal data class CalendarDay(
    val date: LocalDate,
    val band: Int,
)

/**
 * Main's year calendars (Activity, Energy): a week per column from the first day the API sends
 * (which starts its week), each day in its band of [color]. Drawn for the eye; TalkBack reads
 * [summary] instead, as main's figure caption.
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
    modifier: Modifier = Modifier,
) {
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val start = days.minOfOrNull { it.date } ?: return
    val length = ChronoUnit.DAYS.between(start, days.maxOf { it.date }) + 1
    val weeks = ((length + DAYS_PER_WEEK - 1) / DAYS_PER_WEEK).toInt()
    val bands = days.associate { it.date to it.band }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(title)

        Canvas(
            Modifier
                .fillMaxWidth()
                .aspectRatio(weeks / DAYS_PER_WEEK.toFloat())
                .clearAndSetSemantics { contentDescription = summary },
        ) {
            val gap = 2.dp.toPx()
            val cell = (size.width - gap * (weeks - 1)) / weeks
            val radius = CornerRadius(cell / 4)

            for (index in 0 until length.toInt()) {
                val band = bands[start.plusDays(index.toLong())] ?: 0
                val fill = if (band == 0) track else color.copy(alpha = band.toFloat() / levels)
                val week = index / DAYS_PER_WEEK
                val column = if (rtl) weeks - 1 - week else week
                drawRoundRect(fill, Offset(column * (cell + gap), index % DAYS_PER_WEEK * (cell + gap)), Size(cell, cell), radius)
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
private const val DAYS_PER_WEEK = 7
