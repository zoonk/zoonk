package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.feature.onboarding.AdviceQuery
import com.zoonk.android.feature.onboarding.CoverQuery
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.start.text
import com.zoonk.android.feature.plan.DaySplit
import com.zoonk.android.feature.plan.GoalDate
import com.zoonk.android.feature.plan.TimeAnswer
import com.zoonk.android.feature.plan.lineAdvice
import com.zoonk.android.feature.plan.suggestedMinutes
import com.zoonk.android.feature.plan.timeLine
import com.zoonk.android.feature.plan.timeOffer
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.ui.components.ButtonEdge
import com.zoonk.android.ui.components.DailyTimePicker
import com.zoonk.android.ui.components.ForwardIcon
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.WeekdayPicker
import com.zoonk.android.ui.components.WeekendTime
import com.zoonk.android.ui.components.missingDays
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.Goal
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingAnswerInputOneOf9
import com.zoonk.api.models.OnboardingPlanReadiness
import com.zoonk.api.models.OnboardingTimeChoicesInner
import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeToCover
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toJavaLocalDate
import java.util.TimeZone

@Composable
internal fun ColumnScope.ScheduleStep(
    goal: Goal,
    recommendedMinutes: Int,
    timeChoices: List<OnboardingTimeChoicesInner>,
    planReadiness: OnboardingPlanReadiness,
    run: GenerationRun,
    store: OnboardingStore,
    vm: GoalSetupViewModel,
    pending: Boolean,
    startsOnRecommended: Boolean,
) {
    var choice by rememberSaveable(stateSaver = jsonSaver(ScheduleChoice.serializer())) {
        mutableStateOf(ScheduleChoice(startingDays(goal.studyDays.map(Long::toInt))))
    }
    // What the learner set is theirs, so a new date keeps it; what it covers starts over for the date.
    ForDate(goal.targetDate) {
        ScheduleTime(
            goal,
            recommendedMinutes,
            timeChoices,
            planReadiness,
            run,
            store,
            vm,
            pending,
            choice,
            startsOnRecommended,
        ) {
            choice =
                it
        }
    }
}

/** A new date starts its content over, and what was kept for the date before is dropped. */
@Composable
private fun ForDate(
    date: LocalDate?,
    content: @Composable () -> Unit,
) {
    val dates = rememberSaveableStateHolder()
    val key = date?.toString().orEmpty()
    var shown by rememberSaveable { mutableStateOf(key) }
    dates.SaveableStateProvider(key, content)
    LaunchedEffect(key) {
        if (shown != key) dates.removeState(shown)
        shown = key
    }
}

@Composable
private fun ColumnScope.ScheduleTime(
    goal: Goal,
    recommendedMinutes: Int,
    timeChoices: List<OnboardingTimeChoicesInner>,
    planReadiness: OnboardingPlanReadiness,
    run: GenerationRun,
    store: OnboardingStore,
    vm: GoalSetupViewModel,
    pending: Boolean,
    choice: ScheduleChoice,
    startsOnRecommended: Boolean,
    onChoiceChange: (ScheduleChoice) -> Unit,
) {
    val exam = goal.kind == Goal.Kind.EXAM
    val picked = choice.picked
    var pickedSplit by rememberSaveable(stateSaver = DaySplitSaver) { mutableStateOf<DaySplit?>(null) }
    val days = choice.days
    val weekend = choice.weekend
    val hasDays = days.isNotEmpty()
    val paused = run.isStopped

    val covering =
        rememberPlanAnswer(
            store.timesToCover,
            CoverQuery(goal, findWeek(days, weekend).coverInput()),
            enabled = (goal.targetDate != null || exam) && hasDays,
            paused = paused,
            planMade = run.planMade,
            querySerializer = CoverQuery.serializer(),
            serializer = PlanTimeToCover.serializer(),
            ready = { it.ready },
        )
    val found = covering.answer?.takeIf { it.ready }
    val lastFound = covering.last?.takeIf { it.ready }
    val first = covering.first
    val dated = lastFound?.let { it.targetDate != null } ?: (goal.targetDate != null || exam)
    val findFailed = covering.status == PollStatus.Failed
    val shownFound = found ?: lastFound
    val minutes =
        shownMinutes(
            recommendedMinutes,
            first,
            shownFound,
            picked,
            settled = !dated || findFailed,
            startsOnRecommended = startsOnRecommended,
        )
    val asked = studyWeek(days, minutes ?: recommendedMinutes, weekend)

    val aim =
        LocalSetupAim.current.aim
            ?.aim
            ?.value
    val timeAdvice =
        rememberPlanAnswer(
            store.timeAdvice,
            AdviceQuery(
                goal,
                asked.adviceInput(minutes ?: recommendedMinutes).copy(
                    aim =
                        com.zoonk.api.models.PlanTimeAdviceInput.Aim.entries.firstOrNull {
                            it.value ==
                                aim
                        },
                ),
            ),
            enabled = hasDays && asksAboutTime(dated, minutes),
            paused = paused,
            planMade = run.planMade,
            querySerializer = AdviceQuery.serializer(),
            serializer = PlanTimeAdvice.serializer(),
            ready = { it.ready },
            scope = {
                it.input.aim
                    ?.value
                    .orEmpty()
            },
        )
    val advice = timeAdvice.answer?.takeIf { it.ready }
    val askFailed = timeAdvice.status == PollStatus.Failed
    val lineAt = { lineAdvice: PlanTimeAdvice?, lineFound: PlanTimeToCover? ->
        timeLine(lineAdvice?.lineAdvice(), askFailed, dated, findFailed, lineFound, hasDays, minutes)
    }
    val line = lineAt(advice, found)
    val lastAdvice = advice ?: timeAdvice.last?.takeIf { it.ready }
    val shown =
        shownAnswer(
            last = TimeAnswerState(shownFound, lineAt(lastAdvice, shownFound)),
            now = TimeAnswerState(found, line),
        )

    val coverGate = covering.last?.let { PlanGate(it.ready, it.readingNotice) }
    // When the plan's answer says the goal has no date, the advice asks next: that answer said the plan is ready.
    val answered = if (dated) coverGate else timeAdvice.last?.let { PlanGate(it.ready, it.readingNotice) } ?: coverGate
    val gate = answered ?: PlanGate(planReadiness.ready, planReadiness.readingNotice)
    val gateAnswer = if (dated) covering else timeAdvice
    val gateFailed = gateAnswer.status == PollStatus.Failed
    val waits = waitsForPlan(gate, answered != null, run)
    // The documents' reading has its own hold, which only a guess on it can keep after they're read.
    val readingHold = rememberReadyHold(ready = !waits)
    if ((waits && gate.readingNotice) || (!waits && !readingHold.over)) {
        NoticeReading(
            if (exam && goal.targetLanguage != null) ExamDocument.GUIDE else ExamDocument.NOTICE,
            lastEdition = false,
            run.warmUpId,
            run.stoppedBy(pollFailed = gateFailed),
            if (gateFailed) gateAnswer.restart else LocalPlanStart.current?.onRetry,
            readingHold,
            PlanNext.TimeQuestion,
        )
        return
    }

    // After the return above, so it lives only with the build's wait: a guess there doesn't hold the question after an
    // exam's documents are read.
    val hold = rememberReadyHold(ready = !waits)
    if (!hold.over) {
        PlanBuilding(
            run.withPoll(gateFailed),
            if (gateFailed) gateAnswer.restart else LocalPlanStart.current?.onRetry,
            hold = hold,
            next = PlanNext.TimeQuestion,
        )
        return
    }

    val date =
        shownFound
            ?.targetDate
            ?.takeIf { dated }
            ?.let { GoalDate(it, shownFound.targetDateNamedMonth) }
    val answers = listOf(covering.answer, covering.last, covering.first)
    val choose = { next: Int, followed: PlanTimeToCover? ->
        pickedSplit = daySplit(next, timeChoices, answers) ?: pickedSplit.takeIf { next == picked }
        onChoiceChange(choice.copy(picked = pickedMinutes(first, followed, next, startsOnRecommended)))
    }
    val pick = { next: Int -> choose(next, shownFound) }
    val stale = hasDays && !startsOnRecommended && waitsForSuggestion(findFailed, first, found, picked)

    com.zoonk.android.data
        .TrackOnboardingQuestion(goal.id.toString(), "schedule", goal.details.text("onboardingId"))
    StepForm(
        title = stringResource(R.string.onboarding_schedule_title),
        canContinue = hasDays && minutes != null,
        pending = pending || waitsToSave(line, picked),
        onContinue = {
            val time = minutes ?: return@StepForm
            vm.answer(
                OnboardingAnswerInput.OnboardingAnswerInputOneOf9Value(
                    OnboardingAnswerInputOneOf9(
                        dailyMinutes = time.toLong(),
                        question = OnboardingAnswerInputOneOf9.Question.SCHEDULE,
                        studyDays = days.takeIf { it.size < EVERY_DAY.size }?.map(Int::toLong),
                        timeZone = TimeZone.getDefault().id,
                        weekendMinutes = weekend?.toLong(),
                    ),
                ),
            )
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val label = stringResource(R.string.onboarding_schedule_time_label)
            // The picker carries the name for screen readers; this is its visible title.
            Text(label, Modifier.clearAndSetSemantics {}, fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyMedium)
            DailyTimePicker(
                times = timeChoices.map { it.minutes },
                minutes = minutes,
                label = label,
                onChange = pick,
                suggested = suggestedMinutes(found),
                stale = stale,
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            WeekdayToggles(days, onChange = { onChoiceChange(choice.copy(days = it)) })
            // The weekend has a time of its own only once one is picked: switched on, it starts as the weekdays'.
            WeekendTime(
                checked = choice.weekendOn,
                missing = missingDays(days),
                times = timeChoices.map { it.minutes },
                minutes = choice.weekendPicked ?: minutes ?: recommendedMinutes,
                onCheckedChange = { onChoiceChange(choice.copy(weekendOn = it, weekendPicked = null)) },
                onPick = { onChoiceChange(choice.copy(weekendPicked = it)) },
                labelStyle = LocalTextStyle.current.copy(fontWeight = FontWeight.Medium),
            )
        }

        ScheduleAim(advice?.endDate?.toJavaLocalDate(), minutes, goal, store, asked.adviceInput(minutes ?: recommendedMinutes))

        DateLink(dated = dated, exam = exam, enabled = !pending, onClick = vm::changeDate)

        // What the time and days get changes length as they change, so it comes last, with nothing to tap under it.
        TimeAnswer(
            date = date,
            exam = exam,
            line = shown.line,
            aim =
                LocalSetupAim.current.aim?.let { selected ->
                    selected.aim?.value?.takeIf { value ->
                        selected.choices.any {
                            it.aim.value ==
                                value
                        }
                    }
                },
            minutes = minutes,
            offer = timeOffer(shown.line, minutes),
            onRetry = if (findFailed) covering.restart else timeAdvice.restart,
            onUseOffer = { choose(it, found) },
            split =
                (
                    daySplit(
                        minutes,
                        timeChoices,
                        answers,
                    ) ?: pickedSplit.takeIf { picked != null && picked == minutes }
                ).takeIf { hasDays },
            updating = shown.updating,
        )
    }
}

/** Its words lined up with the column's, as the other inputs' labels are. */
@Composable
private fun DateLink(
    dated: Boolean,
    exam: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val words =
        when {
            exam -> R.string.onboarding_change_exam_date
            dated -> R.string.onboarding_change_end_date
            else -> R.string.onboarding_set_end_date
        }
    TextButton(onClick = onClick, enabled = enabled, trailingIcon = ForwardIcon, edge = ButtonEdge.Start) {
        Text(stringResource(words))
    }
}

@Composable
private fun WeekdayToggles(
    days: List<Int>,
    onChange: (List<Int>) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(stringResource(R.string.onboarding_study_days), fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyMedium)
        WeekdayPicker(
            isOn = { it in days },
            onToggle = { day, on -> onChange(if (on) (days + day).sorted() else days - day) },
        )
    }
}
