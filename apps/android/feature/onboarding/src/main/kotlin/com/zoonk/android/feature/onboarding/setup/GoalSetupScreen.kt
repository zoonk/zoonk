package com.zoonk.android.feature.onboarding.setup

import androidx.activity.compose.BackHandler
import androidx.activity.compose.LocalOnBackPressedDispatcherOwner
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationFirstLesson
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.TrackDeckReceived
import com.zoonk.android.data.TrackOnboardingQuestion
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.activities.ActivityAnnouncement
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.onboarding.LocalOnboardingAnnounce
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.Refusal
import com.zoonk.android.feature.onboarding.start.text
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.warmup.WaitQuizState
import com.zoonk.android.feature.warmup.WarmUpStore
import com.zoonk.android.feature.warmup.rememberWaitQuiz
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.AlertDialog
import com.zoonk.android.ui.components.DropdownMenu
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.NotFoundMessage
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageSpan
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.onPageSpan
import com.zoonk.android.ui.scaffold.pageFold
import com.zoonk.android.ui.scaffold.spreadFold
import com.zoonk.android.ui.scaffold.supportingPaneBeside
import com.zoonk.api.models.Goal
import com.zoonk.api.models.Onboarding
import com.zoonk.api.models.OnboardingAnswerInput.OnboardingAnswerInputOneOf9Value
import com.zoonk.api.models.OnboardingAnswerInputOneOf9
import com.zoonk.api.models.OnboardingStep
import kotlinx.datetime.toJavaLocalDate
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

@Composable
fun GoalSetupScreen(
    route: AppRoute.GoalSetup,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val buddy =
        com.zoonk.android.feature.ceremonies
            .momentBuddy(app)
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val signedIn = session as? SessionState.SignedIn
    CompositionLocalProvider(
        LocalRevealBuddy provides buddy,
        LocalSetupDrafts provides signedIn?.session?.let { SetupDrafts(app.drafts, it) },
        LocalSetupSpeech provides app.speech,
    ) {
        GoalSetupScreen(
            route,
            app.onboarding,
            app.plans,
            app.mocks,
            isGuest = signedIn?.isGuest == true,
            navigator,
            warmUps = app.warmUps,
            prepareToday = { app.today.today.refresh() },
        )
    }
}

@Composable
fun GoalSetupScreen(
    route: AppRoute.GoalSetup,
    store: OnboardingStore,
    plans: PlanStore,
    mocks: MockStore,
    isGuest: Boolean,
    navigator: AppNavigator,
    warmUps: WarmUpStore? = null,
    prepareToday: suspend () -> Unit = {},
) {
    val backDispatcher = LocalOnBackPressedDispatcherOwner.current?.onBackPressedDispatcher
    val drafts = LocalSetupDrafts.current
    val vm = viewModel { GoalSetupViewModel(store, drafts, createSavedStateHandle(), route.goalId, route.revealMoment) }
    val state by store.onboardings[vm.goalId].collectShown()
    val run by vm.follower.run.collectAsStateWithLifecycle()
    val claimed = state.value?.warmUp
    val deckId = run.warmUpId ?: claimed?.takeIf { it.status.value == "ready" }?.id?.toString()
    val coming =
        (claimed != null || deckId != null) &&
            (run.status == GenerationRun.Status.Waiting || run.status == GenerationRun.Status.Following) &&
            run.steps["warmUpFailed"] != com.zoonk.android.data.StepState.Completed
    val quiz = key(vm.goalId) { rememberWaitQuiz(deckId, warmUps, coming) }
    TrackDeckReceived(
        vm.goalId,
        deckId,
        state.value
            ?.goal
            ?.details
            .text("onboardingId"),
    )
    val view = (state as? LoadState.Loaded)?.value
    val step = vm.flow.current
    val inQuestions = step != null && step != OnboardingStep.PLAN
    val testing = vm.placementProgress.takeIf { step == OnboardingStep.PLACEMENT }
    val back = { vm.back() }.takeIf { inQuestions && testing == null && vm.flow.history.isNotEmpty() }

    // The time question keeps what the learner set while a screen after it is open, such as the date they went to change.
    val schedule = rememberSaveableStateHolder()
    val keepsSchedule = step == OnboardingStep.SCHEDULE || OnboardingStep.SCHEDULE in vm.flow.history
    LaunchedEffect(keepsSchedule) { if (!keepsSchedule) schedule.removeState(OnboardingStep.SCHEDULE.value) }

    view?.let { LaunchedEffect(it.goal.id) { vm.begin(it) } }
    if (view?.goal?.kind == Goal.Kind.EXPLAIN) {
        LaunchedEffect(view.goal.id) {
            navigator.closeSection()
            navigator.open(AppRoute.Explain(view.goal.id.toString()))
        }
    }

    // A test's answers are final and saved: its Back leaves the setup as Finish later does, never a
    // step back, and Start over waits until it ends.
    val leave = { navigator.showRoot(AppTab.Today) }
    BackHandler(enabled = back != null || testing != null) { if (testing != null) leave() else back?.invoke() }

    PageScaffold(
        onBack = {
            if (backDispatcher?.hasEnabledCallbacks() == true) backDispatcher.onBackPressed() else navigator.back()
        },
        title = {
            when {
                testing != null -> {
                    Meter(
                        share = testing,
                        modifier = Modifier.width(STEP_DOTS_WIDTH),
                        color = MaterialTheme.colorScheme.primary,
                        contentDescription = stringResource(R.string.onboarding_placement_progress),
                    )
                }

                else -> {
                    view?.let { setupProgress(vm.flow, it.steps) }?.let { StepDots(it) }
                }
            }
        },
        actions = {
            if (view != null && inQuestions && testing == null) {
                MoreMenu(
                    disabled = vm.isSaving || vm.isStartingOver,
                    onFinishLater = { navigator.showRoot(AppTab.Today) },
                    onStartOver = {
                        vm.startOver(view.goalIds.map { it.toString() }) {
                            navigator.closeSection()
                            navigator.open(AppRoute.StartGoal())
                        }
                    },
                )
            }
        },
    ) { padding ->
        var span by remember { mutableStateOf<PageSpan?>(null) }
        var announced by remember { mutableStateOf("") }
        val announce = remember { { text: String -> announced = text } }

        BoxWithConstraints(Modifier.padding(padding).consumeWindowInsets(padding).onPageSpan { span = it }) {
            val fold = spreadFold(maxWidth, span)
            val bookFold = pageFold(maxWidth, span)
            CompositionLocalProvider(
                LocalSetupQuiz provides quiz,
                LocalWaitBeside provides (fold != null || supportingPaneBeside(maxWidth)),
                LocalSetupLayout provides
                    SetupLayout(
                        fold,
                        supportingPane = fold == null && (testing == null || bookFold == null),
                        foldAside = testing == null,
                        aside = { view?.let { PlanSoFar(it.goal) } },
                        failure =
                            if (vm.saveFailed && step != OnboardingStep.PLAN) {
                                vm.dayTooShort?.let { dayTooShortWords(it) } ?: stringResource(R.string.onboarding_save_failed)
                            } else {
                                null
                            },
                    ),
            ) {
                Column(Modifier.fillMaxSize()) {
                    when (val shown = state) {
                        is LoadState.Loaded -> {
                            step?.let {
                                val setupStep: @Composable () -> Unit = {
                                    SetupStep(
                                        it,
                                        shown.value,
                                        vm,
                                        store,
                                        plans,
                                        mocks,
                                        isGuest,
                                        navigator,
                                        route,
                                        prepareToday,
                                        announce,
                                        run,
                                    )
                                }
                                if (it == OnboardingStep.SCHEDULE) schedule.SaveableStateProvider(it.value, setupStep) else setupStep()
                            }
                        }

                        is LoadState.Failed -> {
                            SetupContent {
                                if (shown.error == ApiError.NotFound) {
                                    NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) })
                                } else {
                                    LoadFailedMessage(onRetry = { vm.reload() })
                                }
                            }
                        }

                        else -> {}
                    }
                }
            }
            ActivityAnnouncement(announced)
        }
    }
}

@Composable
private fun ColumnScope.SetupStep(
    step: OnboardingStep,
    view: Onboarding,
    vm: GoalSetupViewModel,
    store: OnboardingStore,
    plans: PlanStore,
    mocks: MockStore,
    isGuest: Boolean,
    navigator: AppNavigator,
    route: AppRoute.GoalSetup,
    prepareToday: suspend () -> Unit,
    announce: (String) -> Unit,
    run: GenerationRun,
) {
    val subject = view.subject()
    val pending = vm.isSaving
    val onRetryRun = vm.follower::retry.takeIf { run.failure == GenerationFailure.Connection || vm.follower.canRestart }
    val onboardingId = view.goal.details.text("onboardingId")
    if (step != OnboardingStep.SCHEDULE && step != OnboardingStep.PLAN &&
        step != OnboardingStep.PLACEMENT
    ) {
        TrackOnboardingQuestion(view.goal.id.toString(), step.value, onboardingId)
    }
    val savedFirst = view.firstLesson
    val liveFirst = run.firstLesson
    val firstLesson =
        if (savedFirst != null &&
            (liveFirst == null || (savedFirst.id.toString() == liveFirst.id && savedFirst.status.value != "writing"))
        ) {
            GenerationFirstLesson(
                savedFirst.id.toString(),
                savedFirst.title,
                ready = savedFirst.status.value == "ready",
                done =
                    savedFirst.status.value == "done",
            )
        } else {
            liveFirst?.copy(title = liveFirst.title ?: savedFirst?.title)
        }
    // Placement follows the run itself, so only the questions say it stopped.
    val planStart = PlanStart(run, onRetryRun).takeIf { step != OnboardingStep.PLACEMENT && step != OnboardingStep.PLAN }

    CompositionLocalProvider(
        LocalPlanStart provides planStart,
        LocalSetupAim provides
            SetupAimContext(
                view.languageAim,
                vm.isSaving,
                vm.saveFailed,
                { aim, done -> vm.changeAim(plans, aim, done) },
            ),
        LocalSetupWait provides
            SetupWaitContext(
                view.goal.id.toString(),
                firstLesson,
                firstLesson?.let { first -> { navigator.open(AppRoute.Lesson(first.id)) } },
                view.planReadiness.ready || run.planMade,
                run.warmUpId,
                view.libraryCourse,
                view.libraryCourse?.let { course -> { navigator.open(AppRoute.CatalogCourse(course.courseId.toString())) } },
            ),
        LocalOnboardingAnnounce provides announce,
    ) {
        QuestionStep(
            step,
            view,
            vm,
            store,
            plans,
            mocks,
            isGuest,
            navigator,
            route,
            subject,
            pending,
            run,
            onRetryRun,
            prepareToday,
        )
    }
}

@Composable
private fun ColumnScope.QuestionStep(
    step: OnboardingStep,
    view: Onboarding,
    vm: GoalSetupViewModel,
    store: OnboardingStore,
    plans: PlanStore,
    mocks: MockStore,
    isGuest: Boolean,
    navigator: AppNavigator,
    route: AppRoute.GoalSetup,
    subject: String,
    pending: Boolean,
    run: GenerationRun,
    onRetryRun: (() -> Unit)?,
    prepareToday: suspend () -> Unit,
) {
    when (step) {
        OnboardingStep.PURPOSE -> {
            PurposeStep(subject, pending, vm::answer)
        }

        OnboardingStep.ROLE -> {
            RoleStep(
                careerChange = view.goal.details.text("purpose") == "careerChange",
                pending,
                rememberUnsentWords(vm.goalId, step.value, count = 2),
                vm::answer,
            )
        }

        OnboardingStep.REASON -> {
            ReasonStep(subject, view.languageAim, pending, rememberUnsentWords(vm.goalId, step.value, count = 2), vm::answer)
        }

        OnboardingStep.TARGET -> {
            TextStep(
                when (view.goal.details.text("examTarget")) {
                    "position" -> TextQuestion.Position
                    "score" -> TextQuestion.Score
                    else -> TextQuestion.Admission
                },
                subject,
                pending,
                rememberUnsentWords(vm.goalId, step.value, count = 1),
                vm::answer,
            )
        }

        OnboardingStep.TARGET_DATE -> {
            DateStep(
                subject,
                view.examDays,
                view.goal.targetDate?.toJavaLocalDate(),
                view.dateProblem,
                view.goal.timezone,
                pending,
                vm::answer,
            )
        }

        OnboardingStep.FOLLOW_UPS -> {
            FollowUpsStep(view.followUps, pending, rememberUnsentWords(vm.goalId, step.value, count = view.followUps.size), vm::answer)
        }

        OnboardingStep.EXAM_CHOICE -> {
            ExamChoiceStep(subject, view.examChoices, pending, vm::answer)
        }

        OnboardingStep.LEVEL -> {
            if (view.examSubjects.size > 1) {
                SubjectsLevelStep(subject, view.examSubjects, view.goal.details.texts("knownSubjects"), pending, vm::answer)
            } else {
                LevelStep(subject, view.goal.levelChoice(), view.quickTestMinutes.toInt(), pending, vm::answer)
            }
        }

        OnboardingStep.SCHEDULE -> {
            ScheduleStep(
                view.goal,
                view.recommendedMinutes.toInt(),
                view.timeChoices,
                view.planReadiness,
                run,
                store,
                vm,
                pending,
                factsBeside = LocalWaitBeside.current,
            )
        }

        OnboardingStep.BUDDY -> {
            BuddyStep(pending, vm::answer)
        }

        OnboardingStep.PLACEMENT -> {
            val placed = {
                vm.answer(
                    OnboardingAnswerInputOneOf9Value(OnboardingAnswerInputOneOf9(OnboardingAnswerInputOneOf9.Question.PLACEMENT)),
                    from = OnboardingStep.PLACEMENT,
                )
            }
            val targetLanguage = view.goal.targetLanguage
            if (view.goal.kind == Goal.Kind.LANGUAGE && targetLanguage != null) {
                LanguageLevelTestStep(
                    goalId = view.goal.id.toString(),
                    language =
                        view.goal.details
                            .text("nativeLanguage")
                            ?.takeIf(String::isNotBlank) ?: view.goal.language,
                    targetLanguage = targetLanguage,
                    testMinutes = view.quickTestMinutes.toInt(),
                    store = store,
                    navigator = navigator,
                    onProgress = { vm.placementProgress = it },
                    onDone = placed,
                )
            } else {
                PlacementStep(
                    goalId = view.goal.id.toString(),
                    subject = subject,
                    areaCount = view.examSubjects.size,
                    run = run,
                    onRetryRun = onRetryRun,
                    store = store,
                    mocks = mocks,
                    navigator = navigator,
                    onProgress = { vm.placementProgress = it },
                    onDone = placed,
                )
            }
        }

        OnboardingStep.PLAN -> {
            PlanRevealStep(
                view.goal,
                isGuest,
                run,
                onRetryRun,
                plans,
                navigator,
                route,
                prepareToday,
                onReveal = vm::reveal,
                saving = vm.isSaving,
                saveFailed = vm.saveFailed,
                playMoment = vm::takeRevealMoment,
                planRevealed = view.planRevealed,
                today = store.revealToday[view.goal.id.toString()],
            )
        }
    }
}

@Composable
private fun StepDots(progress: SetupProgress) {
    val (answered, total) = progress
    val ink = MaterialTheme.colorScheme.onSurface
    MeterParts(
        parts =
            (0 until total).map { index ->
                MeterPart(
                    when {
                        index < answered -> MeterPart.Fill.Solid(ink.copy(alpha = DONE_ALPHA))
                        index == answered -> MeterPart.Fill.Solid(ink)
                        else -> MeterPart.Fill.Track
                    },
                )
            },
        modifier = Modifier.width(STEP_DOTS_WIDTH),
        contentDescription = stringResource(R.string.onboarding_step_of, answered + 1, total),
    )
}

@Composable
private fun MoreMenu(
    disabled: Boolean,
    onFinishLater: () -> Unit,
    onStartOver: () -> Unit,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    var confirming by rememberSaveable { mutableStateOf(false) }

    Box {
        IconButton(onClick = { open = true }, enabled = !disabled) {
            Icon(painterResource(R.drawable.ic_more_vert), contentDescription = stringResource(R.string.onboarding_more))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { MenuText(R.string.onboarding_finish_later, R.string.onboarding_finish_later_description) },
                onClick = {
                    open = false
                    onFinishLater()
                },
            )
            DropdownMenuItem(
                text = { MenuText(R.string.onboarding_start_over, R.string.onboarding_start_over_description) },
                onClick = {
                    open = false
                    confirming = true
                },
            )
        }
    }

    if (confirming) {
        AlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text(stringResource(R.string.onboarding_start_over_title)) },
            text = { Text(stringResource(R.string.onboarding_start_over_confirm)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirming = false
                        onStartOver()
                    },
                ) { Text(stringResource(R.string.onboarding_start_over)) }
            },
            dismissButton = { TextButton(onClick = { confirming = false }) { Text(stringResource(R.string.onboarding_cancel)) } },
        )
    }
}

@Composable
private fun MenuText(
    title: Int,
    description: Int,
) {
    Column {
        Text(stringResource(title))
        Text(stringResource(description), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    }
}

private fun Onboarding.subject(): String = goal.details.text("subject") ?: goal.title

private fun Goal.levelChoice(): LevelChoice? {
    val level =
        details.text("level")?.let { saved ->
            com.zoonk.api.models.OnboardingAnswerInputOneOf7.Level.entries.find {
                it.value ==
                    saved
            }
        }
    if (level != null) return LevelChoice.Own(level)
    val answered = (details["answered"] as? JsonArray)?.any { (it as? JsonPrimitive)?.contentOrNull == "level" } == true
    return LevelChoice.QuickTest.takeIf { answered }
}

private fun Map<String, kotlinx.serialization.json.JsonElement>.texts(key: String): List<String> =
    (get(key) as? JsonArray).orEmpty().mapNotNull { (it as? JsonPrimitive)?.contentOrNull }

private const val DONE_ALPHA = 0.25f

private val STEP_DOTS_WIDTH = 96.dp

@Composable
private fun dayTooShortWords(short: Refusal.DayTooShort): String =
    pluralStringResource(R.plurals.onboarding_day_too_short, short.goals, formatMinutes(short.minutes, currentLocale()), short.goals)
