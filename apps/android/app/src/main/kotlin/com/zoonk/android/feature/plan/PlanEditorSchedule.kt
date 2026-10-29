package com.zoonk.android.feature.plan

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

/** Main's `PlanSchedule`: its parts save one change at a time. [modifier] is the time a day's, [daysModifier] the study days'. */
@Composable
internal fun PlanScheduleSection(
    page: PlanPageState,
    edits: PlanEdits,
    modifier: Modifier = Modifier,
    daysModifier: Modifier = Modifier,
) {
    val shape = page.plan.schedule.weekShape
    var weekendChoice by rememberSaveable { mutableStateOf<Boolean?>(null) }
    val weekendOn = weekendChoice ?: (shape.weekend != null)

    DailyMinutes(edits, shape, weekendOn, modifier)
    StudyDays(page, edits, shape, daysModifier)
    WeekendMinutes(edits, shape, weekendOn, onWeekendOn = { weekendChoice = it })
    if (edits.hasFailed(PlanPart.Schedule)) SaveFailedText()
}

@Composable
private fun DailyMinutes(
    edits: PlanEdits,
    shape: WeekShape,
    weekendOn: Boolean,
    modifier: Modifier,
) {
    val pending = edits.isPending(PlanPart.Schedule)
    val time = rememberTappedChoice<Int>()
    val shown = time.shown(shape.weekdays)
    val locale = currentLocale()

    fun setMinutes(minutes: Int) {
        if (pending || minutes == shape.weekdays) return
        val operation =
            if (weekendOn && shape.canDiffer) PlanOp.WeekdayMinutes(shape.weekdayDays, minutes) else PlanOp.DailyMinutes(minutes)
        edits.change(PlanPart.Schedule, listOf(operation), time.pick(minutes))
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionLabel(stringResource(R.string.plan_time_a_day_label))
        FlowRow(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            timeChoices(shape.weekdays, shown).forEach { minutes ->
                FilterChip(selected = minutes == shown, onClick = { setMinutes(minutes) }, label = { Text(formatMinutes(minutes, locale)) })
            }
        }
        OtherTimeSelect(stringResource(R.string.plan_other_time_a_day), shown, enabled = !pending, onPick = ::setMinutes)
    }
}

@Composable
private fun StudyDays(
    page: PlanPageState,
    edits: PlanEdits,
    shape: WeekShape,
    modifier: Modifier,
) {
    val pending = edits.isPending(PlanPart.Schedule)
    val tapped = rememberTappedChoice<Pair<Int, Boolean>?>()
    val locale = currentLocale()
    val studies =
        (0 until DAYS_PER_WEEK).map {
            page.plan.schedule.weekdayMinutes
                .getOrElse(it) { 0L } > 0
        }
    val firstDay = WeekFields.of(locale).firstDayOfWeek.value % DAYS_PER_WEEK

    fun minutesFor(weekday: Int) = shape.weekend?.takeIf { isWeekend(weekday) } ?: shape.weekdays

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionLabel(stringResource(R.string.plan_study_days))
        BoxWithConstraints {
            val names = dayNames(maxWidth, locale)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(DAY_GAP)) {
                (0 until DAYS_PER_WEEK).map { (firstDay + it) % DAYS_PER_WEEK }.forEach { weekday ->
                    val tap = tapped.shown(null)
                    DayToggle(
                        weekday = weekday,
                        name = names,
                        on = if (tap?.first == weekday) tap.second else studies[weekday],
                        // A plan needs at least one study day.
                        enabled = !pending && !(studies[weekday] && studies.count { it } == 1),
                        onToggle = { pressed ->
                            val minutes = if (pressed) minutesFor(weekday) else 0
                            edits.change(
                                PlanPart.Schedule,
                                listOf(PlanOp.WeekdayMinutes(listOf(weekday), minutes)),
                                tapped.pick(weekday to pressed),
                            )
                        },
                        modifier = Modifier.weight(1f),
                    )
                }
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
    val fits = DayOfWeek.entries.all { measurer.measure(it.getDisplayName(TextStyle.SHORT, locale), style).size.width <= cell }
    return if (fits) TextStyle.SHORT else TextStyle.NARROW_STANDALONE
}

/** Sunday is 0, as the plan counts weekdays. */
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
    val content = if (on) colors.onSecondaryContainer else colors.onSurfaceVariant

    Surface(
        checked = on,
        onCheckedChange = onToggle,
        modifier = modifier.heightIn(min = 48.dp).semantics { contentDescription = day.getDisplayName(TextStyle.FULL, locale) },
        enabled = enabled,
        shape = MaterialTheme.shapes.small,
        color = if (on) colors.secondaryContainer else Color.Transparent,
        contentColor = if (enabled) content else content.copy(alpha = DISABLED_ALPHA),
        border = if (on) null else BorderStroke(1.dp, colors.outlineVariant),
    ) {
        Box(Modifier.padding(horizontal = DAY_PADDING), contentAlignment = Alignment.Center) {
            Text(
                text = day.getDisplayName(name, locale),
                style = MaterialTheme.typography.labelLarge,
                maxLines = 1,
                overflow = TextOverflow.Clip,
            )
        }
    }
}

@Composable
private fun WeekendMinutes(
    edits: PlanEdits,
    shape: WeekShape,
    weekendOn: Boolean,
    onWeekendOn: (Boolean) -> Unit,
) {
    if (!shape.canDiffer) return
    val pending = edits.isPending(PlanPart.Schedule)
    val weekend = rememberTappedChoice<Int>()

    fun setWeekend(minutes: Int) =
        edits.change(PlanPart.Schedule, listOf(PlanOp.WeekdayMinutes(shape.weekendDays, minutes)), weekend.pick(minutes))

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .toggleable(
                        value = weekendOn,
                        // Switched off, the weekend takes the weekdays' time, so it waits for a change still setting it.
                        enabled = !pending,
                        role = Role.Switch,
                        onValueChange = { next ->
                            onWeekendOn(next)
                            if (!next && shape.weekend != null) setWeekend(shape.weekdays)
                        },
                    ),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(stringResource(R.string.plan_weekend_time_differs), Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
            Switch(checked = weekendOn, onCheckedChange = null, enabled = !pending)
        }
        if (weekendOn) {
            TimeSelect(
                label = stringResource(R.string.plan_time_on_weekends),
                value = weekend.shown(shape.weekend ?: shape.weekdays),
                enabled = !pending,
                onPick = ::setWeekend,
            )
        }
    }
}

/** Shows the time last picked in it only while it's the plan's; picking a chip clears it. */
@Composable
private fun OtherTimeSelect(
    label: String,
    minutes: Int,
    enabled: Boolean,
    onPick: (Int) -> Unit,
) {
    var chosen by remember { mutableStateOf<Int?>(null) }

    TimeSelect(
        label = label,
        value = chosen?.takeIf { it == minutes },
        enabled = enabled,
        onPick = {
            chosen = it
            onPick(it)
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimeSelect(
    label: String,
    value: Int?,
    enabled: Boolean,
    onPick: (Int) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val locale = currentLocale()

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it && enabled }) {
        OutlinedTextField(
            value = value?.let { formatMinutes(it, locale) }.orEmpty(),
            onValueChange = {},
            modifier = Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable, enabled),
            enabled = enabled,
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            singleLine = true,
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            menuTimes(value).forEach { minutes ->
                DropdownMenuItem(
                    text = { Text(formatMinutes(minutes, locale)) },
                    onClick = {
                        expanded = false
                        onPick(minutes)
                    },
                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                )
            }
        }
    }
}

/** Onboarding's time chips, with the learner's own times among them. */
internal fun timeChoices(vararg times: Int?): List<Int> = (MINUTE_OPTIONS + times.filterNotNull()).distinct().sorted()

/** Every time the menu offers, with the one shown among them. */
internal fun menuTimes(shown: Int?): List<Int> = if (shown == null || shown in DAILY_TIMES) DAILY_TIMES else (DAILY_TIMES + shown).sorted()

private val MINUTE_OPTIONS = listOf(15, 30, 45, 60, 90, 120, 180, 240)

/** Quarter hours to four hours, then half hours to a whole day. */
private val DAILY_TIMES = (15..240 step 15) + (270..MAX_DAILY_MINUTES step 30)

private const val MAX_DAILY_MINUTES = 1440
private const val DAYS_PER_WEEK = 7
private val DAY_GAP = 4.dp
private val DAY_PADDING = 4.dp
private const val DISABLED_ALPHA = 0.38f
