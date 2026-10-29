package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.onboarding.AdviceQuery
import com.zoonk.android.feature.onboarding.CoverQuery
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.start.isCompactWidth
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.Goal
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingAnswerInputOneOf8
import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeToCover
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toJavaLocalDate
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
) {
    val goalId = goal.id.toString()
    val exam = goal.kind == Goal.Kind.EXAM
    val dated = goal.targetDate != null || exam
    var minutes by rememberSaveable { mutableIntStateOf(recommendedMinutes) }
    var weekendMinutes by rememberSaveable { mutableStateOf<Int?>(null) }
    var days by rememberSaveable { mutableStateOf(startingDays(goal.studyDays.map(Long::toInt))) }
    var fullCourse by rememberSaveable { mutableStateOf(false) }
    val weekend = weekendMinutes.takeIf { days.any(::isWeekend) }
    val week = studyWeek(days, minutes, weekend, exam && fullCourse)
    var answer by remember { mutableStateOf<AdviceAnswer?>(null) }
    var build by remember { mutableIntStateOf(0) }
    var finding by remember { mutableStateOf<CoverQuery?>(null) }
    val adviceQuery = AdviceQuery(goalId, week.adviceInput(minutes))
    val adviceResource = store.timeAdvice[adviceQuery]
    if (dated) {
        val adviceState by adviceResource.collectShown()
        LaunchedEffect(adviceState) {
            val next = (adviceState as? LoadState.Loaded)?.value ?: return@LaunchedEffect
            // Each rebuild of the plan (an exam's notice reading landed) makes what Find found before stale.
            if (answer?.advice?.ready == true && !next.ready) build++
            answer = AdviceAnswer(next, week, minutes)
        }
    }
    val advice = weekAdvice(answer, week)
    val lookup = findWeek(days, weekend)
    val coverQuery = CoverQuery(goalId, lookup.coverInput(), build)
    val finds = store.timesToCover[coverQuery]
    val findState = if (finding == coverQuery) finds.collectShown().value else null
    val found = (findState as? LoadState.Loaded)?.value?.takeIf { it.ready && answer?.advice?.ready != false }
    val picked = pickedShare(advice, answer, found, minutes)
    val studiesEverything = exam && keepsFullCourse(fullCourse, picked)
    val stopped = run.isStopped
    val asksAdvice = dated && !(advice != null && picked.known) && !stopped
    val poll = rememberPoll(active = asksAdvice, key = adviceQuery) { adviceResource.refreshed() }
    val adviceStatus = poll.status(asksAdvice)
    val scope = rememberCoroutineScope()
    val find: () -> Unit = {
        if (finding == coverQuery) {
            scope.launch { finds.refresh() }
        } else {
            finding = coverQuery
        }
    }
    val shown = estimate(advice, answer, picked, adviceStatus)
    val planReady = answer?.advice?.ready == true || (adviceStatus != PollStatus.Polling && !stopped)

    StepForm(
        title = stringResource(R.string.onboarding_schedule_title),
        canContinue = days.isNotEmpty(),
        pending = pending,
        onContinue = {
            vm.answer(
                OnboardingAnswerInput.OnboardingAnswerInputOneOf8Value(
                    OnboardingAnswerInputOneOf8(
                        dailyMinutes = minutes.toLong(),
                        question = OnboardingAnswerInputOneOf8.Question.SCHEDULE,
                        fullCourse = if (exam) studiesEverything else null,
                        studyDays = days.takeIf { it.size < EVERY_DAY.size }?.map(Int::toLong),
                        timeZone = TimeZone.getDefault().id,
                        weekendMinutes = weekend?.toLong(),
                    ),
                ),
            )
        },
    ) {
        if (isCompactWidth()) PlanFactChips(goal)

        TimeChoices(minutes, found, onChange = { minutes = it })

        if (dated && showsEstimate(shown, picked, adviceStatus)) {
            EstimatePanel(shown, minutes, onRetry = poll::restart)
        }

        val share = shown.share.takeUnless { shown.failed }
        val short = share != null && share < 1
        if (share == null || short) {
            AdviceSentence(dated, planReady, answer?.advice?.readingNotice == true, found, findStatus(findState), onFind = find)
        }
        if (exam && (short || studiesEverything)) {
            FullCourseToggle(
                checked = fullCourse,
                end = fullCourseEnd(advice, answer, minutes),
                onCheckedChange = { fullCourse = it },
            )
        }
        if (!exam && short) {
            Text(
                stringResource(R.string.onboarding_schedule_move_date, formatMinutes(minutes, currentLocale())),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        StudyWeekDisclosure(days, minutes, weekend, onDays = { days = it }, weekendMinutes = weekendMinutes, onWeekend = {
            weekendMinutes =
                it
        })
    }
}

@Composable
private fun TimeChoices(
    minutes: Int,
    found: PlanTimeToCover?,
    onChange: (Int) -> Unit,
) {
    val locale = currentLocale()
    val offered = offeredMinutes(found)
    val note =
        when {
            found?.recommendedMinutes != null -> stringResource(R.string.onboarding_schedule_covers_everything)
            found?.coreMinutes != null -> stringResource(R.string.onboarding_schedule_every_topic)
            else -> null
        }
    val label = stringResource(R.string.onboarding_schedule_minutes_label)

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
            Text(formatMinutes(minutes, locale), style = MaterialTheme.typography.displaySmall.withTabularFigures())
            Text(
                stringResource(R.string.onboarding_schedule_per_day),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        FlowRow(
            modifier = Modifier.semantics { contentDescription = label },
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            timeChoices(minutes, offered).forEach { option ->
                FilterChip(
                    selected = option == minutes,
                    onClick = { onChange(option) },
                    label = {
                        Column {
                            Text(formatMinutes(option, locale), style = MaterialTheme.typography.labelLarge.withTabularFigures())
                            if (option == offered && note != null) Text(note, style = MaterialTheme.typography.labelSmall)
                        }
                    },
                )
            }
        }
        OtherTime(minutes, stringResource(R.string.onboarding_schedule_other_time_label), onChange)
    }
}

@Composable
private fun OtherTime(
    minutes: Int,
    label: String,
    onPick: (Int) -> Unit,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    val locale = currentLocale()
    Box {
        TextButton(onClick = { open = true }, modifier = Modifier.semantics { contentDescription = label }) {
            Text(stringResource(R.string.onboarding_schedule_other_time))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            otherTimes(minutes).forEach { time ->
                DropdownMenuItem(
                    text = { Text(formatMinutes(time, locale)) },
                    onClick = {
                        open = false
                        onPick(time)
                    },
                )
            }
        }
    }
}

@Composable
private fun EstimatePanel(
    estimate: Estimate,
    minutes: Int,
    onRetry: () -> Unit,
) {
    val locale = currentLocale()
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(stringResource(R.string.onboarding_estimate), style = MaterialTheme.typography.titleSmall)
            Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (estimate.failed) {
                    Text(
                        stringResource(R.string.onboarding_estimate_failed, formatMinutes(minutes, locale)),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    TextButton(onClick = onRetry) { Text(stringResource(R.string.onboarding_try_again)) }
                }
                if (estimate.failed && estimate.staleMinutes != null) {
                    Text(
                        stringResource(R.string.onboarding_estimate_last, formatMinutes(estimate.staleMinutes, locale)),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                val advice = estimate.advice
                val share = estimate.share
                if (!estimate.failed || share != null) {
                    if (advice != null && share != null) {
                        EstimateWords(advice, share, Modifier.alpha(if (estimate.stale) STALE_ALPHA else 1f))
                    } else {
                        Text(
                            stringResource(R.string.onboarding_estimate_working),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
            Meter(share = (estimate.share ?: 0.0).toFloat(), modifier = Modifier.alpha(if (estimate.stale) STALE_ALPHA else 1f))
        }
    }
}

@Composable
private fun EstimateWords(
    advice: PlanTimeAdvice,
    share: Double,
    modifier: Modifier = Modifier,
) {
    val percent = formatPercent(share, currentLocale())
    val date = advice.targetDate?.let { goalDate(it, advice.targetDateNamedMonth) }.orEmpty()
    val exam = advice.measure == PlanTimeAdvice.Measure.EXAM
    val sentence =
        stringResource(
            when {
                share >= 1 && exam -> R.string.onboarding_estimate_exam_all
                share >= 1 -> R.string.onboarding_estimate_goal_all
                exam -> R.string.onboarding_estimate_exam_part
                else -> R.string.onboarding_estimate_goal_part
            },
            percent,
            date,
        )
    val start = sentence.indexOf(percent)
    Text(
        buildAnnotatedString {
            if (start < 0) {
                append(sentence)
            } else {
                append(sentence.substring(0, start))
                withStyle(
                    SpanStyle(
                        fontSize = MaterialTheme.typography.titleLarge.fontSize,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurface,
                    ),
                ) {
                    append(percent)
                }
                append(sentence.substring(start + percent.length))
            }
        },
        modifier = modifier,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

/** Find works out the time only when asked: it plans the goal at each daily time. */
@Composable
private fun AdviceSentence(
    dated: Boolean,
    planReady: Boolean,
    readingNotice: Boolean,
    found: PlanTimeToCover?,
    status: FindStatus?,
    onFind: () -> Unit,
) {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val body = MaterialTheme.typography.bodyMedium
    if (!dated) {
        Text(stringResource(R.string.onboarding_schedule_change_anytime), color = muted, style = body)
        return
    }

    Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when {
            !planReady -> {
                Text(
                    stringResource(
                        if (readingNotice) R.string.onboarding_schedule_reading_notice else R.string.onboarding_schedule_building,
                    ),
                    color = muted,
                    style = body,
                )
            }

            status == FindStatus.Answered && found != null -> {
                FoundWords(found)
            }

            else -> {
                if (status == FindStatus.Building || status == FindStatus.Failed) {
                    Text(
                        stringResource(
                            if (status ==
                                FindStatus.Building
                            ) {
                                R.string.onboarding_find_building
                            } else {
                                R.string.onboarding_find_failed
                            },
                        ),
                        color = muted,
                        style = body,
                    )
                }
                val retry = status == FindStatus.Building || status == FindStatus.Failed
                FilledTonalButton(onClick = onFind, enabled = status != FindStatus.Pending) {
                    Text(
                        stringResource(
                            when {
                                status == FindStatus.Pending -> R.string.onboarding_find_finding
                                retry -> R.string.onboarding_try_again
                                else -> R.string.onboarding_find_time
                            },
                        ),
                    )
                }
            }
        }
    }
}

@Composable
private fun FoundWords(found: PlanTimeToCover) {
    val date = found.targetDate ?: return
    val locale = currentLocale()
    val shown = goalDate(date, found.targetDateNamedMonth)
    val recommended = found.recommendedMinutes
    if (recommended != null) {
        Text(
            stringResource(R.string.onboarding_find_covers, formatMinutes(recommended.toInt(), locale), shown),
            fontWeight = FontWeight.Medium,
            style = MaterialTheme.typography.bodyMedium,
        )
        return
    }
    Text(
        stringResource(R.string.onboarding_find_none, shown),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
    found.coreMinutes?.let {
        Text(
            stringResource(R.string.onboarding_find_every_topic, formatMinutes(it.toInt(), locale)),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun FullCourseToggle(
    checked: Boolean,
    end: Finish?,
    onCheckedChange: (Boolean) -> Unit,
) {
    val locale = currentLocale()
    val after = stringResource(R.string.onboarding_full_course_until_exam)
    val description =
        if (checked && end != null) {
            stringResource(
                R.string.onboarding_full_course_finish,
                formatMinutes(end.minutes, locale),
                formatDate(end.end.toJavaLocalDate(), locale, DateStyle.Month),
                goalDate(end.examDate, end.namedMonth, DateStyle.LongYear),
            ) + " " + after
        } else {
            stringResource(R.string.onboarding_full_course_rule)
        }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().toggleable(checked, role = Role.Switch, onValueChange = onCheckedChange),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(stringResource(R.string.onboarding_full_course), modifier = Modifier.weight(1f), fontWeight = FontWeight.Medium)
            Switch(checked = checked, onCheckedChange = null)
        }
        Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun StudyWeekDisclosure(
    days: List<Int>,
    minutes: Int,
    weekend: Int?,
    onDays: (List<Int>) -> Unit,
    weekendMinutes: Int?,
    onWeekend: (Int?) -> Unit,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    val locale = currentLocale()
    val weekly = days.sumOf { if (isWeekend(it) && weekend != null) weekend else minutes }
    val summary = pluralStringResource(R.plurals.onboarding_week_summary, days.size, days.size, formatMinutes(weekly, locale))
    val stateLabel = stringResource(if (open) R.string.onboarding_expanded else R.string.onboarding_collapsed)

    Column {
        HorizontalDivider()
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable { open = !open }
                    .semantics(mergeDescendants = true) { stateDescription = stateLabel }
                    .padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.onboarding_which_days), style = MaterialTheme.typography.bodyLarge)
                Text(
                    summary,
                    modifier =
                        Modifier.semantics {
                            liveRegion = LiveRegionMode.Polite
                        },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            Icon(
                painterResource(if (open) R.drawable.ic_expand_less else R.drawable.ic_expand_more),
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (open) {
            Column(Modifier.padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                WeekdayToggles(days, onDays)
                if (days.any(::isWeekend)) WeekendTime(minutes, weekendMinutes, onWeekend)
            }
        }
        HorizontalDivider()
    }
}

@Composable
private fun WeekdayToggles(
    days: List<Int>,
    onChange: (List<Int>) -> Unit,
) {
    val locale = currentLocale()
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        EVERY_DAY.forEach { day ->
            val weekday = DayOfWeek.of(if (day == 0) 7 else day)
            val picked = day in days
            FilterChip(
                selected = picked,
                onClick = { onChange(if (picked) days - day else (days + day).sorted()) },
                label = { Text(weekday.getDisplayName(TextStyle.NARROW, locale)) },
                modifier = Modifier.semantics { contentDescription = weekday.getDisplayName(TextStyle.FULL, locale) },
            )
        }
    }
}

@Composable
private fun WeekendTime(
    minutes: Int,
    weekendMinutes: Int?,
    onChange: (Int?) -> Unit,
) {
    val locale = currentLocale()
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier =
                Modifier.fillMaxWidth().toggleable(weekendMinutes != null, role = Role.Switch) { on ->
                    onChange(if (on) minutes else null)
                },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(stringResource(R.string.onboarding_weekend_time), modifier = Modifier.weight(1f), fontWeight = FontWeight.Medium)
            Switch(checked = weekendMinutes != null, onCheckedChange = null)
        }
        if (weekendMinutes != null) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                timeChoices(minutes, weekendMinutes).forEach { option ->
                    FilterChip(
                        selected = option == weekendMinutes,
                        onClick = { onChange(option) },
                        label = { Text(formatMinutes(option, locale), style = MaterialTheme.typography.labelLarge.withTabularFigures()) },
                    )
                }
            }
            OtherTime(weekendMinutes, stringResource(R.string.onboarding_weekend_other_time_label), onChange)
        }
    }
}

@Composable
private fun PlanFactChips(goal: Goal) {
    val facts = planFacts(goal).filter { it.chip }
    if (facts.isEmpty()) return
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        facts.forEach { LabelChip(text = it.value) }
    }
}

/** A goal's date as the learner gave it: a named month reads as the month, not its first day. */
@Composable
internal fun goalDate(
    date: LocalDate,
    namedMonth: Boolean,
    style: DateStyle = DateStyle.Day,
): String = formatDate(date.toJavaLocalDate(), currentLocale(), if (namedMonth) DateStyle.Month else style)

private fun findStatus(state: LoadState<PlanTimeToCover>?): FindStatus? =
    when (state) {
        null -> null
        is LoadState.Loaded -> if (state.value.ready) FindStatus.Answered else FindStatus.Building
        LoadState.Idle, LoadState.Loading -> FindStatus.Pending
        else -> FindStatus.Failed
    }

private const val STALE_ALPHA = 0.6f
