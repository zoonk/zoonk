package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.READING_RUN
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.goalcontent.RevealStructure
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.feature.plan.ADJUST_CHOICES
import com.zoonk.android.feature.plan.PlanChoiceLines
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.DayView
import com.zoonk.android.feature.session.toDayView
import com.zoonk.android.feature.warmup.ReadyHold
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.MarkIcon
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.Goal
import com.zoonk.api.models.OnboardingLibraryCourse
import com.zoonk.api.models.Plan
import com.zoonk.api.models.Syllabus
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import kotlin.time.Duration

/** Reading the plan starts no work; opening a step is a learner tap. */
@Composable
internal fun ColumnScope.PlanRevealStep(
    goal: Goal,
    isGuest: Boolean,
    run: GenerationRun,
    onRetryRun: (() -> Unit)?,
    plans: PlanStore,
    navigator: AppNavigator,
    onReveal: () -> Unit = {},
    saving: Boolean = false,
    saveFailed: Boolean = false,
    onUseNoticeDay: (LocalDate) -> Unit = {},
    onOpenStep: ((DayView, DayStep) -> Unit)? = null,
    startStepFailed: Boolean = false,
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
                val todayState = today?.collectShown()?.value
                val day = todayState?.value?.today?.toDayView()
                val syllabus by plans.syllabus[goal.id].collectShown()
                RevealBody(
                    plan = plan,
                    studyDay = day,
                    goal = goal,
                    syllabus = syllabus.value,
                    // The structure waits for the syllabus, so it never shows the path and then swaps to subjects.
                    syllabusRead = syllabus != LoadState.Idle && syllabus != LoadState.Loading,
                    isGuest = isGuest,
                    starting = saving || todayState == LoadState.Idle || todayState == LoadState.Loading,
                    startError =
                        when {
                            saveFailed -> R.string.onboarding_save_failed
                            startStepFailed -> R.string.today_step_open_failed
                            else -> null
                        },
                    onStart = {
                        val step = day?.steps?.firstOrNull { it.position == day.nextPosition && it.canOpen }
                        if (day != null && step != null && onOpenStep != null) {
                            onOpenStep(day, step)
                        } else {
                            onReveal()
                        }
                    },
                    // Adjust opens the Plan tab until the plan editor (F16) can open here.
                    onAdjust = {
                        navigator.closeSection()
                        navigator.open(AppRoute.Plan())
                    },
                    onChangeChoice = {
                        navigator.closeSection()
                        navigator.open(AppRoute.Plan(focus = ADJUST_CHOICES))
                    },
                    onUseNoticeDay = onUseNoticeDay,
                    onCreateAccount = { navigator.open(AppRoute.Login) },
                )
            }
        }
    }
}

/** Where the learner goes once the plan is ready: the time question, or the plan itself. */
internal enum class PlanNext { TimeQuestion, Plan }

/** Where a reveal leads once the setup's visit acts on it: Today, and the step it opened over it. */
internal fun leadToRevealed(
    navigator: AppNavigator,
    revealed: Revealed,
) {
    navigator.closeSection()
    navigator.open(AppRoute.Today)
    revealed.step?.let(navigator::open)
}

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
        stringResource(if (next == PlanNext.Plan) R.string.onboarding_see_plan else R.string.onboarding_continue),
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
        modifier = Modifier.bleed(com.zoonk.android.ui.components.LIST_ITEM_INSET),
        headline = { Text(course.title) },
        supporting = { Text(stringResource(R.string.onboarding_library_course_fits)) },
        leading = { MarkIcon(R.drawable.ic_menu_book) },
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
        stringResource(if (next == PlanNext.Plan) R.string.onboarding_see_plan else R.string.onboarding_continue),
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
    studyDay: DayView?,
    goal: Goal,
    syllabus: Syllabus?,
    syllabusRead: Boolean,
    isGuest: Boolean,
    starting: Boolean,
    startError: Int?,
    onStart: () -> Unit,
    onAdjust: () -> Unit,
    onChangeChoice: () -> Unit,
    onUseNoticeDay: (LocalDate) -> Unit,
    onCreateAccount: () -> Unit,
) {
    val today = studyDay?.localDate?.toJavaLocalDate() ?: LocalDate.now()
    // Main's `RevealPlan`: what the learner chose, to check before starting: the time a day and where the plan ends,
    // an exam's options, and the lines that only show when the plan needs something from them.
    val choices: @Composable () -> Unit = {
        Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
            RevealReadouts(plan, goal, today)
            PlanChoiceLines(plan.examChoices, onChange = onChangeChoice)
            NoticeDayLine(plan, enabled = !starting, onUse = onUseNoticeDay)
            if (plan.notice == Plan.Notice.USUAL) {
                Text(
                    stringResource(R.string.onboarding_reveal_usual_structure),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }

    SetupContent(aside = { RevealPlanPane(choices) }) {
        // A finished moment says so in its title; the goal's name is the line under it.
        StepHeading(stringResource(R.string.warm_up_plan_ready), goal.displayName)
        if (!LocalWaitBeside.current) choices()
        if (syllabusRead) RevealStructure(plan, syllabus)

        val started = studyDay?.steps?.any { it.isFinished } == true
        PageActions {
            if (startError != null) {
                Text(
                    stringResource(startError),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite },
                )
            }
            TaskActions { main ->
                OutlinedButton(onClick = onAdjust) {
                    Text(stringResource(R.string.plan_adjust_plan))
                }
                Button(busy = starting, onClick = onStart, modifier = main) {
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
                TextButton(onClick = onCreateAccount) { Text(stringResource(R.string.onboarding_create_account)) }
            }
        }
    }
}

/** The supporting pane: "Your plan", with its own scroll and margins, as the setup's plan-so-far pane has. */
@Composable
private fun RevealPlanPane(choices: @Composable () -> Unit) {
    Column(Modifier.verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.plan_your_plan))
        choices()
    }
}

/** Main's `RevealNoticeDay`: the exam's day research found after the plan was built, with the way to use it. */
@Composable
private fun NoticeDayLine(
    plan: Plan,
    enabled: Boolean,
    onUse: (LocalDate) -> Unit,
) {
    if (plan.notice == Plan.Notice.USUAL) return
    val locale = currentLocale()
    val noticeDay = plan.schedule.noticeDay
    val noSitting = plan.schedule.noSitting
    val text =
        when {
            noticeDay != null -> {
                val date = formatDate(noticeDay.date.toJavaLocalDate(), locale, DateStyle.Long)
                stringResource(
                    if (noticeDay.estimated) {
                        R.string.onboarding_reveal_notice_day_estimated
                    } else {
                        R.string.onboarding_reveal_notice_day_notice
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
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        noticeDay?.let { day ->
            TextButton(onClick = { onUse(day.date.toJavaLocalDate()) }, enabled = enabled) {
                Text(stringResource(R.string.onboarding_use_this_date))
            }
        }
    }
}
