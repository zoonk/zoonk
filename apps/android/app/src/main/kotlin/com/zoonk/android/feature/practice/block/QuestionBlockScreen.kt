package com.zoonk.android.feature.practice.block

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.AnswerCheck
import com.zoonk.android.feature.questions.DrillAnswerNotes
import com.zoonk.android.feature.questions.DrillCountdown
import com.zoonk.android.feature.questions.DrillIdeas
import com.zoonk.android.feature.questions.DrillNote
import com.zoonk.android.feature.questions.DrillStartButton
import com.zoonk.android.feature.questions.ItemSetText
import com.zoonk.android.feature.questions.ItemSupport
import com.zoonk.android.feature.questions.NotSureButton
import com.zoonk.android.feature.questions.PlacementNote
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionAnswer
import com.zoonk.android.feature.questions.QuestionFeedback
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.QuestionTitle
import com.zoonk.android.feature.questions.QuotedSource
import com.zoonk.android.feature.questions.ShowAnswersButton
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.feature.session.blockTitle
import com.zoonk.android.feature.session.toDayStep
import com.zoonk.android.feature.tutor.AskTutor
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.StatusMessage
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.api.ApiJson
import com.zoonk.api.models.FeedbackSubmissionContext
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.StudyBlockDetail
import java.util.UUID

@Composable
fun QuestionBlockScreen(
    route: AppRoute.QuestionBlock,
    app: AppContainer,
    navigator: AppNavigator,
) = QuestionBlock(route.sessionId, route.blockId, app, navigator, onClose = navigator::closeTask)

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
    finished: @Composable (StudyBlockCompletion) -> Unit = { BlockFinished(it, onClose) },
) {
    val key = remember(sessionId, blockId) { blockKey(sessionId, blockId) }
    if (key == null) {
        NotFound(onClose)
        return
    }
    val viewModel = viewModel(key = "block:$blockId") { QuestionBlockViewModel(key, app.questionBlocks) }
    val loaded by viewModel.block.collectShown()
    val closed by viewModel.closed.collectAsStateWithLifecycle()

    LaunchedEffect(closed) { if (closed) onClose() }

    when (val state = loaded) {
        is LoadState.Loaded -> {
            val read = remember(state.value) { viewModel.questions(state.value) }
            LaunchedEffect(read) { viewModel.begin(read.questions) }
            val run by viewModel.state.collectAsStateWithLifecycle()
            run?.let { shown ->
                val phase = shown.phase
                if (phase is BlockPhase.Finished) finished(phase.completion) else Runner(read, shown, viewModel, app, navigator, onClose)
            }
        }

        is LoadState.Failed -> {
            if (state.error == ApiError.NotFound) {
                NotFound(onClose)
            } else {
                TaskScaffold(onClose = onClose) { padding ->
                    Box(Modifier.padding(padding)) { LoadFailedMessage(onRetry = { viewModel.reread() }) }
                }
            }
        }

        LoadState.Empty -> {
            NotFound(onClose)
        }

        else -> {
            TaskScaffold(onClose = onClose) { padding ->
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            }
        }
    }
}

private fun blockKey(
    sessionId: String,
    blockId: String,
): BlockKey? = runCatching { BlockKey(UUID.fromString(sessionId), UUID.fromString(blockId)) }.getOrNull()

@Composable
private fun NotFound(onClose: () -> Unit) {
    TaskScaffold(onClose = onClose) { padding ->
        StatusMessage(
            icon = R.drawable.ic_school,
            title = stringResource(R.string.practice_not_found_title),
            description = stringResource(R.string.practice_not_found_description),
            modifier = Modifier.padding(padding),
        ) { Button(onClick = onClose) { Text(stringResource(R.string.practice_back_to_today)) } }
    }
}

@Composable
private fun BlockFinished(
    completion: StudyBlockCompletion,
    onClose: () -> Unit,
) {
    TaskScaffold(
        onClose = onClose,
        bottomBar = {
            ActionBarWidth {
                Button(
                    onClick = onClose,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(stringResource(R.string.practice_continue)) }
            }
        },
    ) { padding -> BlockDone(completion, Modifier.fillMaxSize().padding(padding)) }
}

@Composable
internal fun Runner(
    read: BlockQuestions,
    run: BlockRun,
    viewModel: QuestionBlockViewModel,
    app: AppContainer,
    navigator: AppNavigator,
    onClose: () -> Unit,
) {
    val detail = read.detail
    val questions = read.questions
    val question = questions.getOrNull(run.index)
    var draft by rememberSaveable(run.index, stateSaver = AnswerSaver) { mutableStateOf<Answer?>(null) }
    val title = blockTitle(detail.block.toDayStep())

    TaskScaffold(
        onClose = onClose,
        title = { Text(title, maxLines = 1) },
        actions = { reportTarget(question, run)?.let { ReportProblemMenu(app, it) } },
        bottomBar =
            when (run.phase) {
                BlockPhase.Finishing -> null
                else -> ({ ActionBarWidth { BlockActions(read, run, question, draft, viewModel, app, navigator) } })
            },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (questions.isNotEmpty()) Segments(questions, run)
            BlockBody(read, run, question, onDraft = { draft = it }, viewModel, navigator)
        }
    }
}

@Composable
private fun Segments(
    questions: List<Question>,
    run: BlockRun,
) {
    val label = stringResource(R.string.practice_progress, minOf(run.index + 1, questions.size), questions.size)
    val parts =
        segments(questions, run).map { segment ->
            MeterPart(
                when (segment) {
                    Segment.Ahead -> MeterPart.Fill.Track
                    Segment.Current -> MeterPart.Fill.Place()
                    Segment.Right -> MeterPart.Fill.Solid(MaterialTheme.colorScheme.tertiary)
                    Segment.Wrong -> MeterPart.Fill.Solid(MaterialTheme.colorScheme.error)
                    Segment.Read -> MeterPart.Fill.Solid(MaterialTheme.colorScheme.onSurface.copy(alpha = READ_ALPHA))
                },
            )
        }

    Box(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .padding(bottom = 8.dp)
            .semantics {
                contentDescription = label
                progressBarRangeInfo = ProgressBarRangeInfo(run.index.toFloat(), 0f..questions.size.toFloat())
            },
    ) { MeterParts(parts) }
}

@Composable
private fun BlockBody(
    read: BlockQuestions,
    run: BlockRun,
    question: Question?,
    onDraft: (Answer?) -> Unit,
    viewModel: QuestionBlockViewModel,
    navigator: AppNavigator,
) {
    val phase = run.phase

    if (phase == BlockPhase.Finishing) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        return
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val aside = question?.set?.takeIf { it.listening == null && maxWidth >= ASIDE_FROM }
        val continued =
            question != null && read.questions
                .getOrNull(run.index - 1)
                ?.set
                ?.id == question.set?.id

        Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            Column(
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Column(Modifier.widthIn(max = CONTENT_WIDTH).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    if (phase == BlockPhase.FinishReady) {
                        FinishReady()
                    } else if (question != null) {
                        key(question.itemId) {
                            QuestionArea(
                                read.detail,
                                read.questions,
                                run,
                                question,
                                continued,
                                inlineSet = aside == null,
                                onDraft,
                                viewModel,
                                navigator,
                            )
                        }
                    }
                }
            }

            if (aside != null) {
                Column(
                    Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(end = 16.dp, top = 8.dp, bottom = 8.dp),
                ) { ItemSetText(aside, inAside = true) }
            }
        }
    }
}

@Composable
private fun QuestionArea(
    detail: StudyBlockDetail,
    questions: List<Question>,
    run: BlockRun,
    question: Question,
    continued: Boolean,
    inlineSet: Boolean,
    onDraft: (Answer?) -> Unit,
    viewModel: QuestionBlockViewModel,
    navigator: AppNavigator,
) {
    val drill = question.drill
    val phase = run.phase
    val checked = phase as? BlockPhase.Checked
    val words = detail.trueFalseWords
    val openLesson: (String) -> Unit = { lessonId -> navigator.open(AppRoute.Lesson(lessonId)) }

    if (drill != null && run.stage == DrillStage.Ideas) {
        DrillIdeas(drill, openLesson)
        return
    }

    if (isNetScored(question, detail)) SwipeScore(netTally(questions, run))
    if (checked == null) question.timeMachine?.let { TimeMachine(it, question.format, words) }

    val first = questions.getOrNull(run.index - 1)?.mistakeId != question.mistakeId
    if (drill != null && !drill.isIdeaFirst && (first || drill.isReadFirst)) DrillNote(drill, openLesson)
    val seconds = drill?.timeLimitSeconds
    if (seconds != null && phase == BlockPhase.Answering) {
        DrillCountdown(seconds = seconds, onTimeUp = { viewModel.timeUp(question, seconds) })
    }

    question.set?.let { set ->
        if (set.listening != null) {
            ListeningSet(set)
        } else if (inlineSet) {
            ItemSetText(set, continued = continued)
        }
    }

    if (run.stage == DrillStage.Reading) {
        question.citation?.takeIf { question.quoted }?.let { QuotedSource(it) }
        ItemSupport(question)
        QuestionTitle(question.question)
        return
    }

    if (question.placement) PlacementNote()
    question.citation?.takeIf { question.quoted }?.let { QuotedSource(it) }
    ItemSupport(question)
    if (question.format != QuestionFormat.TrueFalse) QuestionTitle(question.question, graded = checked != null)

    QuestionAnswer(
        question = question,
        words = words,
        allowBlank = isNetScored(question, detail),
        check = checked?.let { AnswerCheck(it.answer, it.feedback.correctAnswer, it.feedback.isCorrect) },
        enabled = run.canAnswer,
        onAnswer = onDraft,
        onSubmit = { viewModel.submit(question, it) },
    )

    if (checked != null) {
        QuestionFeedback(
            question = question,
            answer = checked.answer,
            feedback = checked.feedback,
            words = words,
            examTomorrow = false,
            timedOut = run.timedOut,
        ) {
            DrillAnswerNotes(drill, notSure = checked.answer == Answer.DontKnow, timedOut = run.timedOut, trap = checked.feedback.trap)
            question.timeMachine?.let { TimeMachineNote(it, question.format, words, right = checked.feedback.isCorrect) }
        }
        if (checked.feedback.pauseSuggested) PauseSuggestion(viewModel)
    }
}

@Composable
private fun BlockActions(
    read: BlockQuestions,
    run: BlockRun,
    question: Question?,
    draft: Answer?,
    viewModel: QuestionBlockViewModel,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val phase = run.phase
    val ask: @Composable () -> Unit = {
        if (question != null && !(question.drill?.timeLimitSeconds != null && phase == BlockPhase.Answering)) {
            AskTutor(
                TutorScope.Item(
                    question.itemId,
                    read.detail.block.id
                        .toString(),
                    answered = phase is BlockPhase.Checked,
                ),
                app,
                navigator,
            )
        }
    }

    when {
        phase == BlockPhase.FinishReady -> {
            Button(onClick = viewModel::finish, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.practice_finish)) }
        }

        phase == BlockPhase.FinishFailed -> {
            SaveError(onRetry = viewModel::finish)
        }

        phase == BlockPhase.AlreadyAnswered -> {
            ActionColumn {
                Text(stringResource(R.string.practice_already_answered), style = MaterialTheme.typography.bodyMedium)
                Button(onClick = viewModel::reread, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.practice_continue)) }
            }
        }

        phase is BlockPhase.Checked -> {
            ActionRow(ask) {
                Button(
                    onClick = { viewModel.next(read.questions) },
                    modifier = Modifier.weight(1f),
                ) { Text(stringResource(R.string.practice_continue)) }
            }
        }

        question == null -> {}

        run.stage == DrillStage.Ideas -> {
            DrillStartButton(onStart = { viewModel.startDrill(read.questions) })
        }

        run.stage == DrillStage.Reading -> {
            ShowAnswersButton(onReveal = viewModel::reveal)
        }

        else -> {
            ActionColumn {
                if (phase == BlockPhase.AnswerFailed) SaveErrorText()
                ActionRow(ask) {
                    when (notSureOffer(question)) {
                        NotSure.Drill -> {
                            NotSureButton(onClick = { viewModel.submit(question, Answer.DontKnow) }, enabled = run.canAnswer)
                        }

                        NotSure.DontKnowYet -> {
                            NotSureButton(
                                onClick = { viewModel.submit(question, Answer.DontKnow) },
                                enabled = run.canAnswer,
                                label = stringResource(R.string.questions_dont_know_yet),
                            )
                        }

                        null -> {}
                    }
                    CheckButton(busy = phase == BlockPhase.Checking, enabled = run.canAnswer && draft != null) {
                        draft?.let { viewModel.submit(question, it) }
                    }
                }
            }
        }
    }
}

private fun reportTarget(
    question: Question?,
    run: BlockRun,
): FeedbackTarget? {
    if (question == null || run.stage == DrillStage.Ideas) return null
    // A timed drill's clock never waits on a menu, so its question is reported once answered.
    if (question.drill?.timeLimitSeconds != null && run.phase !is BlockPhase.Checked) return null
    return FeedbackTarget("question-block", FeedbackSubmissionContext.ContentKind.ITEM, UUID.fromString(question.itemId))
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

private val AnswerSaver =
    Saver<Answer?, String>(
        save = { it?.let { answer -> ApiJson.encodeToString(Answer.serializer(), answer) } ?: "" },
        restore = { it.takeIf(String::isNotEmpty)?.let { json -> ApiJson.decodeFromString(Answer.serializer(), json) } },
    )

private val ASIDE_FROM = 840.dp
private val CONTENT_WIDTH = 640.dp
private const val READ_ALPHA = 0.25f
