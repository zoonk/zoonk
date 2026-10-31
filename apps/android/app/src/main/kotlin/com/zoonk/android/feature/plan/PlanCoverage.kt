package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.layout
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.PendingLabel
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanFeasibility
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate

/** Null when the plan covers everything in depth or has no date to cover it by. */
internal fun planCoverage(plan: Plan): PlanFeasibility? = plan.feasibility?.takeIf { it.deadline != null && !it.fits }

/** The learner's own time covers everything once planned again at it, so no other time is offered. */
internal fun timeEnough(plan: Plan): Boolean = plan.feasibility?.timeCovers ?: false

internal fun canMoveDate(page: PlanPageState): Boolean = !page.isExam && planCoverage(page.plan) != null && !timeEnough(page.plan)

/** Main's `useCoveredText`: what the time a day covers by the date. */
@Composable
internal fun coveredText(
    plan: Plan,
    coverage: PlanFeasibility,
    today: LocalDate,
): String {
    val target = plan.schedule.targetDate
    if (coverage.coveredShare < MIN_SHOWN_SHARE || target == null) {
        return stringResource(R.string.plan_covered_not_enough, formatMinutes(plan.schedule.dailyMinutes.toInt(), currentLocale()))
    }
    return shareText(
        GoalDate(target, plan.schedule.targetDateNamedMonth),
        exam = coverage.measure == PlanFeasibility.Measure.EXAM,
        share = coverage.coveredShare,
        today = today,
    )
}

/** Below half a percent, the share would read "0%". */
private const val MIN_SHOWN_SHARE = 0.005

private const val DAYS_PER_WEEK = 7

/** A goal's date as learn's `useGoalDateValues` writes it: a date standing for its month says the month. */
@Composable
internal fun goalDate(
    date: LocalDate,
    namedMonth: Boolean,
    today: LocalDate,
    style: DateStyle = DateStyle.Long,
): String = formatDate(date, currentLocale(), if (namedMonth) DateStyle.Month else style, today)

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

/**
 * Main's `DailyCoverage`, under the time a day: the time question's whole answer for the plan's own
 * [minutes]. While the schedule's change saves, its place says the new coverage is being worked
 * out: the old one would describe a time no longer picked.
 */
@Composable
internal fun DailyCoverage(
    page: PlanPageState,
    edits: PlanEdits,
    focus: CoverageFocus,
    minutes: Int,
    onUseTime: (Int) -> Unit,
) {
    val plan = page.plan
    val pending = edits.isPending(PlanPart.Schedule)
    val feasibility = plan.feasibility
    val target = plan.schedule.targetDate
    if (feasibility?.deadline == null || target == null) {
        FinishLine(page, pending)
        return
    }
    val date = GoalDate(target, plan.schedule.targetDateNamedMonth)
    val search = edits.timeToCover.forPlan(plan)
    val found = (search as? TimeToCoverState.Answered)?.time
    val line =
        timeLine(
            advice = LineAdvice(coveredShare = if (feasibility.fits) 1.0 else feasibility.coveredShare, endDate = null),
            askFailed = false,
            dated = true,
            findFailed = false,
            found = found,
            hasDays = true,
            minutes = minutes,
        )
    val studiesEveryDay = plan.schedule.weekdayMinutes.count { it > 0 } == DAYS_PER_WEEK
    val fittingDate = found?.fittingDate?.takeIf { !page.isExam && line !is TimeLine.Everything }
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    Box {
        Column(Modifier.hiddenIf(pending), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (plan.fitOffer?.fits == true) {
                Text(
                    text =
                        stringResource(
                            if (date.namedMonth) R.string.plan_time_covers_everything_by_month else R.string.plan_time_covers_everything_by,
                            goalDateText(date, page.today),
                        ),
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    style = MaterialTheme.typography.bodyMedium,
                    color = muted,
                )
            } else {
                TimeAnswer(
                    date = date,
                    exam = page.isExam,
                    line = line,
                    minutes = minutes,
                    note = fullTimeNote(found, line, studiesEveryDay),
                    noteStatus = noteStatus(search),
                    offer = timeOffer(found, line, minutes),
                    offerAsButton = true,
                    onRetry = { edits.findTimeToCover(plan) {} },
                    onUseOffer = {
                        onUseTime(it)
                        // The button goes once its time is the plan's, so the keyboard waits on the picker.
                        focus.pickedTime.requestFocus()
                    },
                    today = page.today,
                )
            }
            fittingDate?.let {
                Text(
                    fittingDateText(plan.schedule.dailyMinutes.toInt(), it.toJavaLocalDate(), page.today),
                    style = MaterialTheme.typography.bodyMedium,
                    color = muted,
                )
            }
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
            Text(
                stringResource(R.string.plan_working_out_coverage),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                style = MaterialTheme.typography.bodyMedium,
                color = muted,
            )
        }
    }
}

/** The answer is asked as the editor opens, so a search not answered yet is being found. */
private fun noteStatus(search: TimeToCoverState): NoteStatus? =
    when (search) {
        is TimeToCoverState.Answered -> null
        is TimeToCoverState.Failed, is TimeToCoverState.Building -> NoteStatus.Failed
        TimeToCoverState.Idle, is TimeToCoverState.Pending -> NoteStatus.Finding
    }

/** Main's `PlanFinish`: when a plan without a date finishes. */
@Composable
private fun FinishLine(
    page: PlanPageState,
    pending: Boolean,
) {
    val end =
        page.plan.estimate.endDate
            ?.toJavaLocalDate()
    // The end is the saved schedule's last day, laid out again only by a change: once it has
    // passed, it no longer says when the learner finishes.
    if (end == null || end < page.today || page.plan.end != null) return

    Text(
        text =
            if (pending) {
                stringResource(R.string.plan_finish_working)
            } else {
                stringResource(R.string.plan_finish_around, formatDate(end, currentLocale(), DateStyle.Month))
            },
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
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

/** Where focus goes once the date moves or a time is used, since the control the learner tapped gives way. */
@Stable
internal class CoverageFocus {
    val pickedTime = FocusRequester()
    val moveDate = FocusRequester()
    val studyEverything = FocusRequester()
}
