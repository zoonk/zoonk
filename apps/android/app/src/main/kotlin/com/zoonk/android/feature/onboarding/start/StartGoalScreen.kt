package com.zoonk.android.feature.onboarding.start

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.core.os.ConfigurationCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.GoalLimitReason
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.goalStartLimit
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.GoalBox
import com.zoonk.android.ui.components.GoalExamples
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.rememberGoalExamples
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.GoalUnderstanding
import com.zoonk.api.models.OnboardingDraft

@Composable
fun StartGoalScreen(
    route: AppRoute.StartGoal,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    StartGoalScreen(route, app.onboarding, canAttach = (session as? SessionState.SignedIn)?.isGuest == false, navigator)
}

/** Material needs an account ([canAttach]): a guest is asked to create one first. */
@Composable
fun StartGoalScreen(
    route: AppRoute.StartGoal,
    store: OnboardingStore,
    canAttach: Boolean,
    navigator: AppNavigator,
) {
    val vm = viewModel { StartGoalViewModel(store, createSavedStateHandle(), route.goal, route.draftId, route.planId) }
    val allowance by store.allowance.collectShown()
    val upFront = allowance.value?.goalStartLimit()
    val language = appLanguage()
    val screen = vm.flow.screen
    val actions =
        StartActions(
            createAccount = { navigator.open(AppRoute.Login) },
            seePlus = { navigator.open(AppRoute.Subscription) },
            openPlan = { navigator.open(AppRoute.Plan()) },
            toSetup = { goalId ->
                navigator.closeSection()
                navigator.open(AppRoute.GoalSetup(goalId))
            },
            toExplanation = { goalId ->
                navigator.closeSection()
                navigator.open(AppRoute.Explain(goalId))
            },
        )
    val backInFlow: (() -> Unit)? =
        when (screen) {
            StartScreen.Questions -> {
                { vm.backToEntry("") }
            }

            is StartScreen.Draft -> {
                {
                    vm.backToEntry(
                        store.drafts[screen.id]
                            .state.value.value
                            ?.prompt
                            .orEmpty(),
                    )
                }
            }

            else -> {
                null
            }
        }

    BackHandler(enabled = backInFlow != null) { backInFlow?.invoke() }

    PageScaffold(onBack = { backInFlow?.invoke() ?: navigator.back() }) { padding ->
        PageWithSupportingPane(
            supportingPane = { HowItWorks(hasAccount = canAttach) },
            modifier = Modifier.padding(padding).consumeWindowInsets(padding),
        ) { _ ->
            StartColumn {
                when {
                    upFront == GoalLimitReason.Guest && screen == StartScreen.Entry -> {
                        GuestGoalGate(actions.createAccount, onBackToToday = { navigator.showRoot(AppTab.Today) })
                    }

                    screen == StartScreen.Entry -> {
                        Entry(vm, route, canAttach, upFront, language, actions)
                    }

                    screen == StartScreen.Questions -> {
                        MaterialQuestions(vm, language)
                    }

                    screen is StartScreen.Sending -> {
                        UnderstandingWait(screen.goal, GenerationRun(), onRetry = null)
                    }

                    screen is StartScreen.Draft -> {
                        Draft(vm, store, screen.id, upFront, language, actions)
                    }
                }
            }
        }
    }
}

private class StartActions(
    val createAccount: () -> Unit,
    val seePlus: () -> Unit,
    val openPlan: () -> Unit,
    val toSetup: (String) -> Unit,
    val toExplanation: (String) -> Unit,
)

@Composable
private fun StartColumn(content: @Composable ColumnScope.() -> Unit) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .imePadding()
                .verticalScroll(rememberScrollState()),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier =
                Modifier
                    .widthIn(max = 640.dp)
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
            content = content,
        )
    }
}

@Composable
private fun Entry(
    vm: StartGoalViewModel,
    route: AppRoute.StartGoal,
    canAttach: Boolean,
    upFront: GoalLimitReason?,
    language: String,
    actions: StartActions,
) {
    val flow = vm.flow
    val materialGoal = materialGoal(flow)
    val submit = { words: String -> vm.submit(words, materialGoal, language) }

    OnboardingHeading(
        stringResource(R.string.onboarding_start_title),
        stringResource(if (route.planId != null) R.string.onboarding_start_description_shared else R.string.onboarding_start_description),
    )

    upFront?.let { GoalLimitNotice(it, upFront = true, onOpenPlan = actions.openPlan) }

    GoalBox(
        value = flow.words,
        onValueChange = vm::setWords,
        onSubmit = submit,
        canSubmitEmpty = flow.attached.isNotEmpty() && flow.intent != null,
        leading = {
            IconButton(onClick = vm::toggleAttach) {
                Icon(painterResource(R.drawable.ic_attach_file), contentDescription = stringResource(R.string.onboarding_study_material))
            }
        },
    )

    if (flow.attached.isNotEmpty()) AttachedChips(flow.attached, vm::removeAttached)
    if (flow.attached.isNotEmpty() && !vm.isAttachOpen) MaterialIntentChoice(flow.intent, vm::setIntent)
    if (vm.isAttachOpen && !canAttach) SignUpPrompt(actions.createAccount)
    if (vm.isAttachOpen && canAttach) {
        AttachPanel(
            pending = vm.isAttaching,
            error = vm.attachFailure?.let { attachErrorMessage(it) },
            onFile = { vm.attachFile(it, language) },
            onText = { vm.attachText(it, language) },
            onLink = { vm.attachLink(it, language) },
        )
    }

    GoalErrorAlert(vm.entryError, actions.createAccount, actions.openPlan)

    GoalExamples(examples = rememberGoalExamples(), onPick = submit)
}

@Composable
private fun materialGoal(flow: StartFlowState): String {
    val notes = stringResource(R.string.onboarding_my_notes)
    val titles = flow.attached.joinToString(", ") { it.title.ifBlank { notes } }
    return stringResource(
        if (flow.intent == MaterialIntent.Exam) R.string.onboarding_material_goal_exam else R.string.onboarding_material_goal_understand,
        titles,
    )
}

@Composable
private fun UnderstandingWait(
    goal: String?,
    run: GenerationRun,
    onRetry: (() -> Unit)?,
) {
    goal?.let { TypedGoal(it) }
    GenerationWait(kind = GenerationKind.Understanding, run = run, onRetry = onRetry) {
        OnboardingHeading(
            stringResource(R.string.onboarding_understanding_title),
            stringResource(R.string.onboarding_understanding_description),
        )
    }
}

@Composable
private fun Draft(
    vm: StartGoalViewModel,
    store: OnboardingStore,
    id: String,
    upFront: GoalLimitReason?,
    language: String,
    actions: StartActions,
) {
    val resource = store.drafts[id]
    val state by resource.collectShown()

    when (val shown = state) {
        is LoadState.Loaded -> {
            DraftContent(vm, shown.value, upFront, language, actions)
        }

        is LoadState.Failed -> {
            if (shown.error == ApiError.NotFound) {
                LaunchedEffect(id) { vm.backToEntry("") }
            } else {
                LoadFailedMessage(onRetry = { vm.reloadRead() })
            }
        }

        LoadState.Empty -> {
            LaunchedEffect(id) { vm.backToEntry("") }
        }

        LoadState.Idle, LoadState.Loading -> {
            UnderstandingWait(goal = null, run = GenerationRun(), onRetry = null)
        }
    }
}

@Composable
private fun DraftContent(
    vm: StartGoalViewModel,
    draft: OnboardingDraft,
    upFront: GoalLimitReason?,
    language: String,
    actions: StartActions,
) {
    val goalId = draft.goalId
    if (goalId != null) {
        LaunchedEffect(goalId) { actions.toSetup(goalId.toString()) }
        return
    }

    LaunchedEffect(draft.id, draft.status, draft.generationId) { vm.follow(draft) }
    LaunchedEffect(draft.id, draft.status) {
        vm.settle(draft, explanation = { read, question -> explanationInput(read, question, language) }, onCreated = actions.toExplanation)
    }

    val back = { vm.backToEntry(draft.prompt) }
    val limit = vm.draftLimit

    when (val understanding = draft.understanding) {
        null -> {
            when {
                limit != null -> {
                    TypedGoal(draft.prompt)
                    OnboardingHeading(stringResource(R.string.onboarding_understanding_title))
                    GoalErrorAlert(limit, actions.createAccount, actions.openPlan)
                }

                vm.readFailed -> {
                    UnderstandingWait(draft.prompt, failedRun(GenerationFailure.Connection), onRetry = vm::reloadRead)
                }

                draft.status == OnboardingDraft.Status.UNDERSTANDING && draft.generationId != null -> {
                    val run by vm.follower.run.collectAsStateWithLifecycle()
                    val canRetry = run.failure == GenerationFailure.Connection || vm.follower.canRestart
                    UnderstandingWait(draft.prompt, run, onRetry = vm.follower::retry.takeIf { canRetry })
                }

                else -> {
                    val failure =
                        if (draft.status ==
                            OnboardingDraft.Status.FAILED
                        ) {
                            GenerationFailure.Generation
                        } else {
                            GenerationFailure.NotStarted
                        }
                    UnderstandingWait(draft.prompt, failedRun(failure), onRetry = vm::retryRead)
                }
            }
        }

        is GoalUnderstanding.GoalUnderstandingOneOfValue -> {
            UnderstoodScreen(
                goal = draft.prompt,
                understanding = understanding.value,
                material = vm.flow.attached.map { it.title },
                isCreating = vm.isCreating,
                error = vm.creationError,
                goalLimit = upFront,
                onConfirm = {
                    val flow = vm.flow
                    vm.confirm(
                        understoodGoalsInput(
                            understanding.value,
                            flow.intent.takeIf { flow.attached.isNotEmpty() },
                            flow.attached.map { it.id },
                        ),
                        onCreated = actions.toSetup,
                    )
                },
                onRevise = vm::revise,
                onRewrite = { vm.rewrite(it, language) },
                onCreateAccount = actions.createAccount,
                onSeePlus = actions.seePlus,
                onOpenPlan = actions.openPlan,
            )
        }

        is GoalUnderstanding.GoalUnderstandingOneOf1Value -> {
            ExplainGoal(
                goal = draft.prompt,
                question = understanding.value.question,
                isStarting = vm.isOpeningExplanation(draft),
                error = vm.creationError,
                onStart = { vm.create(explanationInput(draft, understanding.value.question, language), actions.toExplanation) },
                onCreateAccount = actions.createAccount,
                onOpenPlan = actions.openPlan,
            )
        }

        is GoalUnderstanding.GoalUnderstandingOneOf2Value -> {
            val instrument = understanding.value.instrument
            val title = stringResource(R.string.onboarding_musicianship_title, instrument)
            val subject = stringResource(R.string.onboarding_musicianship_subject)
            InstrumentGoal(
                goal = draft.prompt,
                instrument = instrument,
                isStarting = vm.isCreating,
                error = vm.creationError,
                waitlist = vm.waitlist,
                isJoining = vm.isJoining,
                onStartMusicianship = { vm.create(musicianshipInput(draft, instrument, title, subject, language), actions.toSetup) },
                onJoinWaitlist = { vm.joinWaitlist(instrument, language) },
                onCreateAccount = actions.createAccount,
                onOpenPlan = actions.openPlan,
            )
        }

        is GoalUnderstanding.GoalUnderstandingOneOf3Value -> {
            if (understanding.value.status == com.zoonk.api.models.GoalUnderstandingOneOf3.Status.UNSAFE) {
                DeclinedGoal(draft.prompt, back)
            } else {
                UnclearGoal(draft.prompt, back)
            }
        }
    }
}

private fun failedRun(failure: GenerationFailure) = GenerationRun(status = GenerationRun.Status.Failed, failure = failure)

@Composable
private fun MaterialQuestions(
    vm: StartGoalViewModel,
    language: String,
) {
    var question by rememberSaveable { mutableStateOf("") }
    val ask = {
        if (question.isNotBlank() && !vm.isAsking) {
            vm.ask(question.trim(), language)
            question = ""
        }
    }

    OnboardingHeading(stringResource(R.string.onboarding_questions_title), stringResource(R.string.onboarding_questions_description))

    vm.turns.forEach { turn ->
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            TypedGoal(turn.question)
            MaterialAnswer(turn.outcome)
        }
    }

    if (vm.isAsking) {
        Row(
            modifier = Modifier.semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
            Text(stringResource(R.string.onboarding_questions_reading), style = MaterialTheme.typography.bodyMedium)
        }
    }

    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = question,
            onValueChange = { question = it.take(MAX_QUESTION_LENGTH) },
            modifier = Modifier.weight(1f),
            label = { Text(stringResource(R.string.onboarding_your_question)) },
            placeholder = { Text(stringResource(R.string.onboarding_question_placeholder)) },
            maxLines = 6,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { ask() }),
        )
        FilledIconButton(onClick = ask, enabled = question.isNotBlank() && !vm.isAsking) {
            Icon(painterResource(R.drawable.ic_arrow_upward), contentDescription = stringResource(R.string.onboarding_ask))
        }
    }
}

@Composable
private fun HowItWorks(hasAccount: Boolean) {
    val steps =
        listOf(
            R.string.onboarding_how_it_works_say,
            R.string.onboarding_how_it_works_answer,
            R.string.onboarding_how_it_works_plan,
        )
    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(stringResource(R.string.onboarding_how_it_works))
        steps.forEachIndexed { index, step ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = (index + 1).toString(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
                Text(stringResource(step), style = MaterialTheme.typography.bodyMedium)
            }
        }
        if (!hasAccount) {
            Text(
                stringResource(R.string.onboarding_start_free),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

/** The language the app shows, which reads the learner's words and writes their titles. */
@Composable
internal fun appLanguage(): String =
    ConfigurationCompat.getLocales(LocalConfiguration.current).getFirstMatch(APP_LANGUAGES)?.language ?: "en"

private val APP_LANGUAGES = arrayOf("en", "de", "es", "fr", "pt")
private const val MAX_QUESTION_LENGTH = 500
