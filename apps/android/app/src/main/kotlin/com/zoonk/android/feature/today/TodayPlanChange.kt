package com.zoonk.android.feature.today

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.plan.PlanEffectDiff
import com.zoonk.android.feature.plan.countsByDate
import com.zoonk.android.feature.plan.planChangeAppliedLine
import com.zoonk.android.feature.plan.planChangeKeepOfficialDateLabel
import com.zoonk.android.feature.plan.planChangeOfficialDateLine
import com.zoonk.android.feature.plan.planChangeProposalEffect
import com.zoonk.android.feature.plan.planChangeSentence
import com.zoonk.android.feature.plan.topicsMoved
import com.zoonk.android.feature.session.FreshStart
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Suggestion
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.components.SuggestionOpen
import com.zoonk.android.ui.components.SuggestionResult
import com.zoonk.android.ui.components.SuggestionSaveError
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeBehind
import com.zoonk.api.models.PlanChangeDecisionInput
import com.zoonk.api.models.TodayGoal
import kotlinx.datetime.toJavaLocalDate

/**
 * Only when the learner has a say: what the plan does on its own isn't news on Today. An answer
 * here stays to show what it did; a change answered elsewhere leaves with Today's next read.
 */
@Composable
internal fun PlanChangeNotice(
    state: TodayNoticeState,
    layout: SuggestionLayout,
    modifier: Modifier,
) {
    val viewModel = state.viewModel
    val answer = viewModel.planChangeAnswer?.takeIf { it.change.status != PlanChange.Status.PROPOSED }
    val change = answer?.change ?: viewModel.planChangeAnswer?.change ?: state.read.today.planChange ?: return
    val behind = change.behind

    if (change.kind == MISSED_DAYS && behind != null) {
        FallingBehindNotice(change, behind, state, layout, modifier)
    } else {
        ChangeNotice(change, answer, state, layout, modifier)
    }
}

@Composable
private fun ChangeNotice(
    change: PlanChange,
    answer: PlanChangeAnswer?,
    state: TodayNoticeState,
    layout: SuggestionLayout,
    modifier: Modifier,
) {
    val viewModel = state.viewModel
    val today = state.read.today
    val goalId = today.goal.id
    val dateAhead =
        today.goal
            .takeIf { (it.daysLeft ?: 0) > 0 }
            ?.targetDate
            ?.toJavaLocalDate()
    val sentence = planChangeSentence(change, dateAhead)
    val title = if (change.source == NOTICE_SOURCE) null else stringResource(R.string.today_plan_suggestion)
    val result = answer?.let { answeredText(it) }
    val byDate = change.status == PlanChange.Status.PROPOSED || countsByDate(change.effect, dateAhead)
    val effect = planChangeProposalEffect(change.effect, planEnd(state), besideDiff = true, byDate = byDate)
    val officialDate = planChangeOfficialDateLine(change)
    val saving = viewModel.isSavingPlanChange
    val next = today.planChange?.takeIf { answer != null && it.status == PlanChange.Status.PROPOSED && it.id != change.id }
    val after: (@Composable () -> Unit)? =
        when {
            answer == null -> {
                null
            }

            next != null -> {
                { SuggestionAction(stringResource(R.string.today_next_suggestion), viewModel::nextPlanChange, secondary = true) }
            }

            answer.status == PlanChangeDecisionInput.Status.APPLIED && answer.change.canUndo -> {
                {
                    SuggestionAction(
                        text = stringResource(R.string.today_undo),
                        onClick = { viewModel.decidePlanChange(goalId, answer.change, PlanChangeDecisionInput.Status.UNDONE) },
                        enabled = !saving,
                        secondary = true,
                    )
                }
            }

            else -> {
                null
            }
        }

    Suggestion(
        label = stringResource(R.string.today_notice_plan_change),
        summary = result ?: sentence,
        layout = layout,
        modifier = modifier,
        mark = if (change.source == NOTICE_SOURCE) SuggestionMark.Symbol(R.drawable.ic_pending_actions) else SuggestionMark.New,
        answered = result != null,
        lineAction = if (result != null) after else ({ SuggestionOpen() }),
    ) {
        SuggestionHeader(title ?: sentence)
        if (title != null) SuggestionDescription(sentence)
        effect?.let { SuggestionDescription(it) }
        PlanEffectDiff(change.effect, byDate = byDate)
        officialDate?.let { SuggestionDescription(it) }

        if (result != null) {
            SuggestionResult(result)
            after?.let { SuggestionActions { it() } }
        } else {
            ChangeActions(change, enabled = !saving) { status -> viewModel.decidePlanChange(goalId, change, status) }
        }

        if (viewModel.planChangeFailed) SuggestionSaveError()
    }
}

/** Answering the notice or the phase dates keeps what the learner has, and the answer stays. */
@Composable
private fun ChangeActions(
    change: PlanChange,
    enabled: Boolean,
    onAnswer: (PlanChangeDecisionInput.Status) -> Unit,
) {
    val overridesNotice = change.officialDate != null
    val keepsMine = change.source == NOTICE_SOURCE || change.source == PHASE_DATES_SOURCE
    val decline =
        when {
            overridesNotice -> planChangeKeepOfficialDateLabel(change.examDocument)
            keepsMine -> stringResource(R.string.today_plan_keep_mine)
            else -> stringResource(R.string.today_not_now)
        }

    SuggestionActions {
        if (change.canApply) {
            SuggestionAction(
                text = stringResource(if (overridesNotice) R.string.today_plan_use_my_date else R.string.today_plan_apply),
                onClick = { onAnswer(PlanChangeDecisionInput.Status.APPLIED) },
                enabled = enabled,
            )
        }
        SuggestionAction(decline, { onAnswer(PlanChangeDecisionInput.Status.DECLINED) }, enabled = enabled, secondary = true)
    }
}

@Composable
private fun answeredText(answer: PlanChangeAnswer): String =
    when (answer.status) {
        PlanChangeDecisionInput.Status.APPLIED -> planChangeAppliedLine(answer.change.todaySession)
        PlanChangeDecisionInput.Status.DECLINED -> stringResource(R.string.today_plan_stays)
        PlanChangeDecisionInput.Status.UNDONE -> stringResource(R.string.plan_change_undone)
        PlanChangeDecisionInput.Status.SEEN -> stringResource(R.string.today_noted)
    }

/** Keeping their time changes nothing: the learner's "seen" is their answer. */
@Composable
private fun FallingBehindNotice(
    change: PlanChange,
    behind: PlanChangeBehind,
    state: TodayNoticeState,
    layout: SuggestionLayout,
    modifier: Modifier,
) {
    val viewModel = state.viewModel
    val today = state.read.today
    val locale = currentLocale()
    val values =
        arrayOf(
            formatMinutes(behind.currentMinutes.toInt(), locale),
            formatPercent(behind.coveredAfter, locale),
            formatPercent(behind.coveredBefore, locale),
        )
    val sentence =
        if (behind.measure == PlanChangeBehind.Measure.EXAM) {
            stringResource(R.string.today_behind_exam, *values)
        } else {
            stringResource(R.string.today_behind_goal, *values)
        }
    val kept = viewModel.planChangeAnswer?.takeIf { it.change.id == change.id && it.status == PlanChangeDecisionInput.Status.SEEN } != null
    val result = if (kept) stringResource(R.string.today_behind_kept) else null

    Suggestion(
        label = stringResource(R.string.today_notice_falling_behind),
        summary = result ?: sentence,
        layout = layout,
        modifier = modifier,
        mark = SuggestionMark.Symbol(R.drawable.ic_calendar_clock),
        answered = kept,
        lineAction = if (kept) null else ({ SuggestionOpen() }),
    ) {
        SuggestionHeader(sentence)
        topicsMoved(change.effect, named = NAMED_TOPICS)?.let { SuggestionDescription(it) }

        if (result != null) {
            SuggestionResult(result)
        } else {
            BehindChoices(
                behind,
                today.goal.kind,
                welcomeBack = state.read.day.freshStart == FreshStart.WelcomeBack,
                enabled = !viewModel.isSavingPlanChange,
            ) { route ->
                if (route == null) {
                    viewModel.decidePlanChange(today.goal.id, change, PlanChangeDecisionInput.Status.SEEN)
                } else {
                    close()
                    state.navigate(route)
                }
            }
        }

        if (viewModel.planChangeFailed) SuggestionSaveError()
    }
}

private enum class BehindOption { AdjustTime, Focus, Keep, StudyEverything }

/** On a return after a break, nothing that asks for more hours leads. A null route is "Keep my time". */
@Composable
private fun BehindChoices(
    behind: PlanChangeBehind,
    goalKind: TodayGoal.Kind,
    welcomeBack: Boolean,
    enabled: Boolean,
    onChoose: (AppRoute?) -> Unit,
) {
    val primary =
        when {
            !welcomeBack -> BehindOption.AdjustTime
            behind.canFocus -> BehindOption.Focus
            else -> null
        }
    val order =
        if (welcomeBack) {
            listOf(BehindOption.Focus, BehindOption.Keep, BehindOption.AdjustTime, BehindOption.StudyEverything)
        } else {
            listOf(BehindOption.AdjustTime, BehindOption.Focus, BehindOption.StudyEverything, BehindOption.Keep)
        }
    val shown = listOfNotNull(primary) + order.filter { it != primary && (it != BehindOption.Focus || behind.canFocus) }

    SuggestionActions {
        shown.forEach { option ->
            val secondary = option != primary
            when (option) {
                BehindOption.AdjustTime -> {
                    val label =
                        if (goalKind ==
                            TodayGoal.Kind.EXAM
                        ) {
                            R.string.today_more_time_a_day
                        } else {
                            R.string.today_more_time_or_later_date
                        }
                    SuggestionAction(stringResource(label), { onChoose(AppRoute.Plan(focus = "time")) }, secondary = secondary)
                }

                BehindOption.Focus -> {
                    SuggestionAction(
                        stringResource(R.string.today_choose_focus),
                        { onChoose(AppRoute.Plan(focus = "choose")) },
                        secondary = secondary,
                    )
                }

                BehindOption.StudyEverything -> {
                    SuggestionAction(
                        stringResource(R.string.today_study_everything),
                        { onChoose(AppRoute.Plan(focus = "everything")) },
                        secondary = secondary,
                    )
                }

                BehindOption.Keep -> {
                    SuggestionAction(
                        stringResource(R.string.today_keep_my_time),
                        { onChoose(null) },
                        enabled = enabled,
                        secondary = secondary,
                    )
                }
            }
        }
    }
}

private const val MISSED_DAYS = "missedDays"
private const val NOTICE_SOURCE = "notice"
private const val PHASE_DATES_SOURCE = "phaseDates"
private const val NAMED_TOPICS = 2
