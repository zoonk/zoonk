package com.zoonk.android.feature.stats

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.components.ChartInspector
import com.zoonk.android.ui.components.ChartTooltip
import com.zoonk.android.ui.components.ChartTooltipArea
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.format.currentLocale
import java.time.LocalDate
import java.time.format.TextStyle
import kotlin.math.floor

/** A day's band from 0 (nothing) to its calendar's last shade, and what its tooltip says: its date over its value. */
internal data class CalendarDay(
    val date: LocalDate,
    val band: Int,
    val label: String,
    val value: String,
)

/**
 * Main's year calendars (Activity, Energy): a week per column from the first day the API sends,
 * which starts its week, scrolled to the newest. A tapped day shows its date and value in a tooltip
 * beside it, inside the weeks in view. TalkBack reads [summary], then each day.
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
    inspector: ChartInspector,
    modifier: Modifier = Modifier,
) {
    if (days.isEmpty()) return

    val locale = currentLocale()
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val weeks = days.chunked(DAYS_PER_WEEK)
    val list = rememberLazyListState(initialFirstVisibleItemIndex = weeks.lastIndex)
    val chart = remember { Any() }
    val active = inspector.indexIn(chart)?.takeIf { it in days.indices }

    fun fill(band: Int) = if (band == 0) track else lerp(track, color, shades[(band - 1).coerceIn(shades.indices)])

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FlowRow(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalArrangement = Arrangement.spacedBy(8.dp),
            itemVerticalAlignment = Alignment.CenterVertically,
        ) {
            SectionHeader(title)
            Legend(low, high, (0..shades.size).map(::fill))
        }

        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val size = calendarSize(maxWidth, weeks.size)

            ChartTooltipArea(
                tooltip = active?.let { { ChartTooltip(days[it].label, days[it].value) } },
                anchor = { area -> active?.let { dayBounds(it, list, size.cell, area) } },
                inspector = inspector,
                modifier = Modifier.width(size.width).align(Alignment.TopEnd),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(GAP)) {
                    MonthLabels(
                        months =
                            remember(weeks, locale) {
                                weeks.mapIndexedNotNull { index, week ->
                                    week.firstOrNull { it.date.dayOfMonth == 1 }?.let {
                                        index to
                                            it.date.month.getDisplayName(TextStyle.SHORT_STANDALONE, locale)
                                    }
                                }
                            },
                        list = list,
                    )

                    LazyRow(
                        state = list,
                        modifier = Modifier.fillMaxWidth().semantics { contentDescription = summary },
                        horizontalArrangement = if (size.fits) Arrangement.SpaceBetween else Arrangement.spacedBy(GAP),
                    ) {
                        itemsIndexed(weeks, key = { _, week -> week.first().date.toEpochDay() }) { weekIndex, week ->
                            Column(verticalArrangement = Arrangement.spacedBy(GAP)) {
                                week.forEachIndexed { dayIndex, day ->
                                    val index = weekIndex * DAYS_PER_WEEK + dayIndex
                                    CalendarCell(day, fill(day.band), size.cell, active = index == active) {
                                        inspector.inspect(chart, index)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** The inspected day's ring sits inside its square, and its inner line keeps it readable on every shade. */
@Composable
private fun CalendarCell(
    day: CalendarDay,
    fill: Color,
    size: Dp,
    active: Boolean,
    onInspect: () -> Unit,
) {
    val shape = RoundedCornerShape(CELL_CORNER)
    val ring =
        if (active) {
            Modifier
                .border(RING, MaterialTheme.colorScheme.onSurface, shape)
                .padding(RING)
                .border(RING_INNER_LINE, MaterialTheme.colorScheme.surface)
        } else {
            Modifier
        }

    Box(
        Modifier
            .size(size)
            .selectable(selected = active, onClick = onInspect)
            .semantics { contentDescription = listOf(day.label, day.value).joinToString() }
            .background(fill, shape)
            .then(ring),
    )
}

/** A day's bounds from the calendar's start edge while its week is in view; the days end [area], under the months. */
private fun Density.dayBounds(
    index: Int,
    list: LazyListState,
    cell: Dp,
    area: IntSize,
): IntRect? {
    val size = cell.roundToPx()
    val step = size + GAP.roundToPx()
    val top = area.height - (DAYS_PER_WEEK - index % DAYS_PER_WEEK) * step + GAP.roundToPx()

    return list.layoutInfo.visibleItemsInfo
        .firstOrNull { it.index == index / DAYS_PER_WEEK }
        ?.let { IntRect(left = it.offset, top = top, right = it.offset + size, bottom = top + size) }
}

private class CalendarSize(
    val cell: Dp,
    val width: Dp,
    val fits: Boolean,
)

/**
 * The whole year when its days stay at least [FITTED_CELL_MIN] wide; otherwise days a finger can
 * pick, in as many whole weeks as fit, so no week is cut at the calendar's edge.
 */
private fun calendarSize(
    available: Dp,
    weeks: Int,
): CalendarSize {
    val fitted = floor(((available + GAP) / weeks - GAP).value).dp

    if (fitted >= FITTED_CELL_MIN) return CalendarSize(minOf(fitted, FITTED_CELL_MAX), available, fits = true)

    val step = TOUCH_CELL + GAP
    return CalendarSize(TOUCH_CELL, step * floor((available + GAP) / step) - GAP, fits = false)
}

/**
 * Each month's name over the week it starts, placed from the weeks in view and kept inside the
 * calendar's edges, so a week half scrolled out or the newest one never cuts its month's name.
 */
@Composable
private fun MonthLabels(
    months: List<Pair<Int, String>>,
    list: LazyListState,
) {
    Layout(
        content = {
            months.forEach { (_, name) ->
                Text(
                    name,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelSmall,
                    maxLines = 1,
                    softWrap = false,
                )
            }
        },
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics {},
    ) { measurables, constraints ->
        val labels = measurables.map { it.measure(Constraints()) }
        val width = constraints.maxWidth
        val gap = LABEL_GAP.roundToPx()

        layout(width, labels.maxOfOrNull { it.height } ?: 0) {
            val shown = list.layoutInfo.visibleItemsInfo.associateBy { it.index }
            var taken = Int.MIN_VALUE
            months.forEachIndexed { index, (week, _) ->
                val item = shown[week] ?: return@forEachIndexed
                val label = labels[index]
                val x = item.offset.coerceIn(0, (width - label.width).coerceAtLeast(0))
                if (x < taken + gap) return@forEachIndexed
                label.placeRelative(x, 0)
                taken = x + label.width
            }
        }
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

private val TOUCH_CELL = 20.dp
private val FITTED_CELL_MIN = 12.dp
private val FITTED_CELL_MAX = 16.dp
private val GAP = 2.dp
private val CELL_CORNER = 2.dp
private val RING = 2.dp
private val RING_INNER_LINE = 1.dp
private val LABEL_GAP = 4.dp
private const val ENERGY_STEP = 25.0
private const val FULL_ENERGY = 100.0
private const val DAYS_PER_WEEK = 7
