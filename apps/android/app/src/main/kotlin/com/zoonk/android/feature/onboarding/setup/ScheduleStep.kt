package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.feature.onboarding.AdviceQuery
import com.zoonk.android.feature.onboarding.CoverQuery
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.plan.DaySplit
import com.zoonk.android.feature.plan.GoalDate
import com.zoonk.android.feature.plan.TimeAnswer
import com.zoonk.android.feature.plan.TimeLine
import com.zoonk.android.feature.plan.fullTimeNote
import com.zoonk.android.feature.plan.lineAdvice
import com.zoonk.android.feature.plan.markedTimes
import com.zoonk.android.feature.plan.timeLine
import com.zoonk.android.feature.plan.timeOffer
import com.zoonk.android.ui.components.DailyTimePicker
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.TimeSelect
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.Goal
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingAnswerInputOneOf8
import com.zoonk.api.models.OnboardingTimeChoicesInner
import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeToCover
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toJavaLocalDate
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.util.TimeZone

@Composable
internal fun ColumnScope.ScheduleStep(
    goal: Goal,
    recommendedMinutes: Int,
    timeChoices: List<OnboardingTimeChoicesInner>,
    run: GenerationRun,
    store: OnboardingStore,
    vm: GoalSetupViewModel,
    pending: Boolean,
    factsBeside: Boolean,
) {
    val exam = goal.kind == Goal.Kind.EXAM
    var picked by rememberSaveable { mutableStateOf<Int?>(null) }
    var pickedSplit by rememberSaveable(stateSaver = DaySplitSaver) { mutableStateOf<DaySplit?>(null) }
    var fullCourse by rememberSaveable { mutableStateOf(false) }
    var days by rememberSaveable { mutableStateOf(startingDays(goal.studyDays.map(Long::toInt))) }
    var weekendOn by rememberSaveable { mutableStateOf(false) }
    var weekendPicked by rememberSaveable { mutableStateOf<Int?>(null) }
    val weekend = weekendPicked.takeIf { weekendOn && days.any(::isWeekend) }
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
    val minutes = shownMinutes(recommendedMinutes, first, shownFound, picked, settled = !dated || findFailed)
    val studiesEverything = exam && fullCourse
    val asked = studyWeek(days, minutes ?: recommendedMinutes, weekend, studiesEverything)

    val timeAdvice =
        rememberPlanAnswer(
            store.timeAdvice,
            AdviceQuery(goal, asked.adviceInput(minutes ?: recommendedMinutes)),
            enabled = hasDays && asksAboutTime(dated, found, studiesEverything, minutes),
            paused = paused,
            planMade = run.planMade,
            querySerializer = AdviceQuery.serializer(),
            serializer = PlanTimeAdvice.serializer(),
            ready = { it.ready },
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

    val gate =
        if (dated) {
            covering.last?.let { PlanGate(it.ready, it.readingNotice) }
        } else {
            timeAdvice.last?.let { PlanGate(it.ready, it.readingNotice) }
        }
    val gatePoll = if (dated) covering.poll else timeAdvice.poll
    if (gate?.waits(run) == true) {
        if (gate.readingNotice && !gatePoll.stopped && !run.isStopped) {
            val document = if (exam && goal.targetLanguage != null) ExamDocument.GUIDE else ExamDocument.NOTICE
            NoticeReading(document, lastEdition = false)
        } else {
            val retry = if (gatePoll.stopped) gatePoll::restart else LocalPlanStart.current?.onRetry
            PlanBuilding(run.withPoll(gatePoll), retry)
        }
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
        picked = pickedMinutes(first, followed, next)
    }
    val pick = { next: Int -> choose(next, shownFound) }
    val stale = hasDays && waitsForSuggestion(findFailed, first, found, picked)
    val marked = markedTimes(found)

    StepForm(
        title = stringResource(R.string.onboarding_schedule_title),
        canContinue = hasDays && minutes != null,
        pending = pending || waitsToSave(line, picked),
        onContinue = {
            val time = minutes ?: return@StepForm
            vm.answer(
                OnboardingAnswerInput.OnboardingAnswerInputOneOf8Value(
                    OnboardingAnswerInputOneOf8(
                        dailyMinutes = time.toLong(),
                        question = OnboardingAnswerInputOneOf8.Question.SCHEDULE,
                        fullCourse = if (exam) keepsFullCourse(fullCourse, line) else null,
                        studyDays = days.takeIf { it.size < EVERY_DAY.size }?.map(Int::toLong),
                        timeZone = TimeZone.getDefault().id,
                        weekendMinutes = weekend?.toLong(),
                    ),
                ),
            )
        },
    ) {
        if (!factsBeside) PlanFactChips(goal)

        // The days decide the time, and what the time covers arrives last, so nothing above it moves.
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            WeekdayToggles(days, onChange = { days = it })
            if (days.any(::isWeekend)) {
                WeekendTime(
                    times = timeChoices.map { it.minutes },
                    checked = weekendOn,
                    minutes = weekendPicked ?: minutes ?: recommendedMinutes,
                    onCheckedChange = {
                        weekendOn = it
                        weekendPicked = null
                    },
                    onChange = { weekendPicked = it },
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val label = stringResource(R.string.onboarding_schedule_time_label)
            // The picker carries the name for screen readers; this is its visible title.
            Text(label, Modifier.clearAndSetSemantics {}, fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyMedium)
            DailyTimePicker(
                times = timeChoices.map { it.minutes },
                minutes = minutes,
                label = label,
                onChange = pick,
                suggested = marked.suggested,
                full = marked.full,
                stale = stale,
            )
            TimeAnswer(
                date = date,
                exam = exam,
                line = shown.line,
                minutes = minutes,
                note = fullTimeNote(shown.found, shown.line, studiesEveryDay = days.size == EVERY_DAY.size),
                offer = timeOffer(shown.found, shown.line, minutes),
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

        val short = shown.line is TimeLine.Share || shown.line is TimeLine.Focus
        if (exam && date != null && (short || keepsFullCourse(fullCourse, shown.line))) {
            val end = minutes?.let { time -> advice?.fullCourseEndDate?.let { ExamFinish(time, it, date) } }
            FullCourseToggle(fullCourse, end, onCheckedChange = { fullCourse = it })
        }
    }
}

private data class PlanGate(
    val ready: Boolean,
    val readingNotice: Boolean,
) {
    /** A run that's done leaves the time question to say the plan is still working the time out. */
    fun waits(run: GenerationRun) = !ready && (readingNotice || run.status != GenerationRun.Status.Ready)
}

private data class ExamFinish(
    val minutes: Int,
    val end: LocalDate,
    val exam: GoalDate,
)

@Composable
private fun FullCourseToggle(
    checked: Boolean,
    end: ExamFinish?,
    onCheckedChange: (Boolean) -> Unit,
) {
    val locale = currentLocale()
    val description =
        when {
            !checked -> {
                null
            }

            end != null -> {
                stringResource(
                    if (end.exam.namedMonth) R.string.onboarding_full_course_finish_month else R.string.onboarding_full_course_finish,
                    formatMinutes(end.minutes, locale),
                    formatDate(end.end.toJavaLocalDate(), locale, DateStyle.Month),
                    goalDate(end.exam.date, end.exam.namedMonth, DateStyle.LongYear),
                ) + " " + stringResource(R.string.onboarding_full_course_until_exam)
            }

            else -> {
                stringResource(R.string.onboarding_full_course_rule)
            }
        }
    SwitchRow(stringResource(R.string.onboarding_full_course), checked, onCheckedChange, description)
}

@Composable
private fun WeekdayToggles(
    days: List<Int>,
    onChange: (List<Int>) -> Unit,
) {
    val locale = currentLocale()
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(stringResource(R.string.onboarding_study_days), fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyMedium)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            EVERY_DAY.forEach { day ->
                val weekday = DayOfWeek.of(if (day == 0) 7 else day)
                val picked = day in days
                FilterChip(
                    selected = picked,
                    onClick = { onChange(if (picked) days - day else (days + day).sorted()) },
                    leadingIcon = selectedCheck(picked),
                    label = { Text(weekday.getDisplayName(TextStyle.NARROW, locale)) },
                    modifier = Modifier.semantics { contentDescription = weekday.getDisplayName(TextStyle.FULL, locale) },
                )
            }
        }
    }
}

/** The weekend has a time of its own only once one is picked: switched on, it starts as the weekdays'. */
@Composable
private fun WeekendTime(
    times: List<Long>,
    checked: Boolean,
    minutes: Int,
    onCheckedChange: (Boolean) -> Unit,
    onChange: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SwitchRow(stringResource(R.string.onboarding_weekend_time), checked, onCheckedChange)
        if (checked) TimeSelect(stringResource(R.string.onboarding_weekend_time_label), times, minutes, onChange)
    }
}

@Composable
private fun PlanFactChips(goal: Goal) {
    val facts = planFacts(goal).filter { it.chip }
    if (facts.isEmpty()) return
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        facts.forEach { LabelChip(text = it.count ?: it.value) }
    }
}

/** A goal's date as the learner gave it: a named month reads as the month, not its first day. */
@Composable
internal fun goalDate(
    date: LocalDate,
    namedMonth: Boolean,
    style: DateStyle = DateStyle.Day,
): String = formatDate(date.toJavaLocalDate(), currentLocale(), if (namedMonth) DateStyle.Month else style)

internal fun selectedCheck(selected: Boolean): (@Composable () -> Unit)? =
    if (selected) {
        { Icon(painterResource(R.drawable.ic_check), contentDescription = null, modifier = Modifier.size(FilterChipDefaults.IconSize)) }
    } else {
        null
    }

/** The whole row toggles, its description read with it, at least a touch target tall. */
@Composable
private fun SwitchRow(
    title: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    description: String? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).toggleable(checked, role = Role.Switch, onValueChange = onCheckedChange),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, fontWeight = FontWeight.Medium)
            description?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
        }
        Switch(checked = checked, onCheckedChange = null)
    }
}
