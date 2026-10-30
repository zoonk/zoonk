package com.zoonk.android.feature.testout

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
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
import com.zoonk.android.data.LiveGenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.ceremonies.MomentAfterCeremony
import com.zoonk.android.feature.player.LessonTitle
import com.zoonk.android.feature.practice.ActionBarWidth
import com.zoonk.android.feature.practice.ActionColumn
import com.zoonk.android.feature.practice.ActionFlow
import com.zoonk.android.feature.practice.BusyButton
import com.zoonk.android.feature.practice.ChoiceQuestionsRun
import com.zoonk.android.feature.practice.RunFinished
import com.zoonk.android.feature.practice.RunLoadFailed
import com.zoonk.android.feature.practice.RunLoading
import com.zoonk.android.feature.practice.RunNotFound
import com.zoonk.android.feature.practice.runColumn
import com.zoonk.android.feature.session.DayMoment
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.MomentReadouts
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.theme.withTabularFigures
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.math.roundToInt

/** `/test-out/{chapterId}`: "Already know this?" for a chapter of the goal in the switcher. */
@Composable
fun TestOutScreen(
    route: AppRoute.TestOut,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val chapterId = remember(route.chapterId) { runCatching { UUID.fromString(route.chapterId) }.getOrNull() }
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val signedIn = (session as? SessionState.SignedIn)?.session
    val summary by app.learnerSummary.summary.collectShown()
    val scope = rememberCoroutineScope()
    val close = navigator::closeTask
    val learner = summary.value

    if (chapterId == null) {
        RunNotFound(close)
        return
    }
    if (signedIn == null || learner == null) {
        if (summary is LoadState.Failed) {
            RunLoadFailed(close, onRetry = { scope.launch { app.learnerSummary.summary.refresh() } })
        } else {
            RunLoading(close)
        }
        return
    }
    val goalId = learner.activeGoalId
    if (goalId == null) {
        LaunchedEffect(Unit) { navigator.showRoot(AppTab.Today) }
        RunLoading(close)
        return
    }

    val key = TestOutKey(goalId, chapterId)
    val viewModel =
        viewModel(key = "test-out:$goalId:$chapterId:${signedIn.localId}") {
            TestOutViewModel(
                key,
                app.testOuts,
                app.plans,
                app.testOuts.answers(signedIn, key),
                LiveGenerationSource(app.api, signedIn),
                createSavedStateHandle(),
            )
        }
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val plan by app.plans.plan[goalId].collectShown()
    val chapter =
        plan.value
            ?.plan
            ?.phases
            ?.let { planChapter(it, chapterId) }
    val chapterTitle = chapter?.title ?: stringResource(R.string.testout_this_chapter)
    val page =
        TestOutPage(
            title = if (plan.isSettled) stringResource(R.string.testout_title, chapterTitle) else "",
            chapterTitle = chapterTitle,
            lessonsLeft = chapter?.lessonsLeft,
        )

    val showChapter = { navigator.open(AppRoute.Chapter(route.chapterId)) }

    LaunchedEffect(ui.nothingToSkip) { if (ui.nothingToSkip) showChapter() }

    val outcome = ui.outcome
    val sent = ui.sent
    when {
        outcome != null -> TestOutResult(outcome, ui, viewModel, app, close)
        sent != null && !ui.sending -> RecordedTestOut(viewModel, sent, close)
        else -> TestOutBody(viewModel, ui, page, app, navigator, showChapter)
    }
}

internal data class TestOutPage(
    val title: String,
    val chapterTitle: String,
    val lessonsLeft: Int?,
)

/** Waits only while nothing is known, so the title doesn't name a placeholder before the chapter. */
private val LoadState<*>.isSettled: Boolean get() = this != LoadState.Idle && this != LoadState.Loading

@Composable
private fun RecordedTestOut(
    viewModel: TestOutViewModel,
    requestId: String,
    onClose: () -> Unit,
) {
    val record = viewModel.record(requestId)
    val read by record.collectShown()
    val scope = rememberCoroutineScope()
    LaunchedEffect(read) { viewModel.showRecorded(read) }
    if (read is LoadState.Failed) {
        RunLoadFailed(onClose, onRetry = { scope.launch { record.refresh() } })
    } else {
        RunLoading(onClose)
    }
}

@Composable
private fun TestOutBody(
    viewModel: TestOutViewModel,
    ui: TestOutUi,
    page: TestOutPage,
    app: AppContainer,
    navigator: AppNavigator,
    showChapter: () -> Unit,
) {
    val loaded by viewModel.testOut.collectShown()
    val scope = rememberCoroutineScope()
    val close = navigator::closeTask

    when (val read = loaded) {
        is LoadState.Loaded -> {
            when (val test = read.value) {
                is TestOutRead.Ready -> {
                    if (test.questions.isEmpty() || ui.writing) {
                        TestOutPreparing(viewModel, ui, page.title, plusRequired = false, navigator)
                    } else {
                        TestOutQuestions(test, viewModel, ui, page, app, close)
                    }
                }

                TestOutRead.PlusRequired -> {
                    TestOutPreparing(viewModel, ui, page.title, plusRequired = true, navigator)
                }

                TestOutRead.NothingToSkip -> {
                    LaunchedEffect(Unit) { showChapter() }
                    RunLoading(close)
                }
            }
        }

        is LoadState.Failed -> {
            if (read.error == ApiError.NotFound) {
                RunNotFound(close)
            } else {
                RunLoadFailed(close, onRetry = { scope.launch { viewModel.testOut.refresh() } })
            }
        }

        LoadState.Empty -> {
            RunNotFound(close)
        }

        else -> {
            RunLoading(close)
        }
    }
}

@Composable
internal fun TestOutPreparing(
    viewModel: TestOutViewModel,
    ui: TestOutUi,
    title: String,
    plusRequired: Boolean,
    navigator: AppNavigator,
) {
    val run by viewModel.run.collectAsStateWithLifecycle()
    val waiting = ui.writing || ui.startFailed

    TaskScaffold(
        onClose = navigator::closeTask,
        title = { LessonTitle(title) },
        bottomBar =
            if (waiting) {
                null
            } else {
                { ActionBarWidth { StartActions(viewModel, ui, plusRequired || ui.plusRequired, navigator) } }
            },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(Modifier.runColumn(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                if (waiting) {
                    GenerationWait(
                        kind = GenerationKind.TestOutQuestions,
                        run = if (ui.writing) run else GenerationRun(GenerationRun.Status.Failed, GenerationFailure.NotStarted),
                        onRetry = if (ui.writing) viewModel::retryWriting.takeIf { viewModel.canRestart } else viewModel::start,
                    ) {
                        Heading(stringResource(R.string.testout_writing_title))
                        Detail(stringResource(R.string.testout_writing_detail))
                    }
                } else {
                    Heading(stringResource(R.string.testout_intro_title))
                    Detail(stringResource(R.string.testout_intro_detail))
                }
            }
        }
    }
}

@Composable
private fun StartActions(
    viewModel: TestOutViewModel,
    ui: TestOutUi,
    plusRequired: Boolean,
    navigator: AppNavigator,
) {
    val refused = ui.refused
    when {
        plusRequired -> {
            ActionColumn {
                PlusNotice(
                    onSeePlus = null,
                    title = stringResource(R.string.subscription_free_week_over_title),
                    description = stringResource(R.string.subscription_free_week_over_description),
                )
                ActionFlow { width ->
                    Button(onClick = { navigator.open(AppRoute.Subscription) }, modifier = width) {
                        Text(stringResource(R.string.testout_see_plus))
                    }
                }
            }
        }

        refused != null -> {
            LimitNotice(
                refused,
                LimitSubject.Help,
                onCreateAccount = { navigator.open(AppRoute.Login) },
                onSeePlus = { navigator.open(AppRoute.Subscription) },
            )
        }

        else -> {
            ActionFlow { width ->
                BusyButton(
                    stringResource(if (ui.starting) R.string.testout_starting else R.string.testout_start),
                    busy = ui.starting,
                    enabled = true,
                    modifier = width,
                    onClick = viewModel::start,
                )
            }
        }
    }
}

@Composable
internal fun TestOutQuestions(
    test: TestOutRead.Ready,
    viewModel: TestOutViewModel,
    ui: TestOutUi,
    page: TestOutPage,
    app: AppContainer,
    onClose: () -> Unit,
) {
    LaunchedEffect(test.questions) { viewModel.begin(test.questions) }
    val answers = ui.answers
    if (answers == null) {
        RunLoading(onClose)
        return
    }
    val rule = stringResource(R.string.testout_rule, (test.passMark * PERCENT).roundToInt())

    ChoiceQuestionsRun(
        title = page.title,
        questions = test.questions,
        answered = answers.size,
        words = test.words,
        app = app,
        screen = "test-out",
        pending = ui.sending,
        failed = ui.sendFailed,
        onAnswer = { question, answer -> viewModel.answer(test.questions, question, answer) },
        onRetry = viewModel::retrySend,
        onClose = onClose,
        hint = rule,
        aside = { TestOutAside(page, rule) },
    )
}

@Composable
private fun TestOutAside(
    page: TestOutPage,
    rule: String,
) {
    val title = stringResource(R.string.testout_aside_title)
    Column(Modifier.semantics { paneTitle = title }, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(painterResource(R.drawable.ic_menu_book), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(page.chapterTitle, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
            page.lessonsLeft?.takeIf { it > 0 }?.let {
                Text(
                    pluralStringResource(R.plurals.testout_lessons_left, it, it),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }
        Text(rule, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
internal fun TestOutResult(
    outcome: TestOutOutcome,
    ui: TestOutUi,
    viewModel: TestOutViewModel,
    app: AppContainer,
    onClose: () -> Unit,
) {
    val undone = ui.undo == UndoState.Done
    val detail =
        when {
            !outcome.passed -> stringResource(R.string.testout_not_passed_detail)
            undone -> stringResource(R.string.testout_lessons_back)
            outcome.skippedLessons == 0 -> stringResource(R.string.testout_already_skipped)
            else -> pluralStringResource(R.plurals.testout_lessons_off, outcome.skippedLessons, outcome.skippedLessons)
        }
    val canUndo = outcome.changeId != null && !undone

    MomentAfterCeremony(app, outcome.ceremony.takeIf { ui.celebrate }) { buddy ->
        RunFinished(
            title = stringResource(if (outcome.passed) R.string.testout_passed else R.string.testout_not_passed),
            action = stringResource(R.string.testout_continue),
            saving = false,
            onClose = onClose,
            detail = detail,
            actions = {
                ActionColumn {
                    if (ui.undo == UndoState.Failed) {
                        Text(
                            stringResource(R.string.testout_undo_failed),
                            Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                    ActionFlow { width ->
                        if (canUndo) {
                            TextButton(onClick = viewModel::undo, enabled = ui.undo != UndoState.Pending) {
                                Text(stringResource(R.string.testout_undo))
                            }
                        }
                        Button(onClick = onClose, modifier = width) { Text(stringResource(R.string.testout_continue)) }
                    }
                }
            },
        ) {
            MomentReadouts(brainPower = 0, facts = listOf(scoreLine(outcome)))
            outcome.reached?.takeIf { ui.celebrate }?.let { reached ->
                DayMoment(missions = null, reached = reached, ceremony = outcome.ceremony?.kind, buddy = buddy.look, buddyName = buddy.name)
            }
        }
    }
}

@Composable
private fun scoreLine(outcome: TestOutOutcome): String {
    val locale = currentLocale()
    return pluralStringResource(
        R.plurals.moment_score,
        outcome.correct,
        formatNumber(outcome.correct.toDouble(), locale),
        formatNumber(outcome.total.toDouble(), locale),
    )
}

@Composable
private fun Heading(text: String) {
    Text(text, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
}

@Composable
private fun Detail(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
}

private const val PERCENT = 100
