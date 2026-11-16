package com.zoonk.android.feature.plan

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.components.DailyTimePicker
import com.zoonk.android.ui.components.Switch
import com.zoonk.android.ui.components.TimeSelect
import com.zoonk.android.ui.components.WeekdayPicker
import com.zoonk.android.ui.components.WeekendTime
import com.zoonk.android.ui.components.missingDays
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlanWeekShape
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
    val shape = page.plan.schedule.shape
    val weekendOn = drafts.weekendOn ?: (shape.weekend != null)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(28.dp)) {
            DailyMinutes(page, edits, shape, weekendOn, modifier)
            StudyDays(page, edits, shape, daysModifier)
            WeekendMinutes(edits, shape, page.plan.schedule.dailyTimes, weekendOn, onWeekendOn = { drafts.weekendOn = it })
        }
        if (edits.hasFailed(PlanPart.Schedule)) SaveFailedText()
    }
}

@Composable
private fun DailyMinutes(
    page: PlanPageState,
    edits: PlanEdits,
    shape: PlanWeekShape,
    weekendOn: Boolean,
    modifier: Modifier,
) {
    val pending = edits.isPending(PlanPart.Schedule)
    val weekdayDays = shape.weekdayDays.map(Long::toInt)
    val shown = askedMinutes(edits.asked(PlanPart.Schedule), weekdayDays) ?: shape.weekdays.toInt()
    val search = edits.timeToCover.forPlan(page.plan)
    val marked = markedTimes((search as? TimeToCoverState.Answered)?.time)
    val focus = remember { CoverageFocus() }
    val dated = page.plan.schedule.targetDate != null

    // Asked when the editor opens, never on loading the page: it plans the goal at many times.
    LaunchedEffect(dated, search == TimeToCoverState.Idle) {
        if (dated && search == TimeToCoverState.Idle) edits.findTimeToCover(page.plan, null)
    }
    ActOn(edits.outcomes.dateMoved) { focus.pickedTime.requestFocus() }

    fun setMinutes(minutes: Int) {
        if (pending || minutes == shown) return
        val operation =
            if (weekendOn && shape.canDiffer) PlanOp.WeekdayMinutes(weekdayDays, minutes) else PlanOp.DailyMinutes(minutes)
        edits.change(PlanPart.Schedule, listOf(operation), null)
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // The picker carries the name for screen readers; this is its visible title.
        SectionLabel(stringResource(R.string.plan_time_a_day_label), Modifier.clearAndSetSemantics {})
        DailyTimePicker(
            times = page.plan.schedule.dailyTimes,
            minutes = shown,
            label = stringResource(R.string.plan_time_a_day_label),
            onChange = ::setMinutes,
            modifier = Modifier.focusRequester(focus.pickedTime),
            enabled = !pending,
            suggested = marked.suggested,
            full = marked.full,
        )
        DailyCoverage(page, edits, focus, minutes = shape.weekdays.toInt(), onUseTime = ::setMinutes)
        FullCourseSwitch(page, edits, focus.studyEverything)
    }
}

@Composable
private fun StudyDays(
    page: PlanPageState,
    edits: PlanEdits,
    shape: PlanWeekShape,
    modifier: Modifier,
) {
    val pending = edits.isPending(PlanPart.Schedule)
    val asked = edits.asked(PlanPart.Schedule).filterIsInstance<PlanOp.WeekdayMinutes>()
    val studies =
        (0 until DAYS_PER_WEEK).map {
            page.plan.schedule.weekdayMinutes
                .getOrElse(it) { 0L } > 0
        }

    fun minutesFor(weekday: Int) = (shape.weekend?.takeIf { isWeekend(weekday) } ?: shape.weekdays).toInt()

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionLabel(stringResource(R.string.plan_study_days))
        WeekdayPicker(
            isOn = { weekday -> asked.firstOrNull { weekday in it.weekdays }?.let { it.minutes > 0 } ?: studies[weekday] },
            onToggle = { weekday, pressed ->
                val minutes = if (pressed) minutesFor(weekday) else 0
                edits.change(PlanPart.Schedule, listOf(PlanOp.WeekdayMinutes(listOf(weekday), minutes)), null)
            },
            // A plan needs at least one study day.
            isEnabled = { weekday -> !(studies[weekday] && studies.count { it } == 1) },
        )
    }
}

/** Main's plan `WeekendMinutes`: switched off, the weekend takes the weekdays' time, so it waits for a change still setting it. */
@Composable
private fun WeekendMinutes(
    edits: PlanEdits,
    shape: PlanWeekShape,
    times: List<Long>,
    weekendOn: Boolean,
    onWeekendOn: (Boolean) -> Unit,
) {
    val pending = edits.isPending(PlanPart.Schedule)
    val weekendDays = shape.weekendDays.map(Long::toInt)
    val shown = askedMinutes(edits.asked(PlanPart.Schedule), weekendDays) ?: (shape.weekend ?: shape.weekdays).toInt()

    fun setWeekend(minutes: Int) = edits.change(PlanPart.Schedule, listOf(PlanOp.WeekdayMinutes(weekendDays, minutes)), null)

    WeekendTime(
        checked = weekendOn,
        missing = missingDays((shape.weekdayDays + shape.weekendDays).map(Long::toInt)),
        times = times,
        minutes = shown,
        weekdayMinutes = shape.weekdays.toInt(),
        onCheckedChange = { next ->
            if (!pending) {
                onWeekendOn(next)
                if (!next && shape.weekend != null) setWeekend(shape.weekdays.toInt())
            }
        },
        onPick = ::setWeekend,
        timeEnabled = !pending,
    )
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

/** Sunday is 0, as the plan counts weekdays. */
private fun isWeekend(weekday: Int) = weekday == 0 || weekday == 6

private const val DAYS_PER_WEEK = 7
