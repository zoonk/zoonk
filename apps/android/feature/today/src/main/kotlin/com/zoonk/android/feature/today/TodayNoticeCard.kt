package com.zoonk.android.feature.today

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.feature.exam.ExamChecklist
import com.zoonk.android.feature.exam.examDayText
import com.zoonk.android.feature.exam.examMomentTitle
import com.zoonk.android.feature.exam.examMomentWords
import com.zoonk.android.feature.exam.icon
import com.zoonk.android.feature.language.LanguagePracticeNotice
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.plan.ExamChoicePicks
import com.zoonk.android.feature.plan.PlanEffectDiff
import com.zoonk.android.feature.plan.examChoiceLeftOut
import com.zoonk.android.feature.plan.planChangeAppliedLine
import com.zoonk.android.feature.plan.planChangeSentence
import com.zoonk.android.feature.research.SourceChangeNotice
import com.zoonk.android.feature.research.UploadRequestNotice
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.Suggestion
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.components.SuggestionMainAction
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.components.SuggestionOpen
import com.zoonk.android.ui.components.SuggestionResult
import com.zoonk.android.ui.components.SuggestionSaveError
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ExamMoment
import com.zoonk.api.models.LanguageToday
import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.MemoryInsightPlanChange
import com.zoonk.api.models.SuggestedGoal
import com.zoonk.api.models.Today
import com.zoonk.api.models.TodayFocusTest

/** What a notice needs from the screen: its read, the answers it saves, and where it leads. */
internal class TodayNoticeState(
    val read: TodayRead.Day,
    /** The read isn't one shown while a newer one loads, such as the stored day on a return from a lesson. */
    val settled: Boolean,
    val viewModel: TodayViewModel,
    val navigate: (AppRoute) -> Unit,
    val language: LanguageToday? = null,
    val onboarding: OnboardingStore? = null,
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
    val viewModel = state.viewModel
    val picked = read.today.notice
    val opens = state.settled || viewModel.isAnsweringNotice
    LaunchedEffect(read.today.goal.id, read.day.localDate, picked, read.today.insight?.id, opens) {
        viewModel.holdNotice(read, picked, opens)
    }
    val hold = viewModel.heldNotice(read)

    when (hold?.kind ?: picked) {
        Today.Notice.EXAM -> {
            read.today.exam?.let { ExamMomentNotice(it, state, layout, modifier) }
        }

        Today.Notice.EXAM_CHOICE -> {
            ExamChoiceNotice(state, layout, modifier)
        }

        Today.Notice.PLAN_CHANGE -> {
            PlanChangeNotice(state, layout, modifier)
        }

        Today.Notice.INSIGHT -> {
            (read.today.insight ?: hold?.insight)?.let { InsightNotice(it, state, layout, modifier) }
        }

        Today.Notice.SUGGESTED_GOAL -> {
            read.today.suggestedGoal?.let { SuggestedGoalNotice(it, state, layout, modifier) }
        }

        Today.Notice.FOCUS_TEST -> {
            val dismissed = viewModel.focusTestDismissed?.takeIf { it.visit == read.noticeVisit() }
            (read.today.focusTest ?: dismissed?.test)?.let { FocusTestNotice(it, dismissed != null, state, layout, modifier) }
        }

        Today.Notice.PRACTICE -> {
            state.language?.let {
                LanguagePracticeNotice(read.today.goal.id, read.today.pattern, it.pronunciation, layout, state.navigate, modifier)
            }
        }

        Today.Notice.SOURCE_CHANGE -> {
            read.today.sourceChange?.let { SourceChangeNotice(it, layout, modifier) }
        }

        Today.Notice.UPLOAD_REQUEST -> {
            state.onboarding?.let {
                UploadRequestNotice(
                    read.today.goal.id,
                    read.today.uploadRequest,
                    it,
                    viewModel.visit,
                    layout,
                    modifier,
                    onAnswering = { viewModel.holdNotice(read, Today.Notice.UPLOAD_REQUEST, opens = true) },
                )
            }
        }

        null -> {}
    }
}

/** Main's `TodayExamMoment`: built from the suggestion's pieces like every other one; the exam page keeps the card. */
@Composable
private fun ExamMomentNotice(
    moment: ExamMoment,
    state: TodayNoticeState,
    layout: SuggestionLayout,
    modifier: Modifier,
) {
    val words = examMomentWords(moment) ?: return
    val title = examMomentTitle(moment)
    val afterExam = moment.stage == ExamMoment.Stage.AFTER_EXAM

    Suggestion(
        label = stringResource(R.string.today_notice_exam),
        summary = title,
        layout = layout,
        modifier = modifier,
        mark = SuggestionMark.Symbol(moment.stage.icon),
    ) {
        SuggestionHeader(title)
        moment.day?.takeUnless { afterExam }?.let {
            Text(examDayText(it), style = MaterialTheme.typography.bodyMedium.withTabularFigures())
        }
        SuggestionDescription(words)
        ExamChecklist(moment.checklist, moment.tools)
        SuggestionActions {
            SuggestionMainAction(stringResource(if (afterExam) R.string.exam_add_result else R.string.exam_see_exam), {
                close()
                state.navigate(AppRoute.Exam)
            })
        }
    }
}

/** Equal options, so one under the other in their order, never one as the main answer. */
@Composable
private fun ExamChoiceNotice(
    state: TodayNoticeState,
    layout: SuggestionLayout,
    modifier: Modifier,
) {
    val viewModel = state.viewModel
    val label = stringResource(R.string.today_notice_exam_choice)
    val mark = SuggestionMark.Symbol(R.drawable.ic_signpost)
    val saving = viewModel.isSavingExamChoice
    val made = viewModel.examChoiceMade?.takeIf { it.visit == state.read.noticeVisit() }

    if (made != null) {
        val sentence =
            planChangeSentence(made.change, state.read.today.goal.dateKind)
        val undo: (@Composable () -> Unit)? =
            if (made.change.canUndo) {
                {
                    SuggestionAction(
                        stringResource(R.string.today_undo),
                        { viewModel.undoExamChoice(made) },
                        busy = saving,
                        secondary = true,
                        leadingIcon = { ButtonIcon(R.drawable.ic_undo) },
                    )
                }
            } else {
                null
            }

        Suggestion(
            label = label,
            summary = sentence,
            layout = layout,
            modifier = modifier,
            mark = mark,
            answered = true,
            lineAction = undo,
        ) {
            SuggestionResult(sentence)
            PlanEffectDiff(made.change.effect, dateKind = state.read.today.goal.dateKind)
            undo?.let { SuggestionActions { it() } }
            if (viewModel.examChoiceFailedOn == state.read.noticeVisit()) SuggestionSaveError()
        }
        return
    }

    val choice = state.read.today.examChoice ?: return
    val question =
        stringResource(
            if (choice.take >
                1
            ) {
                R.string.today_exam_choice_question_several
            } else {
                R.string.today_exam_choice_question
            },
            choice.group,
        )
    val choose = { subjects: List<String> -> viewModel.chooseExamOption(state.read, choice.group, subjects) }

    Suggestion(
        label = label,
        summary = question,
        layout = layout,
        modifier = modifier,
        mark = mark,
        lineAction = { SuggestionOpen(stringResource(R.string.today_exam_choice_choose)) },
    ) {
        SuggestionHeader(question)
        SuggestionDescription(examChoiceLeftOut(choice))
        if (choice.take > 1) {
            ExamChoicePicks(choice, saving, onSave = choose)
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                choice.options.forEach { option ->
                    SuggestionAction(
                        text = option.shortName ?: option.name,
                        onClick = { choose(listOf(option.name)) },
                        enabled = !saving,
                        secondary = true,
                    )
                }
            }
        }
        if (viewModel.examChoiceFailedOn == state.read.noticeVisit()) SuggestionSaveError()
    }
}

private fun TodayViewModel.heldNotice(read: TodayRead.Day) =
    noticeHold?.takeIf { it.goalId == read.today.goal.id && it.date == read.day.localDate }

/** The notice Today shows, as main counts it: an insight. */
internal fun TodayViewModel.noticeEvent(read: TodayRead.Day): AnalyticsEvent? {
    val hold = heldNotice(read)
    return when (hold?.kind ?: read.today.notice) {
        Today.Notice.INSIGHT -> (read.today.insight ?: hold?.insight)?.let { AnalyticsEvent.InsightShown(it.id, it.kind) }
        else -> null
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
                secondary = true,
            )
        }
        if (viewModel.answerFailed) SuggestionSaveError()
    }
}

/** The Focus test in a short plan's first week, once: "Not now" stops the suggestion for this goal. */
@Composable
private fun FocusTestNotice(
    test: TodayFocusTest,
    dismissed: Boolean,
    state: TodayNoticeState,
    layout: SuggestionLayout,
    modifier: Modifier,
) {
    val viewModel = state.viewModel
    val result = if (dismissed) stringResource(R.string.focustest_suggestion_dismissed) else null
    val goalId = state.read.today.goal.id

    Suggestion(
        label = stringResource(R.string.focustest_title),
        summary = result ?: stringResource(R.string.focustest_suggestion_line),
        layout = layout,
        modifier = modifier,
        mark = SuggestionMark.Symbol(R.drawable.ic_my_location),
        answered = result != null,
        lineAction = if (result != null) null else ({ SuggestionOpen() }),
    ) {
        SuggestionHeader(stringResource(R.string.focustest_find_focus))
        if (result != null) {
            SuggestionResult(result)
        } else {
            SuggestionDescription(stringResource(R.string.focustest_suggestion_body, formatMinutes(test.minutes.toInt(), currentLocale())))
            SuggestionActions {
                SuggestionMainAction(
                    text = stringResource(R.string.focustest_start),
                    onClick = {
                        close()
                        state.navigate(AppRoute.FocusTest(goalId.toString(), start = true))
                    },
                )
                SuggestionAction(
                    text = stringResource(R.string.focustest_not_now),
                    onClick = { viewModel.dismissFocusTest(state.read, test) },
                    busy = viewModel.isDismissingFocusTest,
                    secondary = true,
                )
            }
        }
        if (viewModel.focusTestFailedOn == state.read.noticeVisit()) SuggestionSaveError()
    }
}

@Composable
private fun InsightNotice(
    opened: MemoryInsight,
    state: TodayNoticeState,
    layout: SuggestionLayout,
    modifier: Modifier,
) {
    val viewModel = state.viewModel
    val repriced = viewModel.repricedInsights[opened.id]
    val insight = repriced ?: opened
    val answer = viewModel.insightAnswers[insight.id]
    val result = answer?.takeIf { it != InsightAnswer.Failed }?.let { insightResult(insight, it) }
    val label = stringResource(R.string.today_insight_label)
    val proposed = insight.planChange?.status == MemoryInsightPlanChange.Status.PROPOSED

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
        if (proposed) PlanEffectDiff(insight.planChange?.effect, dateKind = state.read.today.goal.dateKind, repriced = repriced != null)
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
                    stringResource(R.string.today_insight_keep_it) to stringResource(R.string.today_undo)
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
        // A tip's only answer is secondary, so Today's own action stays the screen's one filled button.
        if (canAccept) SuggestionAction(accept, { viewModel.answerInsight(insight, accepted = true) }, enabled, secondary = dismiss == null)
        dismiss?.let { SuggestionAction(it, { viewModel.answerInsight(insight, accepted = false) }, enabled, secondary = true) }
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
