package com.zoonk.android.feature.today

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.plan.PlanEnd
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.plan.planChangeAppliedLine
import com.zoonk.android.feature.plan.planChangeProposalEffect
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
import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.MemoryInsightPlanChange
import com.zoonk.api.models.SuggestedGoal
import kotlinx.datetime.toJavaLocalDate

/** What a notice needs from the screen: its read, the answers it saves, and where it leads. */
internal class TodayNoticeState(
    val read: TodayRead.Day,
    val viewModel: TodayViewModel,
    val navigate: (AppRoute) -> Unit,
    val plans: PlanStore? = null,
    val host: HostNotices = HostNotices(),
)

/**
 * The notice picked when Today opened stays while the learner is here, so answering it shows what
 * the answer did; the next waits for the next visit.
 */
@Composable
internal fun TodayNotice(
    state: TodayNoticeState,
    layout: SuggestionLayout,
    modifier: Modifier = Modifier,
) {
    val read = state.read
    val picked = pickTodayNotice(read.today, read.day, state.host)
    var shown by remember(read.today.goal.id) { mutableStateOf<TodayNoticeKind?>(null) }
    LaunchedEffect(picked) { if (shown == null) shown = picked }

    when (shown ?: picked) {
        TodayNoticeKind.ExamAccess -> ExamAccessNotice(state, layout, modifier)
        TodayNoticeKind.Insight -> InsightNotice(state, layout, modifier)
        TodayNoticeKind.SuggestedGoal -> read.today.suggestedGoal?.let { SuggestedGoalNotice(it, state, layout, modifier) }
        else -> Unit
    }
}

@Composable
private fun ExamAccessNotice(
    state: TodayNoticeState,
    layout: SuggestionLayout,
    modifier: Modifier,
) {
    if (!state.read.day.examAccess.trialEnded) return

    val title = stringResource(R.string.subscription_free_week_over_title)
    val seePlus = stringResource(R.string.subscription_see_plus)
    val openPlus = { state.navigate(AppRoute.Subscription) }

    Suggestion(
        label = stringResource(R.string.today_notice_exam_access),
        summary = title,
        layout = layout,
        modifier = modifier,
        mark = SuggestionMark.Symbol(R.drawable.ic_auto_awesome),
        lineAction = { SuggestionAction(seePlus, openPlus, outlined = true) },
    ) {
        SuggestionHeader(title)
        SuggestionDescription(stringResource(R.string.subscription_free_week_over_description))
        SuggestionActions { SuggestionAction(seePlus, openPlus, outlined = true) }
    }
}

@Composable
private fun SuggestedGoalNotice(
    suggestion: SuggestedGoal,
    state: TodayNoticeState,
    layout: SuggestionLayout,
    modifier: Modifier,
) {
    val viewModel = state.viewModel
    val question = stringResource(R.string.today_suggested_goal_question, suggestion.title)

    Suggestion(
        label = stringResource(R.string.today_notice_suggested_goal),
        summary = question,
        layout = layout,
        modifier = modifier,
        mark = SuggestionMark.Symbol(R.drawable.ic_explore),
    ) {
        SuggestionHeader(question)
        SuggestionDescription(stringResource(R.string.today_suggested_goal_detail))
        SuggestionActions {
            SuggestionAction(
                text = stringResource(R.string.today_suggested_goal_accept),
                onClick = { viewModel.answer(suggestion, accepted = true, hasGoal = true) },
                enabled = !viewModel.isAnswering,
            )
            SuggestionAction(
                text = stringResource(R.string.today_not_now),
                onClick = { viewModel.answer(suggestion, accepted = false, hasGoal = true) },
                enabled = !viewModel.isAnswering,
                outlined = true,
            )
        }
        if (viewModel.answerFailed) SuggestionSaveError()
    }
}

/** Answering refreshes Today, which then no longer carries the insight; the card stays to show what the answer did. */
@Composable
private fun InsightNotice(
    state: TodayNoticeState,
    layout: SuggestionLayout,
    modifier: Modifier,
) {
    val current = state.read.today.insight
    var held by remember { mutableStateOf(current) }
    LaunchedEffect(current?.id) { if (current != null) held = current }
    val insight = current ?: held ?: return

    val viewModel = state.viewModel
    val answer = viewModel.insightAnswers[insight.id]
    val result = answer?.takeIf { it != InsightAnswer.Failed }?.let { insightResult(insight, it) }
    val label = stringResource(R.string.today_insight_label)
    val proposed = insight.planChange?.status == MemoryInsightPlanChange.Status.PROPOSED
    val effect = if (proposed) planChangeProposalEffect(insight.planChange?.effect, planEnd(state)) else null

    Suggestion(
        label = label,
        summary = result ?: insight.message,
        layout = layout,
        modifier = modifier,
        mark = insight.mark(),
        answered = result != null,
        lineAction = if (result != null) null else ({ SuggestionOpen() }),
    ) {
        SuggestionHeader(label)
        SuggestionDescription(insight.message)
        effect?.let { SuggestionDescription(it) }
        if (result != null) {
            SuggestionResult(result)
        } else {
            InsightActions(insight, viewModel)
        }
        if (answer == InsightAnswer.Failed) SuggestionSaveError()
    }
}

private fun MemoryInsight.mark(): SuggestionMark =
    when {
        kind == MemoryInsight.Kind.TIP -> SuggestionMark.Symbol(R.drawable.ic_lightbulb)
        planChange?.status == MemoryInsightPlanChange.Status.APPLIED -> SuggestionMark.Symbol(R.drawable.ic_playlist_add)
        else -> SuggestionMark.New
    }

@Composable
private fun InsightActions(
    insight: MemoryInsight,
    viewModel: TodayViewModel,
) {
    val enabled = !viewModel.isAnsweringInsight
    val applied = insight.planChange?.status == MemoryInsightPlanChange.Status.APPLIED
    val (accept, dismiss) =
        when (insight.kind) {
            MemoryInsight.Kind.PLAN_CHANGE -> {
                if (applied) {
                    stringResource(R.string.today_insight_keep_it) to stringResource(R.string.today_insight_undo)
                } else {
                    stringResource(R.string.today_insight_add_it) to stringResource(R.string.today_insight_no_thanks)
                }
            }

            MemoryInsight.Kind.SCHEDULE_IDEA -> {
                stringResource(R.string.today_insight_move_time, insight.studyTime.orEmpty()) to stringResource(R.string.today_not_now)
            }

            MemoryInsight.Kind.TIP -> {
                stringResource(R.string.today_insight_got_it) to null
            }
        }
    val canAccept = insight.kind != MemoryInsight.Kind.PLAN_CHANGE || applied || insight.planChange?.canApply == true

    SuggestionActions {
        // A tip's only answer is outlined, so Today's own action stays the screen's one filled button.
        if (canAccept) SuggestionAction(accept, { viewModel.answerInsight(insight, accepted = true) }, enabled, outlined = dismiss == null)
        dismiss?.let { SuggestionAction(it, { viewModel.answerInsight(insight, accepted = false) }, enabled, outlined = true) }
    }
}

@Composable
private fun insightResult(
    insight: MemoryInsight,
    answer: InsightAnswer,
): String {
    val accepted = answer == InsightAnswer.Accepted
    return when (insight.kind) {
        MemoryInsight.Kind.PLAN_CHANGE -> {
            if (accepted) planChangeAppliedLine(null) else stringResource(R.string.today_plan_stays)
        }

        MemoryInsight.Kind.SCHEDULE_IDEA -> {
            stringResource(
                if (accepted) R.string.today_insight_time_moved else R.string.today_insight_time_stays,
            )
        }

        MemoryInsight.Kind.TIP -> {
            stringResource(R.string.today_noted)
        }
    }
}

/** A plan with a date says what a change does to it; one without reads its estimated end from the plan. */
@Composable
private fun planEnd(state: TodayNoticeState): PlanEnd {
    val goal = state.read.today.goal
    val plans = state.plans
    if (goal.targetDate != null || plans == null) return PlanEnd(goal.targetDate?.toJavaLocalDate(), null)
    val plan by plans.plan[goal.id].collectShown()
    return PlanEnd(
        null,
        plan.value
            ?.plan
            ?.estimate
            ?.endDate
            ?.toJavaLocalDate(),
    )
}
