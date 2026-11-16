package com.zoonk.android.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.theme.zoonk
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.util.Locale

/**
 * Main's `WeekdayToggle` grid: the week's seven days in one row of equal boxes, Monday to Sunday as the plan's
 * week runs in every language, each the same box on or off. A weekday is 0 for Sunday to 6 for Saturday, as the
 * plan counts them. On, a day is picked as an answer is: an ink line on the picked tint.
 */
@Composable
fun WeekdayPicker(
    isOn: (weekday: Int) -> Boolean,
    onToggle: (weekday: Int, on: Boolean) -> Unit,
    modifier: Modifier = Modifier,
    isEnabled: (weekday: Int) -> Boolean = { true },
) {
    val locale = currentLocale()

    BoxWithConstraints(modifier.widthIn(max = WEEK_WIDTH)) {
        val names = dayNames(maxWidth, locale)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(DAY_GAP)) {
            MONDAY_TO_SUNDAY.forEach { weekday ->
                DayToggle(weekday, names, isOn(weekday), isEnabled(weekday), { onToggle(weekday, it) }, Modifier.weight(1f))
            }
        }
    }
}

/** Short names ("Mon") while they fit a seventh of the row, narrow ones ("M") at large text sizes. */
@Composable
private fun dayNames(
    width: Dp,
    locale: Locale,
): TextStyle {
    val measurer = rememberTextMeasurer()
    val style = MaterialTheme.typography.labelLarge
    val cell = with(LocalDensity.current) { ((width - DAY_GAP * (DAYS_PER_WEEK - 1)) / DAYS_PER_WEEK - DAY_PADDING * 2).toPx() }
    val fits = DayOfWeek.entries.all { measurer.measure(dayName(it, TextStyle.SHORT, locale), style).size.width <= cell }
    return if (fits) TextStyle.SHORT else TextStyle.NARROW_STANDALONE
}

@Composable
private fun DayToggle(
    weekday: Int,
    name: TextStyle,
    on: Boolean,
    enabled: Boolean,
    onToggle: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()
    val day = DayOfWeek.of(if (weekday == 0) DAYS_PER_WEEK else weekday)
    val colors = MaterialTheme.colorScheme
    val content = if (on) colors.onSurface else colors.onSurfaceVariant

    Surface(
        checked = on,
        onCheckedChange = onToggle,
        modifier = modifier.heightIn(min = 48.dp).semantics { contentDescription = day.getDisplayName(TextStyle.FULL, locale) },
        enabled = enabled,
        shape = MaterialTheme.shapes.small,
        color = if (on) MaterialTheme.zoonk.selectedTint else Color.Transparent,
        contentColor = if (enabled) content else content.copy(alpha = DISABLED_ALPHA),
        border = if (on) BorderStroke(2.dp, colors.primary) else BorderStroke(1.dp, colors.outline),
    ) {
        Box(Modifier.padding(horizontal = DAY_PADDING), contentAlignment = Alignment.Center) {
            Text(
                text = dayName(day, name, locale),
                style = MaterialTheme.typography.labelLarge,
                maxLines = 1,
                overflow = TextOverflow.Clip,
            )
        }
    }
}

/** Java's short names are lowercase in Portuguese, Spanish and French; main capitalizes them. */
private fun dayName(
    day: DayOfWeek,
    style: TextStyle,
    locale: Locale,
) = day.getDisplayName(style, locale).replaceFirstChar { it.titlecase(locale) }

private const val DAYS_PER_WEEK = 7
private val MONDAY_TO_SUNDAY = listOf(1, 2, 3, 4, 5, 6, 0)

/** Main's `max-w-sm`. */
private val WEEK_WIDTH = 384.dp
private val DAY_GAP = 4.dp
private val DAY_PADDING = 4.dp
private const val DISABLED_ALPHA = 0.38f
