package com.zoonk.android.feature.practice.block

import androidx.activity.compose.BackHandler
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.practice.ActionColumn
import com.zoonk.android.feature.practice.ActionFlow
import com.zoonk.android.feature.practice.AnswerActions
import com.zoonk.android.feature.practice.Draft
import com.zoonk.android.feature.practice.QuestionRun
import com.zoonk.android.feature.practice.RunAskButton
import com.zoonk.android.feature.practice.RunFinished
import com.zoonk.android.feature.practice.RunFrame
import com.zoonk.android.feature.practice.RunLoadFailed
import com.zoonk.android.feature.practice.RunLoading
import com.zoonk.android.feature.practice.RunNotFound
import com.zoonk.android.feature.practice.RunPhase
import com.zoonk.android.feature.practice.RunQuestion
import com.zoonk.android.feature.practice.SaveErrorText
import com.zoonk.android.feature.practice.answerAction
import com.zoonk.android.feature.practice.answerFor
import com.zoonk.android.feature.practice.rememberDraft
import com.zoonk.android.feature.practice.runAccount
import com.zoonk.android.feature.practice.runReportTarget
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.feature.session.blockTitle
import com.zoonk.android.feature.session.toDayStep
import com.zoonk.android.feature.today.TodayRead
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.MomentReadouts
import com.zoonk.android.ui.components.MomentScore
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.StudyBlockDetail
import java.util.UUID

@Composable
fun QuestionBlockScreen(
    route: AppRoute.QuestionBlock,
    app: AppContainer,
    navigator: AppNavigator,
) {
    // The session's own day says whether the exam is tomorrow; Today has it read already.
    val examTomorrow =
        remember(route) {
            ((app.today.today.state.value as? LoadState.Loaded)?.value as? TodayRead.Day)
                ?.day
                ?.takeIf { it.sessionId?.toString() == route.sessionId }
                ?.examTomorrow == true
        }
    QuestionBlock(route.sessionId, route.blockId, app, navigator, onClose = navigator::closeTask, examTomorrow = examTomorrow)
}

/**
 * A session's practice or review block played one question at a time (main's `QuestionBlock`), for
 * its own route or a session screen hosting it. [finished] takes the whole screen once the block is
 * done, as main's day moment does.
 */
@Composable
fun QuestionBlock(
    sessionId: String,
    blockId: String,
    app: AppContainer,
    navigator: AppNavigator,
    onClose: () -> Unit,
    examTomorrow: Boolean = false,
    finished: (@Composable (StudyBlockCompletion) -> Unit)? = null,
) {
    val key = remember(sessionId, blockId) { blockKey(sessionId, blockId) }
    if (key == null) {
        BackHandler(onBack = onClose)
        RunNotFound(onClose)
        return
    }
    val viewModel = viewModel(key = "block:$blockId:${runAccount(app)}") { QuestionBlockViewModel(key, app.questionBlocks) }
    val loaded by viewModel.block.collectShown()
    val closed by viewModel.closed.collectAsStateWithLifecycle()
    val close = viewModel::close

    BackHandler(onBack = close)
    LaunchedEffect(closed) { if (closed) onClose() }

    when (val state = loaded) {
        is LoadState.Loaded -> {
            val read = remember(state.value) { viewModel.questions(state.value) }
            LaunchedEffect(read) { viewModel.begin(read.questions) }
            val run by viewModel.state.collectAsStateWithLifecycle()
            run?.let { shown ->
                val phase = shown.phase
                when {
                    phase !is RunPhase.Finished -> Runner(read, shown, viewModel, app, navigator, close, examTomorrow)
                    finished != null -> finished(phase.completion)
                    else -> BlockFinished(phase.completion, read.detail.isReview, close)
                }
            }
        }

        is LoadState.Failed -> {
            if (state.error == ApiError.NotFound) {
                RunNotFound(close)
            } else {
                RunLoadFailed(close, onRetry = viewModel::reread)
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

private fun blockKey(
    sessionId: String,
    blockId: String,
): BlockKey? = runCatching { BlockKey(UUID.fromString(sessionId), UUID.fromString(blockId)) }.getOrNull()

/** The block's result in place of its questions; [completion] null while it saves. */
@Composable
private fun BlockFinished(
    completion: StudyBlockCompletion?,
    review: Boolean,
    onClose: () -> Unit,
) {
    RunFinished(
        title = stringResource(if (review) R.string.practice_done_review else R.string.practice_done_title),
        action = stringResource(R.string.practice_continue),
        saving = completion == null,
        onClose = onClose,
    ) { completion?.let { MomentReadouts(it.brainPower, score = MomentScore(it.total.toInt(), it.correct.toInt())) } }
}

private val StudyBlockDetail.isReview get() = block.kind == StudyBlock.Kind.REVIEW

@Composable
internal fun Runner(
    read: BlockQuestions,
    run: QuestionRun,
    viewModel: QuestionBlockViewModel,
    app: AppContainer,
    navigator: AppNavigator,
    onClose: () -> Unit,
    examTomorrow: Boolean = false,
) {
    val detail = read.detail
    val questions = read.questions
    val question = questions.getOrNull(run.index)
    var saved by rememberDraft()
    val draft = saved.answerFor(run, question)

    if (run.phase == RunPhase.Finishing) {
        BlockFinished(null, detail.isReview, onClose)
        return
    }

    val mainAction: (() -> Unit)? =
        when (run.phase) {
            RunPhase.FinishReady, RunPhase.FinishFailed -> viewModel::finish
            RunPhase.AlreadyAnswered -> viewModel::reread
            else -> answerAction(questions, question, run, draft, viewModel)
        }

    RunFrame(
        title = blockTitle(detail.block.toDayStep()),
        questions = questions,
        run = run,
        question = question,
        app = app,
        onClose = onClose,
        mainAction = mainAction,
        report = runReportTarget("question-block", question, run),
        actions = { BlockActions(read, run, question, draft, viewModel, app, navigator) },
    ) { inlineSet ->
        if (run.phase == RunPhase.FinishReady) {
            FinishReady()
        } else if (question != null) {
            key(run.index) {
                RunQuestion(
                    questions = questions,
                    run = run,
                    question = question,
                    controls = viewModel,
                    words = detail.trueFalseWords,
                    navigator = navigator,
                    inlineSet = inlineSet,
                    onDraft = { answer -> saved = Draft(run.index, question.itemId, answer) },
                    netScored = isNetScored(question, detail),
                    examTomorrow = examTomorrow,
                ) { if ((run.phase as? RunPhase.Checked)?.feedback?.pauseSuggested == true) PauseSuggestion(viewModel) }
            }
        }
    }
}

@Composable
private fun BlockActions(
    read: BlockQuestions,
    run: QuestionRun,
    question: Question?,
    draft: Answer?,
    viewModel: QuestionBlockViewModel,
    app: AppContainer,
    navigator: AppNavigator,
) {
    when (run.phase) {
        RunPhase.FinishReady -> {
            ActionFlow { width ->
                Button(onClick = viewModel::finish, modifier = width) { Text(stringResource(R.string.practice_finish)) }
            }
        }

        RunPhase.FinishFailed -> {
            ActionColumn {
                SaveErrorText()
                ActionFlow { width ->
                    Button(onClick = viewModel::finish, modifier = width) { Text(stringResource(R.string.practice_try_again)) }
                }
            }
        }

        RunPhase.AlreadyAnswered -> {
            ActionColumn {
                Text(stringResource(R.string.practice_already_answered), style = MaterialTheme.typography.bodyMedium)
                ActionFlow { width ->
                    Button(onClick = viewModel::reread, modifier = width) { Text(stringResource(R.string.practice_continue)) }
                }
            }
        }

        else -> {
            question?.let {
                AnswerActions(read.questions, it, run, draft, viewModel, ask = {
                    RunAskButton(
                        it,
                        run,
                        read.detail.block.id
                            .toString(),
                        app,
                        navigator,
                    )
                })
            }
        }
    }
}

private val StudyBlockDetail.trueFalseWords: TrueFalseWords
    get() = if (trueFalseLabels.value == "rightWrong") TrueFalseWords.RightWrong else TrueFalseWords.TrueFalse

/** A swipe capsule scores net; outside capsules, the block says. */
private fun isNetScored(
    question: Question,
    detail: StudyBlockDetail,
): Boolean =
    detail.block.capsules
        .firstOrNull { it.key == question.capsuleKey }
        ?.let { it.format.value == "swipe" }
        ?: detail.block.netScored
