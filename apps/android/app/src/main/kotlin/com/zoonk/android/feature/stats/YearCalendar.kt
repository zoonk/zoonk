package com.zoonk.android.feature.stats

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.format.currentLocale
import java.time.LocalDate
import java.time.format.TextStyle

/** A day's band from 0 (nothing) to its calendar's last shade, and what the readout says for it. */
internal data class CalendarDay(
    val date: LocalDate,
    val band: Int,
    val label: String,
)

/**
 * Main's year calendars (Activity, Energy): a week per column from the first day the API sends,
 * which starts its week, scrolled to the newest. A tapped day says its date and value below, which
 * opens on [start] (main's newest day with something). TalkBack reads [summary], then each day.
 */
@Composable
internal fun YearCalendar(
    title: String,
    days: List<CalendarDay>,
    shades: List<Float>,
    color: Color,
    low: String,
    high: String,
    summary: String,
    start: Int,
    modifier: Modifier = Modifier,
) {
    if (days.isEmpty()) return

    val locale = currentLocale()
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val weeks = days.chunked(DAYS_PER_WEEK)
    val list = rememberLazyListState(initialFirstVisibleItemIndex = weeks.lastIndex)
    var selected by rememberSaveable(days.size) { mutableIntStateOf(start.coerceIn(days.indices)) }

    fun fill(band: Int) = if (band == 0) track else lerp(track, color, shades[(band - 1).coerceIn(shades.indices)])

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SectionHeader(title, Modifier.weight(1f))
            Legend(low, high, (0..shades.size).map(::fill))
        }

        LazyRow(
            state = list,
            modifier = Modifier.semantics { contentDescription = summary },
            horizontalArrangement = Arrangement.spacedBy(GAP),
        ) {
            itemsIndexed(weeks, key = { _, week -> week.first().date.toEpochDay() }) { weekIndex, week ->
                Column(verticalArrangement = Arrangement.spacedBy(GAP)) {
                    // Every week keeps the line, so a month's first week doesn't sit lower than the rest.
                    Text(
                        week
                            .firstOrNull { it.date.dayOfMonth == 1 }
                            ?.date
                            ?.month
                            ?.getDisplayName(
                                TextStyle.SHORT_STANDALONE,
                                locale,
                            ).orEmpty(),
                        modifier = Modifier.width(CELL).wrapContentWidth(Alignment.Start, unbounded = true).clearAndSetSemantics {},
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelSmall,
                        maxLines = 1,
                        softWrap = false,
                    )

                    week.forEachIndexed { dayIndex, day ->
                        val index = weekIndex * DAYS_PER_WEEK + dayIndex
                        val shape = RoundedCornerShape(CELL_CORNER)
                        Box(
                            Modifier
                                .size(CELL)
                                .background(fill(day.band), shape)
                                .then(
                                    if (index ==
                                        selected
                                    ) {
                                        Modifier.border(SELECTED_RING, MaterialTheme.colorScheme.onSurface, shape)
                                    } else {
                                        Modifier
                                    },
                                ).selectable(selected = index == selected) { selected = index }
                                .semantics { contentDescription = day.label },
                        )
                    }
                }
            }
        }

        Text(
            days[selected].label,
            modifier = Modifier.clearAndSetSemantics {},
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun Legend(
    low: String,
    high: String,
    fills: List<Color>,
) {
    Row(
        modifier = Modifier.clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(low, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
        fills.forEach { Box(Modifier.size(10.dp).background(it, RoundedCornerShape(CELL_CORNER))) }
        Text(high, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
    }
}

/** Main's relative bands: a quieter day reads apart from a busier one even while the counts are small. */
internal fun activityBand(
    count: Long,
    maximum: Long,
): Int = if (count == 0L || maximum == 0L) 0 else maxOf(1, Math.ceil(count.toDouble() / maximum * ACTIVITY_SHADES.size).toInt())

/** Energy's 0–100% is absolute, so its bands are fixed; the strongest is full Energy alone. */
internal fun energyBand(energy: Double?): Int =
    when {
        energy == null || energy <= 0 -> 0
        energy >= FULL_ENERGY -> ENERGY_SHADES.size
        else -> Math.ceil(energy / ENERGY_STEP).toInt()
    }

/** Main's `bg-success/25` to `bg-success`, blended over the empty day so each band is brighter than the last in both themes. */
internal val ACTIVITY_SHADES = listOf(0.25f, 0.45f, 0.7f, 1f)

/** Main softened Energy's steps so its calendar isn't the loudest thing on the page. */
internal val ENERGY_SHADES = listOf(0.15f, 0.3f, 0.45f, 0.6f, 0.8f)

private val CELL = 12.dp
private val GAP = 2.dp
private val CELL_CORNER = 2.dp
private val SELECTED_RING = 1.5.dp
private const val ENERGY_STEP = 25.0
private const val FULL_ENERGY = 100.0
private const val DAYS_PER_WEEK = 7
