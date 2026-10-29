package com.zoonk.android.feature.mistakes

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.practice.AnswerActions
import com.zoonk.android.feature.practice.Draft
import com.zoonk.android.feature.practice.RunAskButton
import com.zoonk.android.feature.practice.RunFinished
import com.zoonk.android.feature.practice.RunFrame
import com.zoonk.android.feature.practice.RunLoadFailed
import com.zoonk.android.feature.practice.RunLoading
import com.zoonk.android.feature.practice.RunNotFound
import com.zoonk.android.feature.practice.RunPhase
import com.zoonk.android.feature.practice.RunQuestion
import com.zoonk.android.feature.practice.answerAction
import com.zoonk.android.feature.practice.answerFor
import com.zoonk.android.feature.practice.rememberDraft
import com.zoonk.android.feature.practice.runAccount
import com.zoonk.android.feature.practice.runReportTarget
import com.zoonk.android.feature.questions.savedAnswerText
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.MomentReadouts
import com.zoonk.android.ui.components.MomentScore
import com.zoonk.android.ui.components.StatusMessage
import com.zoonk.android.ui.scaffold.TaskScaffold
import kotlinx.coroutines.launch
import java.util.UUID

@Composable
fun MistakePracticeScreen(
    route: AppRoute.MistakePractice,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val learner = summary.value
    if (learner == null) {
        RunLoading(navigator::closeTask)
        return
    }
    val key = PracticeKey(learner.activeGoalId, route.skillId?.let { runCatching { UUID.fromString(it) }.getOrNull() })
    val viewModel = viewModel(key = "mistake-practice:${route.skillId}:${runAccount(app)}") { MistakePracticeViewModel(key, app.mistakes) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val closed by viewModel.closed.collectAsStateWithLifecycle()

    LaunchedEffect(closed) { if (closed) navigator.closeTask() }

    when (val shown = state) {
        null -> PracticeRead(viewModel, onClose = navigator::closeTask)
        else -> PracticeRun(shown, viewModel, app, navigator)
    }
}

/** Until the run starts; then it keeps its questions while answers refresh the practice. */
@Composable
private fun PracticeRead(
    viewModel: MistakePracticeViewModel,
    onClose: () -> Unit,
) {
    val loaded by viewModel.practice.collectShown()
    val scope = rememberCoroutineScope()

    BackHandler(onBack = onClose)

    when (val read = loaded) {
        is LoadState.Loaded -> {
            LaunchedEffect(read.value) { viewModel.begin(read.value) }
            RunLoading(onClose)
        }

        LoadState.Empty -> {
            NothingToPractice(onClose)
        }

        is LoadState.Failed -> {
            if (read.error == ApiError.NotFound) {
                RunNotFound(onClose, stringResource(R.string.mistakes_not_found_description))
            } else {
                RunLoadFailed(onClose, onRetry = { scope.launch { viewModel.practice.refresh() } })
            }
        }

        else -> {
            RunLoading(onClose)
        }
    }
}

@Composable
internal fun PracticeRun(
    state: PracticeState,
    viewModel: MistakePracticeViewModel,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val run = state.run
    val ending = run.phase == RunPhase.Finishing
    val endsRun = state.answerIds.isNotEmpty() && !ending
    BackHandler(onBack = viewModel::leave)

    if (ending) {
        PracticeDone(state, onClose = viewModel::leave)
        return
    }

    val questions = state.read.questions
    val question = questions.getOrNull(run.index)
    var saved by rememberDraft()
    val draft = saved.answerFor(run, question)

    RunFrame(
        title = stringResource(R.string.mistakes_practice_title),
        questions = questions,
        run = run,
        question = question,
        app = app,
        onClose = viewModel::leave,
        mainAction = answerAction(questions, question, run, draft, viewModel),
        report = runReportTarget("mistake-practice", question, run),
        actions = {
            question?.let {
                AnswerActions(
                    questions,
                    it,
                    run,
                    draft,
                    viewModel,
                    ask = { RunAskButton(it, run, blockId = null, app, navigator) },
                    notSureOnEvery = true,
                )
            }
        },
        closeLabel = if (endsRun) stringResource(R.string.mistakes_practice_end) else null,
    ) { inlineSet ->
        question?.let {
            key(run.index) {
                RunQuestion(
                    questions = questions,
                    run = run,
                    question = it,
                    controls = viewModel,
                    words = state.read.words,
                    navigator = navigator,
                    inlineSet = inlineSet,
                    onDraft = { answer -> saved = Draft(run.index, it.itemId, answer) },
                    lastAnswer = state.read.lastAnswers[run.index]?.let { answer -> savedAnswerText(answer, state.read.words) },
                )
            }
        }
    }
}

@Composable
private fun PracticeDone(
    state: PracticeState,
    onClose: () -> Unit,
) {
    val end = state.end
    val summary = end?.summary
    val fixed = state.fixedIds.size
    val comesBack = if (summary != null) summary.correct < summary.total else fixed == 0

    RunFinished(
        title = stringResource(R.string.practice_done_title),
        action = stringResource(R.string.navigation_back),
        saving = end == null,
        onClose = onClose,
        detail = if (end != null && comesBack) stringResource(R.string.mistakes_practice_comes_back) else null,
    ) {
        MomentReadouts(
            brainPower = summary?.brainPower ?: 0,
            score = summary?.let { MomentScore(it.total.toInt(), it.correct.toInt()) },
            facts = listOfNotNull(fixed.takeIf { it > 0 }?.let { pluralStringResource(R.plurals.mistakes_practice_fixed, it, it) }),
        )
    }
}

@Composable
internal fun NothingToPractice(onClose: () -> Unit) {
    TaskScaffold(onClose = onClose) { padding ->
        StatusMessage(
            icon = R.drawable.ic_edit_square,
            title = stringResource(R.string.mistakes_nothing_title),
            description = stringResource(R.string.mistakes_nothing_description),
            modifier = Modifier.padding(padding),
        ) { Button(onClick = onClose) { Text(stringResource(R.string.navigation_back)) } }
    }
}
