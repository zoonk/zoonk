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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import com.zoonk.android.ui.theme.zoonk
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

/** Main's `PlanSchedule`: its parts save one change at a time. [modifier] is the time a day's, [daysModifier] the study days'. */
@Composable
internal fun PlanScheduleSection(
    page: PlanPageState,
    edits: PlanEdits,
    drafts: EditorDrafts,
    modifier: Modifier = Modifier,
    daysModifier: Modifier = Modifier,
) {
    val shape = page.plan.schedule.weekShape
    val weekendOn = drafts.weekendOn ?: (shape.weekend != null)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(28.dp)) {
            DailyMinutes(page, edits, shape, weekendOn, modifier)
            StudyDays(page, edits, shape, daysModifier)
            WeekendMinutes(edits, shape, weekendOn, onWeekendOn = { drafts.weekendOn = it })
        }
        if (edits.hasFailed(PlanPart.Schedule)) SaveFailedText()
    }
}

@Composable
private fun DailyMinutes(
    page: PlanPageState,
    edits: PlanEdits,
    shape: WeekShape,
    weekendOn: Boolean,
    modifier: Modifier,
) {
    val pending = edits.isPending(PlanPart.Schedule)
    val shown = askedMinutes(edits.asked(PlanPart.Schedule), shape.weekdayDays) ?: shape.weekdays
    val locale = currentLocale()
    val answer = (edits.timeToCover.forPlan(page.plan) as? TimeToCoverState.Answered)?.time?.answer()
    val focus = remember { CoverageFocus() }

    fun setMinutes(minutes: Int) {
        if (pending || minutes == shown) return
        val operation =
            if (weekendOn && shape.canDiffer) PlanOp.WeekdayMinutes(shape.weekdayDays, minutes) else PlanOp.DailyMinutes(minutes)
        edits.change(PlanPart.Schedule, listOf(operation)) {}
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionLabel(stringResource(R.string.plan_time_a_day_label))
        FlowRow(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            timeChoices(shape.weekdays, shown, answer?.offeredMinutes).forEach { minutes ->
                PlanChip(
                    formatMinutes(minutes, locale),
                    selected = minutes == shown,
                    onClick = { setMinutes(minutes) },
                    modifier = Modifier.coverageTimeChip(focus, minutes, offered = answer?.offeredMinutes, picked = shown),
                    role = Role.RadioButton,
                    description = answer?.let { timeNote(it, minutes) },
                )
            }
            OtherTime(shown, onPick = ::setMinutes)
        }
        DailyCoverage(page, edits, focus)
        FullCourseSwitch(page, edits, focus.studyEverything)
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
    val asked = edits.asked(PlanPart.Schedule).filterIsInstance<PlanOp.WeekdayMinutes>()
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
                    DayToggle(
                        weekday = weekday,
                        name = names,
                        on = asked.firstOrNull { weekday in it.weekdays }?.let { it.minutes > 0 } ?: studies[weekday],
                        // A plan needs at least one study day.
                        enabled = !(studies[weekday] && studies.count { it } == 1),
                        onToggle = { pressed ->
                            val minutes = if (pressed) minutesFor(weekday) else 0
                            edits.change(PlanPart.Schedule, listOf(PlanOp.WeekdayMinutes(listOf(weekday), minutes))) {}
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
    val fits = DayOfWeek.entries.all { measurer.measure(dayName(it, TextStyle.SHORT, locale), style).size.width <= cell }
    return if (fits) TextStyle.SHORT else TextStyle.NARROW_STANDALONE
}

/** Sunday is 0, as the plan counts weekdays. On, it's picked as an answer is: an ink line on the picked tint. */
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

@Composable
private fun WeekendMinutes(
    edits: PlanEdits,
    shape: WeekShape,
    weekendOn: Boolean,
    onWeekendOn: (Boolean) -> Unit,
) {
    if (!shape.canDiffer) return
    val pending = edits.isPending(PlanPart.Schedule)
    val shown = askedMinutes(edits.asked(PlanPart.Schedule), shape.weekendDays) ?: shape.weekend ?: shape.weekdays

    fun setWeekend(minutes: Int) = edits.change(PlanPart.Schedule, listOf(PlanOp.WeekdayMinutes(shape.weekendDays, minutes))) {}

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .toggleable(
                        value = weekendOn,
                        role = Role.Switch,
                        onValueChange = { next ->
                            // Switched off, the weekend takes the weekdays' time, so it waits for a change still setting it.
                            if (!pending) {
                                onWeekendOn(next)
                                if (!next && shape.weekend != null) setWeekend(shape.weekdays)
                            }
                        },
                    ),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(stringResource(R.string.plan_weekend_time_differs), Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
            Switch(checked = weekendOn, onCheckedChange = null)
        }
        if (weekendOn) {
            TimeSelect(label = stringResource(R.string.plan_time_on_weekends), value = shown, onPick = ::setWeekend)
        }
    }
}

/** Main's other-time menu, as the presets' last chip: a time picked there joins the presets. */
@Composable
private fun OtherTime(
    shown: Int,
    onPick: (Int) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val locale = currentLocale()
    val times = menuTimes(shown)
    val itemHeight = with(LocalDensity.current) { MENU_ITEM_HEIGHT.roundToPx() }

    Box {
        PlanChip(
            text = stringResource(R.string.plan_other_time),
            selected = false,
            onClick = { expanded = true },
            role = Role.DropdownList,
            trailing = R.drawable.ic_arrow_drop_down,
        )
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            scrollState = rememberScrollState(times.indexOf(shown).coerceAtLeast(0) * itemHeight),
        ) {
            times.forEach { minutes ->
                DropdownMenuItem(
                    text = { Text(formatMinutes(minutes, locale)) },
                    onClick = {
                        expanded = false
                        onPick(minutes)
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimeSelect(
    label: String,
    value: Int?,
    onPick: (Int) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val locale = currentLocale()

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = value?.let { formatMinutes(it, locale) }.orEmpty(),
            onValueChange = {},
            modifier = Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable),
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

/** The time a change saving asks [days] to take, or every study day. */
private fun askedMinutes(
    asked: List<PlanOp>,
    days: List<Int>,
): Int? =
    asked.firstNotNullOfOrNull {
        when {
            it is PlanOp.DailyMinutes -> it.minutes
            it is PlanOp.WeekdayMinutes && it.weekdays == days && it.minutes > 0 -> it.minutes
            else -> null
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
private val MENU_ITEM_HEIGHT = 48.dp
