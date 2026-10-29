package com.zoonk.android.feature.onboarding.setup

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
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
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.start.text
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.api.models.Goal
import com.zoonk.api.models.Onboarding
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
    val session by app.sessions.state.collectAsStateWithLifecycle()
    GoalSetupScreen(route, app.onboarding, isGuest = (session as? SessionState.SignedIn)?.isGuest == true, navigator)
}

@Composable
fun GoalSetupScreen(
    route: AppRoute.GoalSetup,
    store: OnboardingStore,
    isGuest: Boolean,
    navigator: AppNavigator,
) {
    val vm = viewModel { GoalSetupViewModel(store, createSavedStateHandle(), route.goalId) }
    val state by store.onboardings[vm.goalId].collectShown()
    val view = (state as? LoadState.Loaded)?.value
    val step = vm.flow.current
    val inQuestions = step != null && step != OnboardingStep.PLAN
    val back = { vm.back() }.takeIf { inQuestions && vm.flow.history.isNotEmpty() }

    view?.let { LaunchedEffect(it.goal.id) { vm.begin(it) } }
    if (view?.goal?.kind == Goal.Kind.EXPLAIN) {
        LaunchedEffect(view.goal.id) {
            navigator.closeSection()
            navigator.open(AppRoute.Explain(view.goal.id.toString()))
        }
    }

    BackHandler(enabled = back != null) { back?.invoke() }

    PageScaffold(
        onBack = { back?.invoke() ?: navigator.back() },
        title = { if (view != null && step in QUESTION_SCREENS) StepDots(view, vm.flow) },
        actions = {
            if (view != null && inQuestions) {
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
        PageWithSupportingPane(
            supportingPane = { view?.let { PlanSoFar(it.goal) } },
            modifier = Modifier.padding(padding).consumeWindowInsets(padding),
        ) { _ ->
            when (val shown = state) {
                is LoadState.Loaded -> {
                    SetupColumn {
                        if (vm.saveFailed) {
                            Text(
                                stringResource(R.string.onboarding_save_failed),
                                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                        step?.let { SetupStep(it, shown.value, vm, store, isGuest, navigator) }
                    }
                }

                is LoadState.Failed -> {
                    LoadFailedMessage(onRetry = { vm.reload() })
                }

                else -> {}
            }
        }
    }
}

@Composable
private fun ColumnScope.SetupStep(
    step: OnboardingStep,
    view: Onboarding,
    vm: GoalSetupViewModel,
    store: OnboardingStore,
    isGuest: Boolean,
    navigator: AppNavigator,
) {
    val subject = view.subject()
    val pending = vm.isSaving
    val run by vm.follower.run.collectAsStateWithLifecycle()
    val onRetryRun = vm.follower::retry.takeIf { run.failure == GenerationFailure.Connection || vm.follower.canRestart }
    // Placement follows the run itself, so only the questions say it stopped.
    val planStart = PlanStart(run, onRetryRun).takeIf { step != OnboardingStep.PLACEMENT && step != OnboardingStep.PLAN }

    CompositionLocalProvider(LocalPlanStart provides planStart) {
        QuestionStep(step, view, vm, store, isGuest, navigator, subject, pending, run, onRetryRun)
    }
}

@Composable
private fun ColumnScope.QuestionStep(
    step: OnboardingStep,
    view: Onboarding,
    vm: GoalSetupViewModel,
    store: OnboardingStore,
    isGuest: Boolean,
    navigator: AppNavigator,
    subject: String,
    pending: Boolean,
    run: GenerationRun,
    onRetryRun: (() -> Unit)?,
) {
    when (step) {
        OnboardingStep.PURPOSE -> {
            PurposeStep(subject, pending, vm::answer)
        }

        OnboardingStep.ROLE -> {
            RoleStep(careerChange = view.goal.details.text("purpose") == "careerChange", pending, vm::answer)
        }

        OnboardingStep.REASON -> {
            TextStep(TextQuestion.Reason, subject, pending, vm::answer)
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
                vm::answer,
            )
        }

        OnboardingStep.TARGET_DATE -> {
            DateStep(subject, view.examDays, view.goal.targetDate?.toJavaLocalDate(), pending, vm::answer)
        }

        OnboardingStep.FOLLOW_UPS -> {
            FollowUpsStep(view.followUps, pending, vm::answer)
        }

        OnboardingStep.EXAM_CHOICE -> {
            ExamChoiceStep(subject, view.examChoices, pending, vm::answer)
        }

        OnboardingStep.LEVEL -> {
            if (view.examSubjects.size > 1) {
                SubjectsLevelStep(subject, view.examSubjects, view.goal.details.texts("knownSubjects"), pending, vm::answer)
            } else {
                LevelStep(subject, view.goal.levelChoice(), pending, vm::answer)
            }
        }

        OnboardingStep.SCHEDULE -> {
            ScheduleStep(view.goal, view.recommendedMinutes.toInt(), run, store, vm, pending)
        }

        OnboardingStep.BUDDY -> {
            BuddyStep(pending, vm::answer)
        }

        OnboardingStep.PLACEMENT -> {
            PlacementStep(
                goalId = view.goal.id.toString(),
                subject = subject,
                areaCount = view.examSubjects.size,
                run = run,
                onRetryRun = onRetryRun,
                store = store,
                navigator = navigator,
                onDone = {
                    vm.answer(
                        com.zoonk.api.models.OnboardingAnswerInput.OnboardingAnswerInputOneOf9Value(
                            com.zoonk.api.models.OnboardingAnswerInputOneOf9(
                                com.zoonk.api.models.OnboardingAnswerInputOneOf9.Question.PLACEMENT,
                            ),
                        ),
                    )
                },
            )
        }

        OnboardingStep.PLAN -> {
            PlanRevealStep(view.goal, isGuest, view.libraryCourse, run, onRetryRun, store, navigator)
        }
    }
}

/** At least the window's height, so a step's actions can sit at its bottom on phones. */
@Composable
private fun SetupColumn(content: @Composable ColumnScope.() -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize().imePadding()) {
        val windowHeight = maxHeight
        Box(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), contentAlignment = Alignment.TopCenter) {
            Column(
                modifier =
                    Modifier
                        .widthIn(max = 640.dp)
                        .fillMaxWidth()
                        .heightIn(min = windowHeight)
                        .padding(horizontal = 24.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp),
                content = content,
            )
        }
    }
}

@Composable
private fun StepDots(
    view: Onboarding,
    flow: SetupFlow,
) {
    val answered = flow.history.count { it in QUESTION_SCREENS }
    val ahead = view.steps.count { it in QUESTION_SCREENS && it != flow.current }
    val total = answered + 1 + ahead
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
        modifier = Modifier.width(96.dp),
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
