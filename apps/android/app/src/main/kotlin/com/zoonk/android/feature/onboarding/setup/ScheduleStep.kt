package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.feature.onboarding.AdviceQuery
import com.zoonk.android.feature.onboarding.CoverQuery
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.TimeMenu
import com.zoonk.android.ui.components.TimeSelect
import com.zoonk.android.ui.components.otherTimes
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.Goal
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingAnswerInputOneOf8
import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeToCover
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toJavaLocalDate
import kotlinx.datetime.toKotlinLocalDate
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.util.TimeZone

@Composable
internal fun ColumnScope.ScheduleStep(
    goal: Goal,
    recommendedMinutes: Int,
    run: GenerationRun,
    store: OnboardingStore,
    vm: GoalSetupViewModel,
    pending: Boolean,
    factsBeside: Boolean,
) {
    val exam = goal.kind == Goal.Kind.EXAM
    var picked by rememberSaveable { mutableStateOf<Int?>(null) }
    var fullCourse by rememberSaveable { mutableStateOf(false) }
    var days by rememberSaveable { mutableStateOf(startingDays(goal.studyDays.map(Long::toInt))) }
    var weekendOn by rememberSaveable { mutableStateOf(false) }
    var weekendPicked by rememberSaveable { mutableStateOf<Int?>(null) }
    val weekend = weekendPicked.takeIf { weekendOn && days.any(::isWeekend) }
    val hasDays = days.isNotEmpty()
    val paused = run.isStopped
    val today =
        java.time.LocalDate
            .now()
            .toKotlinLocalDate()

    val covering =
        rememberPlanAnswer(
            store.timesToCover,
            CoverQuery(goal, findWeek(days, weekend).coverInput()),
            enabled = (goal.targetDate != null || exam) && hasDays,
            paused = paused,
            serializer = PlanTimeToCover.serializer(),
            ready = { it.ready },
        )
    val found = covering.answer?.takeIf { it.ready }?.let { foundTime(it, today) }
    val lastFound = covering.last?.takeIf { it.ready }?.let { foundTime(it, today) }
    val first = covering.first?.let { foundTime(it, today) }
    val dated = lastFound?.let { it.time.targetDate != null } ?: (goal.targetDate != null || exam)
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
            serializer = PlanTimeAdvice.serializer(),
            ready = { it.ready },
        )
    val advice = timeAdvice.answer?.takeIf { it.ready }
    val line = timeLine(advice, timeAdvice.status == PollStatus.Failed, dated, findFailed, found, hasDays, minutes)

    val gate =
        if (dated) {
            covering.last?.let { PlanGate(it.ready, it.readingNotice) }
        } else {
            timeAdvice.last?.let { PlanGate(it.ready, it.readingNotice) }
        }
    val gatePoll = if (dated) covering.poll else timeAdvice.poll
    if (gate?.waits(run) == true) {
        if (gate.readingNotice) {
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
            ?.time
            ?.targetDate
            ?.takeIf { dated }
            ?.let { ShownDate(it, shownFound.time.targetDateNamedMonth) }
    val pick = { next: Int -> picked = pickedMinutes(first, shownFound, next) }

    StepForm(
        title = stringResource(R.string.onboarding_schedule_title),
        canContinue = hasDays && minutes != null,
        pending = pending,
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

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            DailyTimePicker(
                minutes = minutes,
                suggested = suggestedMinutes(found),
                stale = picked == null && dated && found == null && !findFailed && lastFound != null,
                onChange = pick,
            )
            ScheduleLine(
                date = date,
                exam = exam,
                line = line,
                minutes = minutes,
                offer = offer(found, line, minutes),
                tooClose = tooClose(found, line),
                onRetry = if (findFailed) covering.poll::restart else timeAdvice.poll::restart,
                onUseOffer = { picked = pickedMinutes(first, found, it) },
            )
        }

        val short = line is TimeLine.Share || line is TimeLine.EveryTopic
        if (exam && date != null && (short || keepsFullCourse(fullCourse, line))) {
            val end = minutes?.let { time -> advice?.fullCourseEndDate?.let { ExamFinish(time, it, date) } }
            FullCourseToggle(fullCourse, end, onCheckedChange = { fullCourse = it })
        }

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            WeekdayToggles(days, onChange = { days = it })
            if (days.any(::isWeekend)) {
                WeekendTime(
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
    }
}

private data class PlanGate(
    val ready: Boolean,
    val readingNotice: Boolean,
) {
    /** A run that's done leaves the time question to say the plan is still working the time out. */
    fun waits(run: GenerationRun) = !ready && (readingNotice || run.status != GenerationRun.Status.Ready)
}

/** A goal's date as the plan answered it. */
private data class ShownDate(
    val date: LocalDate,
    val namedMonth: Boolean,
)

private data class ExamFinish(
    val minutes: Int,
    val end: LocalDate,
    val exam: ShownDate,
)

/** The big time a day; its menu marks the time the plan suggests. */
@Composable
private fun DailyTimePicker(
    minutes: Int?,
    suggested: Int?,
    stale: Boolean,
    onChange: (Int) -> Unit,
) {
    if (minutes == null) {
        Box(
            Modifier
                .size(width = 160.dp, height = 48.dp)
                .background(MaterialTheme.colorScheme.surfaceContainerHighest, MaterialTheme.shapes.small),
        )
        return
    }

    var open by rememberSaveable { mutableStateOf(false) }
    val locale = currentLocale()
    val label = stringResource(R.string.onboarding_schedule_time_label)
    val shown = formatMinutes(minutes, locale)

    Box {
        Row(
            modifier =
                Modifier
                    .clip(MaterialTheme.shapes.small)
                    .clickable(role = Role.DropdownList) { open = true }
                    .semantics(mergeDescendants = true) { contentDescription = "$label, $shown" }
                    .alpha(if (stale) STALE_ALPHA else 1f)
                    .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(shown, style = MaterialTheme.typography.displaySmall.withTabularFigures())
            Icon(painterResource(R.drawable.ic_expand_more), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        TimeMenu(
            expanded = open,
            onDismissRequest = { open = false },
            times = otherTimes(minutes, suggested),
            shown = minutes,
            onPick = onChange,
            label = { time ->
                if (time == suggested) {
                    stringResource(R.string.onboarding_schedule_suggested, formatMinutes(time, locale))
                } else {
                    formatMinutes(time, locale)
                }
            },
        )
    }
}

/** One polite live region for the time shown: what it means, why, and the way back to the suggestion. */
@Composable
private fun ScheduleLine(
    date: ShownDate?,
    exam: Boolean,
    line: TimeLine,
    minutes: Int?,
    offer: SuggestedTime?,
    tooClose: TooClose?,
    onRetry: () -> Unit,
    onUseOffer: (Int) -> Unit,
) {
    val failed = line is TimeLine.AskFailed || line is TimeLine.FindFailed
    val words = lineWords(date, exam, line, minutes)
    val close = tooClose?.let { tooCloseWords(it) }
    val locale = currentLocale()

    Column(Modifier.heightIn(min = 48.dp).semantics { liveRegion = LiveRegionMode.Polite }) {
        Text(
            buildAnnotatedString {
                close?.let { append("$it ") }
                append(words)
            },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        when {
            failed -> {
                TextButton(onClick = onRetry) { Text(stringResource(R.string.onboarding_try_again)) }
            }

            offer != null -> {
                val words =
                    when {
                        offer.coversEverything -> R.string.onboarding_schedule_offer_everything
                        else -> R.string.onboarding_schedule_offer_every_topic
                    }
                TextButton(onClick = { onUseOffer(offer.minutes) }) {
                    Text(stringResource(words, formatMinutes(offer.minutes, locale)))
                }
            }
        }
    }
}

@Composable
private fun tooCloseWords(tooClose: TooClose): String =
    tooClose.recommendedMinutes?.let {
        stringResource(R.string.onboarding_schedule_close, formatMinutes(it, currentLocale()))
    } ?: stringResource(R.string.onboarding_schedule_too_close)

@Composable
private fun lineWords(
    date: ShownDate?,
    exam: Boolean,
    line: TimeLine,
    minutes: Int?,
): AnnotatedString {
    val locale = currentLocale()
    val shown = date?.let { goalDate(it.date, it.namedMonth, DateStyle.Long) }.orEmpty()
    val time = formatMinutes(minutes ?: 0, locale)
    val text =
        when (line) {
            is TimeLine.Everything -> {
                stringResource(
                    when {
                        line.suggested && exam -> R.string.onboarding_schedule_takes_exam_all
                        line.suggested -> R.string.onboarding_schedule_takes_goal_all
                        exam -> R.string.onboarding_schedule_covers_exam_all
                        else -> R.string.onboarding_schedule_covers_goal_all
                    },
                    shown,
                )
            }

            TimeLine.EveryTopic -> {
                val reaches = if (exam) R.string.onboarding_schedule_reaches_exam else R.string.onboarding_schedule_reaches_goal
                stringResource(reaches, shown)
            }

            is TimeLine.Share -> {
                stringResource(
                    if (exam) R.string.onboarding_schedule_share_exam else R.string.onboarding_schedule_share_goal,
                    formatPercent(line.share, locale),
                    shown,
                )
            }

            TimeLine.PastDate -> {
                stringResource(R.string.onboarding_schedule_past_date, shown)
            }

            is TimeLine.Finish -> {
                val month = formatDate(line.endDate.toJavaLocalDate(), locale, DateStyle.Month)
                return stringResource(R.string.onboarding_finish_around, month)
                    .emphasizing(month, SpanStyle(fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurface))
            }

            TimeLine.NoFinish -> {
                stringResource(R.string.onboarding_finish_unknown)
            }

            TimeLine.NoDays -> {
                stringResource(R.string.onboarding_schedule_no_days)
            }

            TimeLine.Working -> {
                stringResource(R.string.onboarding_schedule_working)
            }

            TimeLine.FindFailed -> {
                stringResource(R.string.onboarding_schedule_find_failed)
            }

            TimeLine.Asking -> {
                if (date == null) {
                    stringResource(R.string.onboarding_finish_working)
                } else {
                    stringResource(R.string.onboarding_schedule_asking, time)
                }
            }

            TimeLine.AskFailed -> {
                if (date == null) {
                    stringResource(R.string.onboarding_finish_failed)
                } else {
                    stringResource(R.string.onboarding_schedule_ask_failed, time)
                }
            }
        }
    return AnnotatedString(text)
}

private fun String.emphasizing(
    part: String,
    style: SpanStyle,
): AnnotatedString {
    val start = indexOf(part)
    return buildAnnotatedString {
        if (start < 0) {
            append(this@emphasizing)
        } else {
            append(substring(0, start))
            withStyle(style) { append(part) }
            append(substring(start + part.length))
        }
    }
}

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
                    R.string.onboarding_full_course_finish,
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
    checked: Boolean,
    minutes: Int,
    onCheckedChange: (Boolean) -> Unit,
    onChange: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SwitchRow(stringResource(R.string.onboarding_weekend_time), checked, onCheckedChange)
        if (checked) TimeSelect(stringResource(R.string.onboarding_weekend_time_label), minutes, onChange)
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

private const val STALE_ALPHA = 0.6f

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
