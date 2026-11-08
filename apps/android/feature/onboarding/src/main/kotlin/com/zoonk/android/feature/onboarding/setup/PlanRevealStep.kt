package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.READING_RUN
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.feature.plan.ADJUST_CHOICES
import com.zoonk.android.feature.plan.PlanChoiceLines
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.plan.studyDaysWords
import com.zoonk.android.feature.session.toDayView
import com.zoonk.android.feature.warmup.ReadyHold
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.SuccessEyebrow
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.Goal
import com.zoonk.api.models.OnboardingLibraryCourse
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanFeasibility
import com.zoonk.api.models.PlanPhase
import com.zoonk.api.models.PlanPhaseChaptersInner
import com.zoonk.api.models.PlanSchedule
import com.zoonk.api.models.PlanWeekShape
import com.zoonk.api.models.ShortExamFocus
import com.zoonk.api.models.Syllabus
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import java.util.Locale
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds

/** Reading the plan starts no work; only Start and Adjust leave. */
@Composable
internal fun ColumnScope.PlanRevealStep(
    goal: Goal,
    isGuest: Boolean,
    run: GenerationRun,
    onRetryRun: (() -> Unit)?,
    plans: PlanStore,
    navigator: AppNavigator,
    here: AppRoute,
    prepareToday: suspend () -> Unit = {},
    onReveal: (((() -> Unit)) -> Unit)? = null,
    saving: Boolean = false,
    saveFailed: Boolean = false,
    playMoment: () -> Boolean = { false },
    planRevealed: Boolean = false,
    today: com.zoonk.android.data.Resource<com.zoonk.api.models.PlanRevealToday>? = null,
) {
    val resource = plans.plan[goal.id]
    val state by resource.collectShown()
    val plan = state.value?.plan
    val readingNotice = plan?.notice == Plan.Notice.READING
    val reading = plan?.ready == true && readingNotice
    val read = plan?.ready == true && !readingNotice
    // The documents' reading has its own hold, which only a guess on it can keep after they're read.
    val readingHold = rememberReadyHold(ready = read)
    val polls = (plan?.ready != true && !run.isStopped) || readingNotice
    val poll = rememberPoll(active = polls, timeout = Duration.INFINITE) { resource.refreshed() }
    LaunchedEffect(run.planMade) { if (run.planMade && polls) poll.restart() }
    var opening by rememberSaveable { mutableStateOf(false) }
    var starting by remember { mutableStateOf(false) }
    LaunchedEffect(opening) {
        if (!opening) return@LaunchedEffect
        val progress =
            launch {
                delay(TODAY_PROGRESS_DELAY)
                starting = true
            }
        try {
            prepareToday()
        } finally {
            progress.cancel()
            starting = false
        }
        opening = false
        if (navigator.currentRoute == here) {
            navigator.closeSection()
            navigator.open(AppRoute.Today)
        }
    }

    when {
        plan == null && polls && !poll.stopped -> {
            StepLoading()
        }

        plan != null && (reading || (read && !readingHold.over)) -> {
            NoticeReading(
                plan.examDocument,
                plan.schedule.targetDateEstimated,
                run.warmUpId,
                run.stoppedBy(pollFailed = poll.stopped),
                onRetry = if (poll.stopped) poll::restart else onRetryRun,
                readingHold,
                PlanNext.Plan,
            )
        }

        else -> {
            // Lives only with the build's wait, so a guess there doesn't hold the reveal after an exam's documents are read.
            val hold = rememberReadyHold(ready = plan?.ready == true)
            if (plan == null || !hold.over) {
                PlanBuilding(
                    run.withPoll(poll.stopped),
                    onRetry = if (poll.stopped) poll::restart else onRetryRun,
                    hold = hold,
                    next = PlanNext.Plan,
                )
            } else {
                val syllabus by plans.syllabus[goal.id].collectShown()
                val todayState = today?.collectShown()?.value
                val preview = todayState?.value
                RevealBody(
                    plan = plan,
                    reveal = preview,
                    goal = goal,
                    syllabus = syllabus.value,
                    isGuest = isGuest,
                    starting = starting || saving,
                    saveFailed = saveFailed,
                    playMoment = !planRevealed && remember { playMoment() },
                    onStart = { if (onReveal != null) onReveal { opening = true } else opening = true },
                    // Adjust opens the Plan tab until the plan editor (F16) can open here.
                    onAdjust = {
                        navigator.closeSection()
                        navigator.open(AppRoute.Plan())
                    },
                    onChangeChoice = {
                        navigator.closeSection()
                        navigator.open(AppRoute.Plan(focus = ADJUST_CHOICES))
                    },
                    onCreateAccount = { navigator.open(AppRoute.Login) },
                    onSeePlus = { navigator.open(AppRoute.Subscription) },
                )
            }
        }
    }
}

/** Where the learner goes once the plan is ready: the time question, or the plan itself. */
internal enum class PlanNext { TimeQuestion, Plan }

@Composable
internal fun ColumnScope.PlanBuilding(
    run: GenerationRun,
    onRetry: (() -> Unit)?,
    hold: ReadyHold? = null,
    next: PlanNext = PlanNext.Plan,
) {
    val held = hold ?: rememberReadyHold(false)
    val shown = if (held.holding) run.copy(status = GenerationRun.Status.Ready, failure = null) else run
    SetupWait(
        shown,
        GenerationKind.Curriculum,
        AnalyticsEvent.WarmUpSurface.PlanWait,
        stringResource(if (held.holding) R.string.warm_up_plan_ready else R.string.onboarding_reveal_building_title),
        held,
        stringResource(if (next == PlanNext.Plan) R.string.focustest_see_plan else R.string.onboarding_continue),
        onRetry,
        next,
    ) { share ->
        GenerationWait(GenerationKind.Curriculum, shown, onRetry, share = share) {
            if (held.holding) {
                PlanReadyHeading(next)
            } else {
                OnboardingHeading(
                    stringResource(R.string.onboarding_reveal_building_title),
                    stringResource(
                        if (run.isStopped) R.string.onboarding_answers_saved else R.string.onboarding_reveal_building_description,
                    ),
                )
            }
        }
    }
}

@Composable
private fun PlanReadyHeading(next: PlanNext) {
    OnboardingHeading(
        stringResource(R.string.warm_up_plan_ready),
        stringResource(
            when (next) {
                PlanNext.Plan -> R.string.warm_up_plan_ready_whenever
                PlanNext.TimeQuestion -> R.string.warm_up_plan_ready_one_question
            },
        ),
    )
}

@Composable
internal fun LibraryCourseOffer(
    course: OnboardingLibraryCourse,
    onOpen: () -> Unit,
) {
    ListRow(
        onClick = onOpen,
        headline = { Text(course.title) },
        supporting = { Text(stringResource(R.string.onboarding_library_course_fits)) },
        leading = { Icon(painterResource(R.drawable.ic_menu_book), contentDescription = null) },
        chevron = true,
    )
}

/**
 * The plan exists; its exam's official documents are still being read, and the plan will follow them. A [failure] and
 * its [onRetry] show in place of the bar, so the card keeps its place under them.
 */
@Composable
internal fun ColumnScope.NoticeReading(
    document: ExamDocument,
    lastEdition: Boolean,
    warmUpId: String?,
    failure: GenerationFailure?,
    onRetry: (() -> Unit)?,
    hold: ReadyHold,
    next: PlanNext,
) {
    val holding = hold.holding
    val kind = if (document == ExamDocument.GUIDE) GenerationKind.GuideReading else GenerationKind.NoticeReading
    val shown =
        when {
            holding -> READING_RUN.copy(status = GenerationRun.Status.Ready)
            failure != null -> READING_RUN.copy(status = GenerationRun.Status.Failed, failure = failure)
            else -> READING_RUN
        }.copy(warmUpId = warmUpId)
    val title =
        stringResource(
            if (holding) {
                R.string.warm_up_plan_ready
            } else if (lastEdition) {
                R.string.onboarding_reveal_reading_last_title
            } else {
                R.string.onboarding_reveal_reading_title
            },
        )
    SetupWait(
        shown,
        kind,
        AnalyticsEvent.WarmUpSurface.PlanWait,
        title,
        hold,
        stringResource(if (next == PlanNext.Plan) R.string.focustest_see_plan else R.string.onboarding_continue),
        onRetry,
        next,
        waitSurface = "examNotice",
    ) { share ->
        GenerationWait(kind, shown, onRetry, share = share) {
            if (holding) {
                PlanReadyHeading(next)
            } else {
                OnboardingHeading(
                    title,
                    stringResource(
                        when {
                            lastEdition -> R.string.onboarding_reveal_reading_last
                            document == ExamDocument.GUIDE -> R.string.onboarding_reveal_reading_guide
                            else -> R.string.onboarding_reveal_reading_notice
                        },
                    ),
                )
            }
        }
    }
}

@Composable
private fun ColumnScope.RevealBody(
    plan: Plan,
    reveal: com.zoonk.api.models.PlanRevealToday?,
    goal: Goal,
    syllabus: Syllabus?,
    isGuest: Boolean,
    starting: Boolean,
    saveFailed: Boolean,
    playMoment: Boolean,
    onStart: () -> Unit,
    onAdjust: () -> Unit,
    onChangeChoice: () -> Unit,
    onCreateAccount: () -> Unit,
    onSeePlus: () -> Unit,
) {
    SetupContent {
        val studyDay = reveal?.today?.toDayView()
        val today = studyDay?.localDate?.toJavaLocalDate() ?: LocalDate.now()
        val coverage = revealCoverage(plan, goal.kind, syllabus)

        RevealHero(plan, goal, playMoment, today)
        PlanChoiceLines(plan.examChoices, onChange = onChangeChoice)
        PaceLine(plan, goal.kind)
        NoticeDayLine(plan)
        studyDay?.let { RevealToday(it, reveal.minutes, playMoment) }
        reveal?.let { RevealWeek(it) }

        val started = studyDay?.steps?.any { it.isFinished } == true
        PageWaitActions {
            if (saveFailed) {
                Text(
                    stringResource(R.string.onboarding_save_failed),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite },
                )
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onAdjust, modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.onboarding_reveal_adjust))
                }
                Button(
                    busy = starting,
                    onClick = onStart,
                    modifier = Modifier.weight(2f),
                    leadingIcon = { ButtonIcon(R.drawable.ic_play_arrow) },
                ) {
                    Text(
                        stringResource(if (started) R.string.onboarding_continue else R.string.onboarding_reveal_start),
                    )
                }
            }
            if (isGuest) {
                Text(
                    stringResource(R.string.onboarding_reveal_save_note),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                TextButton(onClick = onCreateAccount) { Text(stringResource(R.string.onboarding_create_account_short)) }
            }
        }

        if (plan.roadmapPhases.size >= 2) {
            PlanPhases(plan, today)
        } else {
            plan.revealChapters().takeIf { it.isNotEmpty() }?.let { RevealChapters(it) }
        }

        if (plan.notice == Plan.Notice.USUAL) {
            Text(
                stringResource(R.string.onboarding_reveal_usual_structure),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }

        syllabus?.areaWeights()?.let { AreaWeightList(it) }

        // F16: the plan editor's coverage actions (move the date to cover everything, the syllabus's
        // topics) and choices (bases, study everything) go with this.
        coverage?.let { CoverageWords(it, plan, onSeePlus) }
    }
}

@Composable
private fun PaceLine(
    plan: Plan,
    kind: Goal.Kind,
) {
    if (kind != Goal.Kind.LEARN || plan.schedule.targetDate != null || plan.estimate.endDate == null) return
    Text(
        stringResource(
            if (plan.feasibility?.fits ==
                true
            ) {
                R.string.onboarding_reveal_pace_covers
            } else {
                R.string.onboarding_reveal_pace_time
            },
        ),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
private fun NoticeDayLine(plan: Plan) {
    if (plan.notice == Plan.Notice.USUAL) return
    val locale = currentLocale()
    val noticeDay = plan.schedule.noticeDay
    val noSitting = plan.schedule.noSitting
    val text =
        when {
            noticeDay != null -> {
                val date = formatDate(noticeDay.date.toJavaLocalDate(), locale, DateStyle.Long)
                stringResource(
                    when {
                        noticeDay.estimated -> R.string.onboarding_reveal_notice_day_estimated
                        plan.examDocument == ExamDocument.GUIDE -> R.string.onboarding_reveal_notice_day_guide
                        else -> R.string.onboarding_reveal_notice_day_notice
                    },
                    date,
                )
            }

            noSitting != null -> {
                stringResource(
                    R.string.onboarding_reveal_no_sitting,
                    formatDate(noSitting.month.toJavaLocalDate(), locale, DateStyle.Month),
                )
            }

            else -> {
                return
            }
        }
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

/** What the roadmap's axis shows: "Today" for the current phase, a start for each one after it, nothing before. */
@Composable
private fun phaseWhen(
    phase: PlanPhase,
    locale: Locale,
    today: LocalDate,
): String? =
    when (phase.state) {
        PlanPhase.State.CURRENT -> stringResource(R.string.onboarding_reveal_today)
        PlanPhase.State.UPCOMING -> phase.startDate?.let { formatDate(it.toJavaLocalDate(), locale, DateStyle.Day, today) }
        else -> null
    }

@Composable
private fun PlanPhases(
    plan: Plan,
    today: LocalDate,
) {
    val phases = plan.roadmapPhases
    val currentIndex = phases.indexOfFirst { it.state == PlanPhase.State.CURRENT }
    val current = phases.getOrNull(currentIndex)
    val mocksRequirePlus = plan.access.mocksRequirePlus
    val locale = currentLocale()

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.onboarding_reveal_phases))
        MeterParts(
            phases.map { phase ->
                val fill =
                    when (phase.state) {
                        PlanPhase.State.CURRENT -> MeterPart.Fill.Place()
                        PlanPhase.State.DONE -> MeterPart.Fill.Solid(MaterialTheme.colorScheme.tertiary)
                        else -> MeterPart.Fill.Track
                    }
                MeterPart(fill, phase.weight())
            },
        )
        if (current != null) {
            val day = current.dayOf(today)
            val name = phaseName(current, mocksRequirePlus)
            val place = stringResource(R.string.onboarding_reveal_phase_place, currentIndex + 1, phases.size)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text =
                        listOfNotNull(name, day?.let { stringResource(R.string.onboarding_reveal_phase_day, it.day, it.days) })
                            .factsLine(),
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.labelMedium,
                )
                Text(
                    text = stringResource(R.string.onboarding_reveal_phase_position, currentIndex + 1, phases.size),
                    modifier = Modifier.clearAndSetSemantics { contentDescription = place },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }
        Column {
            phases.forEachIndexed { index, phase ->
                if (index > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                ListRow {
                    StatusMark(
                        status =
                            when (phase.state) {
                                PlanPhase.State.CURRENT -> MarkStatus.Next
                                PlanPhase.State.DONE -> MarkStatus.Done
                                else -> MarkStatus.Todo
                            },
                    )
                    Text(
                        phaseName(phase, mocksRequirePlus),
                        modifier = Modifier.weight(1f),
                        fontWeight = FontWeight.Medium,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    phaseWhen(phase, locale, today)?.let {
                        Text(
                            text = it,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun phaseName(
    phase: PlanPhase,
    mocksRequirePlus: Boolean,
): String {
    val short = phase.short
    return when {
        phase.name.isNotEmpty() -> {
            phase.name
        }

        short != null -> {
            stringResource(
                when (short.focus) {
                    ShortExamFocus.MAP_AND_GAPS -> {
                        R.string.onboarding_reveal_phase_map_and_gaps
                    }

                    ShortExamFocus.PRACTICE -> {
                        R.string.onboarding_reveal_phase_practice
                    }

                    ShortExamFocus.MOCK_AND_PRACTICE -> {
                        when {
                            mocksRequirePlus -> R.string.onboarding_reveal_phase_full_review_and_practice
                            else -> R.string.onboarding_reveal_phase_mock_and_practice
                        }
                    }

                    ShortExamFocus.MOCK_AND_REVIEW -> {
                        when {
                            mocksRequirePlus -> R.string.onboarding_reveal_phase_full_review
                            else -> R.string.onboarding_reveal_phase_short_mock
                        }
                    }

                    ShortExamFocus.LIGHT_REVIEW -> {
                        R.string.onboarding_reveal_phase_light_review
                    }
                },
            )
        }

        else -> {
            when (phase.kind) {
                PlanPhase.Kind.FOUNDATIONS -> stringResource(R.string.onboarding_reveal_phase_foundations)
                PlanPhase.Kind.GAPS -> stringResource(R.string.onboarding_reveal_phase_gaps)
                PlanPhase.Kind.PRACTICE -> stringResource(R.string.onboarding_reveal_phase_practice)
                PlanPhase.Kind.FINAL_STRETCH -> stringResource(R.string.onboarding_reveal_phase_final_stretch)
                PlanPhase.Kind.LEARN, PlanPhase.Kind.AFTER_EXAM -> stringResource(R.string.onboarding_reveal_phase_number, phase.index + 1)
            }
        }
    }
}

@Composable
private fun RevealChapters(chapters: List<PlanPhaseChaptersInner>) {
    val rest = chapters.size - CHAPTERS_SHOWN
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        SectionHeader(stringResource(R.string.onboarding_reveal_chapters))
        Column {
            chapters.take(CHAPTERS_SHOWN).forEachIndexed { index, chapter ->
                if (index > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                ListRow {
                    Text(
                        text = (index + 1).toString(),
                        modifier = Modifier.clearAndSetSemantics {},
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                    )
                    Text(
                        text =
                            when {
                                chapter.skills.isNotEmpty() -> {
                                    pluralStringResource(R.plurals.onboarding_reveal_known_skills, chapter.skills.size, chapter.skills.size)
                                }

                                chapter.title.isEmpty() -> {
                                    stringResource(R.string.onboarding_reveal_more_lessons)
                                }

                                else -> {
                                    chapter.title
                                }
                            },
                        modifier = Modifier.weight(1f),
                        fontWeight = FontWeight.Medium,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }
        if (rest > 0) {
            Text(
                pluralStringResource(R.plurals.onboarding_reveal_more_chapters, rest, rest),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun AreaWeightList(weights: AreaWeights) {
    val locale = currentLocale()
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        SectionHeader(stringResource(R.string.onboarding_reveal_weights))
        Column {
            weights.areas.forEachIndexed { index, area ->
                if (index > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                val percent = formatPercent(area.percent / PERCENT, locale)
                ListRow {
                    Text(
                        area.name,
                        modifier = Modifier.weight(1f),
                        fontWeight = FontWeight.Medium,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Meter(share = area.share, modifier = Modifier.weight(METER_WEIGHT))
                    Text(
                        text = if (area.assumed) stringResource(R.string.onboarding_reveal_estimated_percent, percent) else percent,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                    )
                }
            }
        }
        if (weights.assumed > 0) {
            val oneArea = weights.assumed == 1
            Text(
                stringResource(
                    when (weights.source) {
                        WeightSource.Material -> {
                            if (oneArea) {
                                R.string.onboarding_reveal_estimated_material_area
                            } else {
                                R.string.onboarding_reveal_estimated_material_areas
                            }
                        }

                        WeightSource.Guide -> {
                            if (oneArea) {
                                R.string.onboarding_reveal_estimated_guide_area
                            } else {
                                R.string.onboarding_reveal_estimated_guide_areas
                            }
                        }

                        WeightSource.Notice -> {
                            if (oneArea) {
                                R.string.onboarding_reveal_estimated_notice_area
                            } else {
                                R.string.onboarding_reveal_estimated_notice_areas
                            }
                        }
                    },
                ),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun CoverageWords(
    coverage: RevealCoverage,
    plan: Plan,
    onSeePlus: () -> Unit,
) {
    val locale = currentLocale()
    val time = formatMinutes(plan.schedule.dailyMinutes.toInt(), locale)
    val text =
        when (coverage) {
            RevealCoverage.FreeWeekOver -> {
                return FreeWeekOverNotice(onSeePlus)
            }

            is RevealCoverage.Covered -> {
                coveredText(coverage, time)
            }

            is RevealCoverage.FullCourse -> {
                val targetDate = plan.schedule.targetDate?.toJavaLocalDate()
                if (coverage.end != null && targetDate != null) {
                    stringResource(
                        if (plan.schedule.targetDateNamedMonth) {
                            R.string.onboarding_reveal_full_course_finish_month
                        } else {
                            R.string.onboarding_reveal_full_course_finish
                        },
                        time,
                        formatDate(coverage.end, locale, DateStyle.Month),
                        formatDate(targetDate, locale, if (plan.schedule.targetDateNamedMonth) DateStyle.Month else DateStyle.LongYear),
                    )
                } else {
                    stringResource(R.string.onboarding_reveal_full_course)
                }
            }

            is RevealCoverage.Summary -> {
                listOfNotNull(summaryTitle(coverage.title), coverage.detail?.let { summaryDetail(it, time) }).factsLine()
            }
        }
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun coveredText(
    coverage: RevealCoverage.Covered,
    time: String,
): String {
    val feasibility = coverage.feasibility
    val exam = feasibility.measure == PlanFeasibility.Measure.EXAM
    return stringResource(
        when {
            feasibility.coveredShare < MIN_SHOWN_SHARE -> R.string.onboarding_reveal_covers_nothing
            feasibility.coreFits && exam && feasibility.deepensMostAsked -> R.string.onboarding_reveal_covers_exam_deeper
            feasibility.coreFits && exam -> R.string.onboarding_reveal_covers_exam_lighter
            feasibility.coreFits -> R.string.onboarding_reveal_covers_goal
            exam && coverage.fullCourse -> R.string.onboarding_reveal_covers_exam_after
            exam -> R.string.onboarding_reveal_covers_exam_left_out
            else -> R.string.onboarding_reveal_covers_goal_left_out
        },
        time,
    )
}

@Composable
private fun summaryTitle(title: SummaryTitle): String =
    when (title) {
        is SummaryTitle.Modules -> {
            pluralStringResource(R.plurals.onboarding_reveal_modules, title.count, title.count)
        }

        is SummaryTitle.MaterialTopics -> {
            pluralStringResource(R.plurals.onboarding_reveal_material_topics, title.count, title.count)
        }

        is SummaryTitle.Subjects -> {
            pluralStringResource(
                when (title.document) {
                    ExamDocument.GUIDE -> R.plurals.onboarding_reveal_guide_parts
                    ExamDocument.NOTICE -> R.plurals.onboarding_reveal_notice_subjects
                },
                title.count,
                title.count,
            )
        }
    }

@Composable
private fun summaryDetail(
    detail: SummaryDetail,
    time: String,
): String =
    when (detail) {
        is SummaryDetail.Names -> {
            detail.names.factsLine()
        }

        is SummaryDetail.MostQuestions -> {
            val subjects = detail.subjects.map { (name, questions) -> "$name $questions" }.factsLine()
            stringResource(R.string.onboarding_reveal_most_questions, subjects)
        }

        is SummaryDetail.Topics -> {
            pluralStringResource(R.plurals.onboarding_reveal_topics, detail.count, detail.count)
        }

        is SummaryDetail.AllPlanned -> {
            pluralStringResource(R.plurals.onboarding_reveal_topics_all_planned, detail.total, detail.total)
        }

        is SummaryDetail.DontFit -> {
            pluralStringResource(R.plurals.onboarding_reveal_topics_dont_fit, detail.total, detail.leftOut, detail.total, time)
        }

        is SummaryDetail.Planned -> {
            pluralStringResource(R.plurals.onboarding_reveal_topics_planned, detail.total, detail.planned, detail.total)
        }
    }

/** The plan stays, locked, with what Plus opens. */
@Composable
private fun FreeWeekOverNotice(onSeePlus: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(painterResource(R.drawable.ic_lock), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(R.string.onboarding_reveal_free_week_over_title), style = MaterialTheme.typography.titleSmall)
                Text(
                    stringResource(R.string.onboarding_reveal_free_week_over_body),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
                OutlinedButton(onClick = onSeePlus, modifier = Modifier.padding(top = 8.dp)) {
                    Text(stringResource(R.string.onboarding_see_plus))
                }
            }
        }
    }
}

/** A flat row of a list, one touch target tall. */
@Composable
private fun ListRow(content: @Composable RowScope.() -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .semantics(mergeDescendants = true) {}
                .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

private const val CHAPTERS_SHOWN = 5
private const val PERCENT = 100.0
private const val METER_WEIGHT = 0.5f

/** Below half a percent, the share would read "0%". */
private const val MIN_SHOWN_SHARE = 0.005

private val TODAY_PROGRESS_DELAY = 400.milliseconds
