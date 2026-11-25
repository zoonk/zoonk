package com.zoonk.android.feature.onboarding.start

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.clearText
import androidx.compose.foundation.text.input.maxLengthTrim
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
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
import com.zoonk.android.data.LocalEventTracker
import com.zoonk.android.data.Resource
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.GoalLimitReason
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.goalStartLimit
import com.zoonk.android.feature.onboarding.lifted
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.FilledIconButton
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.GoalBox
import com.zoonk.android.ui.components.GoalExamples
import com.zoonk.android.ui.components.GoalPanel
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.glyphInk
import com.zoonk.android.ui.components.rememberGoalExamples
import com.zoonk.android.ui.components.sendButtonColors
import com.zoonk.android.ui.components.submitOnEnter
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.AllowanceResponse
import com.zoonk.api.models.GoalUnderstanding
import com.zoonk.api.models.OnboardingDraft

@Composable
fun StartGoalScreen(
    route: AppRoute.StartGoal,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val signedIn = session as? SessionState.SignedIn
    StartGoalScreen(
        route,
        app.onboarding,
        app.subscriptions.allowance,
        sessionKey = signedIn?.session?.localId,
        canAttach = signedIn?.isGuest == false,
        navigator,
    )
}

/** [sessionKey] names the session the screen shows, null for a visitor; material needs an account ([canAttach]). */
@Composable
fun StartGoalScreen(
    route: AppRoute.StartGoal,
    store: OnboardingStore,
    allowance: Resource<AllowanceResponse>,
    sessionKey: String?,
    canAttach: Boolean,
    navigator: AppNavigator,
) {
    val analytics = LocalEventTracker.current
    val vm = viewModel { StartGoalViewModel(store, createSavedStateHandle(), route.goal, route.draftId, route.planId, analytics) }
    val hasSession = sessionKey != null
    LaunchedEffect(sessionKey) { vm.followSession(sessionKey, hasAccount = canAttach) }
    val caps by allowance.collectShown()
    val upFront = caps.value?.goalStartLimit()
    val language = currentLocale().language
    val screen = vm.flow.screen
    val actions =
        StartActions(
            createAccount = { navigator.open(AppRoute.Login) },
            subscribe = { navigator.open(AppRoute.Subscription) },
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
    VisitOf(vm.visit)
    ActOn(vm.created) {
        when (it.opens) {
            GoalOpens.Setup -> actions.toSetup(it.id)
            GoalOpens.Explanation -> actions.toExplanation(it.id)
        }
    }
    val backInFlow: (() -> Unit)? =
        when (screen) {
            StartScreen.Questions -> {
                { vm.backToEntry("") }
            }

            is StartScreen.Draft -> {
                {
                    val draft =
                        store.drafts[screen.id]
                            .state.value.value
                    if (draft == null) vm.backToEntry("") else vm.editDraft(draft)
                }
            }

            else -> {
                null
            }
        }

    // While a goal is being made from the card, Back waits with the card's other controls (system, bar and
    // predictive back alike), so the goal is made once and its setup opens from the card the learner confirmed.
    val creating = vm.isCreating
    BackHandler(enabled = backInFlow != null || creating) { if (!creating) backInFlow?.invoke() }

    PageScaffold(
        onBack = { if (!creating) backInFlow?.invoke() ?: navigator.back() },
        backEnabled = !creating,
        actions = {
            if (!hasSession) TextButton(onClick = { navigator.open(AppRoute.Login) }) { Text(stringResource(R.string.gate_log_in)) }
        },
    ) { padding ->
        val draft =
            (screen as? StartScreen.Draft)?.let {
                store.drafts[it.id]
                    .collectShown()
                    .value.value
            }
        PageWithSupportingPane(
            supportingPane = if (showsHowItWorks(upFront, draft)) ({ HowItWorks(hasAccount = canAttach) }) else null,
            modifier = Modifier.padding(padding).consumeWindowInsets(padding),
        ) { paneBeside ->
            SetupColumn {
                when {
                    upFront == GoalLimitReason.Guest && screen == StartScreen.Entry -> {
                        GuestGoalGate(actions.createAccount, onBackToToday = { navigator.showRoot(AppTab.Today) })
                    }

                    upFront == GoalLimitReason.ActiveGoals && screen == StartScreen.Entry -> {
                        GoalLimitScreen(onSubscribe = actions.subscribe, onOpenPlan = actions.openPlan)
                    }

                    screen == StartScreen.Entry -> {
                        Entry(vm, route, canAttach, language, actions, freeNote = !canAttach && !paneBeside)
                    }

                    screen == StartScreen.Questions -> {
                        MaterialQuestions(vm, language, actions)
                    }

                    screen is StartScreen.Sending -> {
                        UnderstandingWait(
                            screen.goal,
                            GenerationRun(),
                            onRetry = null,
                            since = vm.flow.waitStartedAt,
                            attemptId = vm.flow.attemptId,
                            onboardingId = (vm.flow.screen as? StartScreen.Draft)?.id,
                        )
                    }

                    screen is StartScreen.Draft -> {
                        Draft(vm, store, screen.id, hasSession, canAttach, upFront, language, actions)
                    }
                }
            }
        }
    }
}

private class StartActions(
    val createAccount: () -> Unit,
    val subscribe: () -> Unit,
    val openPlan: () -> Unit,
    val toSetup: (String) -> Unit,
    val toExplanation: (String) -> Unit,
)

@Composable
private fun ColumnScope.Entry(
    vm: StartGoalViewModel,
    route: AppRoute.StartGoal,
    canAttach: Boolean,
    language: String,
    actions: StartActions,
    freeNote: Boolean,
) {
    val flow = vm.flow
    val materialGoal = materialGoal(flow)
    val submit = { words: String -> vm.submit(words, materialGoal, language) }

    OnboardingHeading(
        stringResource(R.string.onboarding_start_title),
        stringResource(if (route.planId != null) R.string.onboarding_start_description_shared else R.string.onboarding_start_description),
    )

    GoalBox(
        state = vm.words,
        onSubmit = submit,
        canSubmitEmpty = flow.attached.isNotEmpty() && flow.intent != null,
        leading = {
            IconButton(onClick = vm::toggleAttach, enabled = vm.materialLimitReached == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.CenterStart) {
                    Icon(
                        painterResource(R.drawable.ic_attach_file),
                        contentDescription = stringResource(R.string.onboarding_study_material),
                        modifier = Modifier.glyphInk(R.drawable.ic_attach_file).size(24.dp),
                    )
                }
            }
        },
    )

    if (flow.attached.isNotEmpty()) AttachedChips(flow.attached, vm.unreadable, vm.materialLimitReached, vm::removeAttached)
    if (flow.attached.isNotEmpty() && !vm.isAttachOpen) MaterialIntentChoice(flow.intent, vm::setIntent)
    if (vm.isAttachOpen && !canAttach) SignUpPrompt(actions.createAccount)
    if (vm.isAttachOpen && canAttach) {
        AttachPanel(
            pending = vm.isAttaching,
            failure = vm.attachFailure,
            onFile = { vm.attachFile(it, language) },
            onText = { vm.attachText(it, language) },
            onLink = { vm.attachLink(it, language) },
            onCreateAccount = actions.createAccount,
            onSubscribe = actions.subscribe,
        )
    }

    GoalErrorAlert(vm.entryError, actions.createAccount, actions.openPlan, actions.subscribe)

    if (freeNote) StartFreeNote()

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
private fun ColumnScope.UnderstandingWait(
    goal: String?,
    run: GenerationRun,
    onRetry: (() -> Unit)?,
    since: Long? = null,
    attemptId: String? = null,
    onboardingId: String? = null,
) {
    com.zoonk.android.data
        .TrackVisibleWait("understanding", "curriculum", onboardingId = onboardingId, attemptId = attemptId)
    goal?.let { TypedGoal(it) }
    GenerationWait(kind = GenerationKind.Understanding, run = run, onRetry = onRetry, since = since) {
        OnboardingHeading(
            stringResource(R.string.onboarding_understanding_title),
            stringResource(R.string.onboarding_understanding_description),
        )
    }
}

@Composable
private fun ColumnScope.Draft(
    vm: StartGoalViewModel,
    store: OnboardingStore,
    id: String,
    hasSession: Boolean,
    hasAccount: Boolean,
    upFront: GoalLimitReason?,
    language: String,
    actions: StartActions,
) {
    val resource = store.drafts[id]
    val state by resource.collectShown()
    // A draft not read since a create this device didn't learn the outcome of is waiting for its read again.
    val fresh by resource.freshState.collectAsStateWithLifecycle()

    when (val shown = state) {
        is LoadState.Loaded -> {
            if (fresh is LoadState.Failed) {
                LoadFailedMessage(onRetry = vm::readDraftAgain)
            } else {
                DraftContent(vm, shown.value, rereading = fresh !is LoadState.Loaded, hasAccount, upFront, language, actions)
            }
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
            // Only a signed-in learner's own draft can be read; anyone else starts from their words.
            if (!hasSession) LaunchedEffect(id) { vm.backToEntry("") }
            UnderstandingWait(
                goal = null,
                run = GenerationRun(),
                onRetry = null,
                since = vm.flow.waitStartedAt,
                attemptId = vm.flow.attemptId,
                onboardingId = (vm.flow.screen as? StartScreen.Draft)?.id,
            )
        }
    }
}

@Composable
private fun ColumnScope.DraftContent(
    vm: StartGoalViewModel,
    draft: OnboardingDraft,
    rereading: Boolean,
    hasAccount: Boolean,
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
        vm.settle(draft) { read, question -> explanationInput(read, question, language) }
    }
    LaunchedEffect(draft.activeGoalsLeft) { vm.readRoom(draft.activeGoalsLeft) }

    val back = { vm.editDraft(draft) }
    val limit = vm.draftLimit?.takeUnless { it.lifted() }

    when (val understanding = draft.understanding) {
        null -> {
            when {
                limit != null -> {
                    TypedGoal(draft.prompt)
                    OnboardingHeading(stringResource(R.string.onboarding_understanding_title))
                    GoalErrorAlert(limit, actions.createAccount, actions.openPlan, actions.subscribe)
                }

                vm.readFailed -> {
                    UnderstandingWait(
                        draft.prompt,
                        failedRun(GenerationFailure.Connection),
                        onRetry = vm::reloadRead,
                        attemptId = vm.flow.attemptId,
                        onboardingId = draft.id.toString(),
                    )
                }

                draft.status == OnboardingDraft.Status.UNDERSTANDING && draft.generationId != null -> {
                    val run by vm.follower.run.collectAsStateWithLifecycle()
                    val canRetry = run.failure == GenerationFailure.Connection || vm.follower.canRestart
                    UnderstandingWait(
                        draft.prompt,
                        run,
                        onRetry =
                            vm::retryRun.takeIf {
                                canRetry
                            },
                        since = vm.flow.waitStartedAt,
                        attemptId = vm.flow.attemptId,
                        onboardingId =
                            (vm.flow.screen as? StartScreen.Draft)
                                ?.id,
                    )
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
                    if (vm.isRetrying) {
                        UnderstandingWait(
                            draft.prompt,
                            GenerationRun(),
                            onRetry = null,
                            since = vm.flow.waitStartedAt,
                            attemptId = vm.flow.attemptId,
                            onboardingId = (vm.flow.screen as? StartScreen.Draft)?.id,
                        )
                    } else {
                        UnderstandingWait(
                            draft.prompt,
                            failedRun(failure),
                            onRetry = vm::retryRead,
                            attemptId = vm.flow.attemptId,
                            onboardingId = draft.id.toString(),
                        )
                    }
                }
            }
        }

        is GoalUnderstanding.GoalUnderstandingOneOfValue -> {
            UnderstoodScreen(
                goal = draft.prompt,
                understanding = understanding.value,
                activeGoalsLeft = draft.activeGoalsLeft,
                timeZone = draft.timeZone,
                material = draft.sources.map { it.title },
                materialMissing = draft.materialMissing,
                hasAccount = hasAccount,
                isCreating = vm.isCreating || rereading,
                error = vm.creationError,
                goalLimit = upFront,
                onConfirm = {
                    vm.confirm(understoodGoalsInput(understanding.value, draft.activeGoalsLeft, draft.timeZone))
                },
                edits = FactEdits(vm.editing, vm.savingEdit, vm.failedEdit, vm::edit, vm::revise),
                onRewrite = { vm.rewrite(draft, it, language) },
                onCreateAccount = actions.createAccount,
                onSubscribe = actions.subscribe,
                onOpenPlan = actions.openPlan,
            )
        }

        is GoalUnderstanding.GoalUnderstandingOneOf1Value -> {
            ExplainGoal(
                goal = draft.prompt,
                question = understanding.value.question,
                isStarting = vm.isOpeningExplanation(draft) || rereading,
                error = vm.creationError,
                onStart = { vm.create(explanationInput(draft, understanding.value.question, language), GoalOpens.Explanation) },
                onCreateAccount = actions.createAccount,
                onOpenPlan = actions.openPlan,
                onSubscribe = actions.subscribe,
            )
        }

        is GoalUnderstanding.GoalUnderstandingOneOf2Value -> {
            val instrument = understanding.value.instrument
            val title = stringResource(R.string.onboarding_musicianship_title, instrument)
            val subject = stringResource(R.string.onboarding_musicianship_subject)
            InstrumentGoal(
                goal = draft.prompt,
                instrument = instrument,
                isStarting = vm.isCreating || rereading,
                error = vm.creationError,
                waitlist = vm.waitlist,
                isJoining = vm.isJoining,
                onStartMusicianship = { vm.create(musicianshipInput(draft, instrument, title, subject, language), GoalOpens.Setup) },
                onJoinWaitlist = { vm.joinWaitlist(instrument, language) },
                onCreateAccount = actions.createAccount,
                onOpenPlan = actions.openPlan,
                onSubscribe = actions.subscribe,
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
private fun ColumnScope.MaterialQuestions(
    vm: StartGoalViewModel,
    language: String,
    actions: StartActions,
) {
    val questionField = rememberTextFieldState()
    val question = questionField.text.toString()
    val ask = {
        if (question.isNotBlank() && !vm.isAsking) {
            vm.ask(question.trim(), language)
            questionField.clearText()
        }
    }

    OnboardingHeading(stringResource(R.string.onboarding_questions_title), stringResource(R.string.onboarding_questions_description))

    Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(24.dp)) {
        vm.turns.forEach { turn ->
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                TypedGoal(turn.question)
                MaterialAnswer(turn.outcome, actions.createAccount, actions.subscribe)
            }
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

    // Main's `mt-auto`: on a short transcript the panel waits at the page's bottom, by the thumb and the keyboard.
    Spacer(Modifier.weight(1f))
    QuestionPanel(questionField, ask, vm.isAsking)
}

/**
 * Main's question about material: the goal panel with its field, named "Your question" for TalkBack only, and the
 * round send inside it at the end of the last line.
 */
@Composable
private fun QuestionPanel(
    field: TextFieldState,
    ask: () -> Unit,
    isAsking: Boolean,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    val label = stringResource(R.string.onboarding_your_question)
    val colors = MaterialTheme.colorScheme
    val words = MaterialTheme.typography.bodyLarge.copy(color = colors.onSurface)

    GoalPanel(focused, Modifier.fillMaxWidth()) {
        // Main's `p-1.5 pl-4`, less the 2dp Material's 48dp touch target adds around the 44dp send.
        Row(
            Modifier.padding(start = 16.dp, top = 4.dp, end = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            BasicTextField(
                state = field,
                inputTransformation = InputTransformation.maxLengthTrim(MAX_QUESTION_LENGTH),
                modifier =
                    Modifier
                        .weight(1f)
                        .focusRequester(focus)
                        .submitOnEnter(field, ask)
                        .semantics { contentDescription = label },
                textStyle = words,
                cursorBrush = SolidColor(colors.primary),
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Send),
                onKeyboardAction = { ask() },
                lineLimits = TextFieldLineLimits.MultiLine(maxHeightInLines = 6),
                interactionSource = interaction,
                decorator = { inner ->
                    Box(Modifier.padding(vertical = 14.dp)) {
                        if (field.text.isEmpty()) {
                            Text(stringResource(R.string.onboarding_question_placeholder), color = colors.onSurfaceVariant, style = words)
                        }
                        inner()
                    }
                },
            )
            FilledIconButton(
                busy = isAsking,
                onClick = ask,
                enabled = field.text.isNotBlank(),
                modifier = Modifier.size(SEND_SIZE),
                shape = CircleShape,
                colors = sendButtonColors(),
            ) {
                Icon(
                    painterResource(R.drawable.ic_arrow_upward),
                    contentDescription = stringResource(R.string.onboarding_ask),
                    Modifier.size(20.dp),
                )
            }
        }
    }
}

/** Main's `icon-lg` send: the control height. */
private val SEND_SIZE = 44.dp

@Composable
private fun HowItWorks(hasAccount: Boolean) {
    val steps =
        listOf(
            R.string.onboarding_how_it_works_say,
            R.string.onboarding_how_it_works_answer,
            R.string.onboarding_how_it_works_plan,
        )
    val current = stringResource(R.string.onboarding_how_it_works_current)
    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(stringResource(R.string.onboarding_how_it_works))
        steps.forEachIndexed { index, step ->
            ListRow(
                headline = { Text(stringResource(step)) },
                modifier = Modifier.bleed(LIST_ITEM_INSET),
                highlighted = index == 0,
                stateDescription = current.takeIf { index == 0 },
                leading = { Text((index + 1).toString(), style = MaterialTheme.typography.labelMedium.withTabularFigures()) },
                leadOnFirstLine = true,
            )
        }
        if (!hasAccount) StartFreeNote()
    }
}

@Composable
private fun StartFreeNote() {
    Text(
        stringResource(R.string.onboarding_start_free),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodySmall,
    )
}

private const val MAX_QUESTION_LENGTH = 500

/** "How it works" describes making a plan, so it isn't beside the goals-at-once gate or an explanation offer. */
internal fun showsHowItWorks(
    upFront: GoalLimitReason?,
    draft: OnboardingDraft?,
): Boolean = upFront != GoalLimitReason.ActiveGoals && draft?.understanding !is GoalUnderstanding.GoalUnderstandingOneOf1Value
