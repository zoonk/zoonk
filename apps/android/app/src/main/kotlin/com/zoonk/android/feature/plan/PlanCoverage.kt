package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.layout
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanFeasibility
import com.zoonk.api.models.PlanTimeToCover
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate

/** Null when the plan covers everything in depth or has no date to cover it by. */
internal fun planCoverage(plan: Plan): PlanFeasibility? = plan.feasibility?.takeIf { it.deadline != null && !it.fits }

/** The learner's own time covers everything once planned again at it, so no other time is offered. */
internal fun timeEnough(plan: Plan): Boolean = plan.feasibility?.timeCovers ?: false

internal fun canMoveDate(page: PlanPageState): Boolean = !page.isExam && planCoverage(page.plan) != null && !timeEnough(page.plan)

/** Main's `useCoveredText`: what the time a day studies by the date, and what it leaves out or after. */
@Composable
internal fun coveredText(
    plan: Plan,
    coverage: PlanFeasibility,
): String {
    val time = formatMinutes(plan.schedule.dailyMinutes.toInt(), currentLocale())
    val exam = coverage.measure == PlanFeasibility.Measure.EXAM

    return when {
        coverage.coveredShare < MIN_SHOWN_SHARE -> stringResource(R.string.plan_covered_not_enough, time)
        coverage.coreFits && exam && coverage.deepensMostAsked -> stringResource(R.string.plan_covered_exam_most_asked, time)
        coverage.coreFits && exam -> stringResource(R.string.plan_covered_exam_less_depth, time)
        coverage.coreFits -> stringResource(R.string.plan_covered_goal_core, time)
        exam && plan.schedule.fullCourse -> stringResource(R.string.plan_covered_exam_after, time)
        exam -> stringResource(R.string.plan_covered_exam_left_out, time)
        else -> stringResource(R.string.plan_covered_goal_left_out, time)
    }
}

/** Below half a percent, the share would read "0%". */
private const val MIN_SHOWN_SHARE = 0.005

/** A goal's date as main's `useFormatGoalDate` writes it: a date standing for its month says the month. */
@Composable
internal fun goalDate(
    date: LocalDate,
    namedMonth: Boolean,
    today: LocalDate,
    style: DateStyle = DateStyle.Long,
): String = formatDate(date, currentLocale(), if (namedMonth) DateStyle.Month else style, today)

@Composable
internal fun timeCoversText(
    minutes: Int,
    targetDate: LocalDate,
    namedMonth: Boolean,
    today: LocalDate,
): String = stringResource(R.string.plan_find_covers, formatMinutes(minutes, currentLocale()), goalDate(targetDate, namedMonth, today))

@Composable
internal fun noTimeCoversText(
    targetDate: LocalDate,
    namedMonth: Boolean,
    today: LocalDate,
): String = stringResource(R.string.plan_find_none, goalDate(targetDate, namedMonth, today))

@Composable
internal fun everyTopicText(minutes: Int): String = stringResource(R.string.plan_find_every_topic, formatMinutes(minutes, currentLocale()))

@Composable
internal fun fittingDateText(
    dailyMinutes: Int,
    fittingDate: LocalDate,
    today: LocalDate,
): String =
    stringResource(
        R.string.plan_find_fitting_date,
        formatMinutes(dailyMinutes, currentLocale()),
        formatDate(fittingDate, currentLocale(), DateStyle.Long, today),
    )

/** The note under the time chip the answer offers. */
@Composable
internal fun timeNote(
    answer: TimeToCoverAnswer,
    minutes: Int,
): String? {
    if (answer.offeredMinutes != minutes) return null
    return stringResource(if (answer is TimeToCoverAnswer.Covers) R.string.plan_note_covers_everything else R.string.plan_note_every_topic)
}

/**
 * Main's `DailyCoverage`, under the time a day. While the schedule's change saves, its place says
 * the new coverage is being worked out: the old one would describe a time no longer picked.
 */
@Composable
internal fun DailyCoverage(
    page: PlanPageState,
    edits: PlanEdits,
    focus: CoverageFocus,
) {
    val plan = page.plan
    if (plan.feasibility?.deadline == null) return
    val pending = edits.isPending(PlanPart.Schedule)
    val coverage = planCoverage(plan)
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    Box(Modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
        Column(Modifier.hiddenIf(pending), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (coverage == null) {
                Text(stringResource(R.string.plan_covers_whole_goal), style = MaterialTheme.typography.bodyMedium, color = muted)
                return@Column
            }
            val target = plan.schedule.targetDate
            Text(
                text =
                    if (plan.fitOffer?.fits == true && target != null) {
                        stringResource(
                            R.string.plan_time_covers_everything_by,
                            goalDate(target.toJavaLocalDate(), plan.schedule.targetDateNamedMonth, page.today),
                        )
                    } else {
                        coveredText(plan, coverage)
                    },
                style = MaterialTheme.typography.bodyMedium,
                color = muted,
            )
            FindLine(page, edits, canFind = !timeEnough(plan), focus)
            val canMove = canMoveDate(page)
            val canFocus = canChooseFocus(plan)
            if (canMove || canFocus) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (canMove) MoveDateSwitch(page, edits, focus)
                    if (canFocus) ChooseFocusAction(edits.chooseFocus)
                }
            }
        }
        if (pending) {
            Text(stringResource(R.string.plan_working_out_coverage), style = MaterialTheme.typography.bodyMedium, color = muted)
        }
    }
}

/**
 * Main's `invisible`: laid out, so the block keeps its height, but not placed, so it's neither drawn,
 * tapped nor read.
 */
private fun Modifier.hiddenIf(hidden: Boolean): Modifier =
    if (!hidden) {
        this
    } else {
        clearAndSetSemantics {}.layout { measurable, constraints ->
            val placeable = measurable.measure(constraints)
            layout(placeable.width, placeable.height) {}
        }
    }

/**
 * Main's `FindLine`: the answer, once found, in the coverage block's live region. An answer this
 * editor asked for is brought into view, which the latest change at a phone sheet's foot can cover.
 */
@Composable
private fun FindLine(
    page: PlanPageState,
    edits: PlanEdits,
    canFind: Boolean,
    focus: CoverageFocus,
) {
    val search = edits.timeToCover.forPlan(page.plan)
    val time = (search as? TimeToCoverState.Answered)?.time
    val answer = time?.answer()
    val pending = search is TimeToCoverState.Pending
    val retry = search is TimeToCoverState.Failed || search is TimeToCoverState.Building
    val fittingDate = time?.fittingDate?.takeIf { !page.isExam && answer !is TimeToCoverAnswer.Covers }
    val requester = remember { BringIntoViewRequester() }
    var asked by remember { mutableStateOf(false) }

    LaunchedEffect(search) {
        if (asked && !pending) {
            asked = false
            time?.let { focus.afterFound(it, page.isExam) }
            requester.bringIntoView()
        }
    }

    Column(Modifier.bringIntoViewRequester(requester), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (time != null) {
            val target = time.targetDate?.toJavaLocalDate()
            if (answer is TimeToCoverAnswer.Covers && target != null) {
                Text(
                    text = timeCoversText(answer.minutes, target, time.targetDateNamedMonth, page.today),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            if (answer is TimeToCoverAnswer.None && target != null) {
                Text(noTimeCoversText(target, time.targetDateNamedMonth, page.today), style = MaterialTheme.typography.bodyMedium)
            }
            if (answer is TimeToCoverAnswer.None && answer.coreMinutes != null) {
                Text(everyTopicText(answer.coreMinutes), style = MaterialTheme.typography.bodyMedium)
            }
            fittingDate?.let {
                Text(
                    fittingDateText(
                        page.plan.schedule.dailyMinutes
                            .toInt(),
                        it.toJavaLocalDate(),
                        page.today,
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        if (retry) {
            Text(
                text = stringResource(if (search is TimeToCoverState.Building) R.string.plan_find_building else R.string.plan_find_failed),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        if (time == null && (canFind || retry)) {
            val finding = stringResource(R.string.plan_finding)
            FilledTonalButton(
                onClick = {
                    asked = true
                    edits.findTimeToCover(page.plan) {}
                },
                modifier = if (pending) Modifier.semantics { stateDescription = finding } else Modifier,
            ) {
                PendingLabel(pending, stringResource(if (retry) R.string.plan_try_again else R.string.plan_find))
            }
        }
    }
}

private enum class MoveOutcome { Building, Failed, NoDate }

/**
 * Main's `MoveDateSwitch`: until the date is known, a tap finds it and the button names it; once
 * named, one tap moves it, saved as the schedule's change.
 */
@Composable
internal fun MoveDateSwitch(
    page: PlanPageState,
    edits: PlanEdits,
    focus: CoverageFocus,
) {
    var finding by remember { mutableStateOf(false) }
    var outcome by remember { mutableStateOf<MoveOutcome?>(null) }
    val date = (edits.timeToCover.forPlan(page.plan) as? TimeToCoverState.Answered)?.time?.fittingDate?.toJavaLocalDate()
    val pending = finding || edits.isPending(PlanPart.Schedule)

    fun move() {
        // Another change saving (a date picked, an Undo) is the learner's newer word.
        if (pending || edits.pending.isNotEmpty() || edits.latest?.undoing == true) return
        outcome = null
        if (date == null) {
            finding = true
            edits.findTimeToCover(page.plan) { found ->
                finding = false
                outcome =
                    when (found) {
                        is TimeToCoverOutcome.Answered -> if (found.time.fittingDate == null) MoveOutcome.NoDate else null
                        TimeToCoverOutcome.Building -> MoveOutcome.Building
                        TimeToCoverOutcome.Failed -> MoveOutcome.Failed
                        TimeToCoverOutcome.Stale -> null
                    }
            }
            return
        }
        edits.change(PlanPart.Schedule, listOf(PlanOp.TargetDate(date))) { if (it != null) focus.pickedTime.requestFocus() }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FilledTonalButton(onClick = ::move, modifier = Modifier.focusRequester(focus.moveDate)) {
            PendingLabel(
                pending = pending,
                text =
                    date?.let { stringResource(R.string.plan_move_date_to, formatDate(it, currentLocale(), DateStyle.Long, page.today)) }
                        ?: stringResource(R.string.plan_move_date),
            )
        }
        when (outcome) {
            MoveOutcome.Failed -> {
                SaveFailedText()
            }

            MoveOutcome.Building -> {
                ErrorLine(stringResource(R.string.plan_find_building))
            }

            MoveOutcome.NoDate -> {
                ErrorLine(stringResource(R.string.plan_find_no_date))
            }

            null -> {}
        }
    }
}

@Composable
private fun ErrorLine(text: String) {
    Text(text = text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
}

@Composable
internal fun ChooseFocusAction(onChoose: () -> Unit) {
    FilledTonalButton(onClick = onChoose) { Text(stringResource(R.string.plan_choose_focus)) }
}

/**
 * Main's `findFocusTarget`: where focus goes once the time that covers everything is found or the
 * date moves, since the control the learner tapped gives way.
 */
@Stable
internal class CoverageFocus {
    val offeredTime = FocusRequester()
    val pickedTime = FocusRequester()
    val moveDate = FocusRequester()
    val studyEverything = FocusRequester()

    fun timeChip(
        minutes: Int,
        offered: Int?,
        picked: Int,
    ): Modifier =
        Modifier
            .then(if (minutes == offered) Modifier.focusRequester(offeredTime) else Modifier)
            .then(if (minutes == picked) Modifier.focusRequester(pickedTime) else Modifier)

    /** The time offered, else Move date for a goal, else an exam's Study everything switch, else the time picked. */
    fun afterFound(
        time: PlanTimeToCover,
        isExam: Boolean,
    ) {
        val target =
            when {
                time.answer().offeredMinutes != null -> offeredTime
                !isExam && time.fittingDate != null -> moveDate
                isExam -> studyEverything
                else -> null
            }
        if (target?.requestFocus(FocusDirection.Enter) != true) pickedTime.requestFocus(FocusDirection.Enter)
    }
}

/** A button's label with a spinner before it while its work runs, as main's `PendingLabel`. */
@Composable
internal fun RowScope.PendingLabel(
    pending: Boolean,
    text: String,
) {
    if (pending) {
        CircularProgressIndicator(modifier = Modifier.size(ButtonDefaults.IconSize), color = LocalContentColor.current, strokeWidth = 2.dp)
        Spacer(Modifier.size(ButtonDefaults.IconSpacing))
    }
    Text(text)
}
