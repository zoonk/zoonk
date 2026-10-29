package com.zoonk.android.feature.practice.block

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
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
import com.zoonk.android.feature.player.LessonTitle
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
import com.zoonk.android.feature.questions.isLongText
import com.zoonk.android.feature.session.blockTitle
import com.zoonk.android.feature.session.toDayStep
import com.zoonk.android.feature.today.TodayRead
import com.zoonk.android.feature.tutor.TutorAskButton
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
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.StudyBlockDetail
import kotlinx.serialization.Serializable
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
    BackHandler(onBack = onClose)
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
                when {
                    phase !is BlockPhase.Finished -> Runner(read, shown, viewModel, app, navigator, onClose, examTomorrow)
                    finished != null -> finished(phase.completion)
                    else -> BlockFinished(phase.completion, read.detail.isReview, onClose)
                }
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
        ) { Button(onClick = onClose) { Text(stringResource(R.string.practice_close)) } }
    }
}

/** The block's result in place of its questions; [completion] null while it saves. */
@Composable
private fun BlockFinished(
    completion: StudyBlockCompletion?,
    review: Boolean,
    onClose: () -> Unit,
) {
    TaskScaffold(
        onClose = onClose,
        bottomBar = {
            ActionBarWidth {
                ActionFlow { width ->
                    Button(onClick = onClose, enabled = completion != null, modifier = width) {
                        if (completion == null) CircularProgressIndicator(Modifier.padding(end = 8.dp).size(18.dp), strokeWidth = 2.dp)
                        Text(stringResource(R.string.practice_continue))
                    }
                }
            }
        },
    ) { padding -> BlockDone(completion, review, Modifier.fillMaxSize().padding(padding)) }
}

private val StudyBlockDetail.isReview get() = block.kind == StudyBlock.Kind.REVIEW

@Composable
internal fun Runner(
    read: BlockQuestions,
    run: BlockRun,
    viewModel: QuestionBlockViewModel,
    app: AppContainer,
    navigator: AppNavigator,
    onClose: () -> Unit,
    examTomorrow: Boolean = false,
) {
    val detail = read.detail
    val questions = read.questions
    val question = questions.getOrNull(run.index)
    // Kept with its question, so a pick restored after the process was gone never answers another.
    var saved by rememberSaveable(stateSaver = DraftSaver) { mutableStateOf<Draft?>(null) }
    val draft = saved?.takeIf { it.itemId == question?.itemId }?.answer
    val title = blockTitle(detail.block.toDayStep())

    if (run.phase == BlockPhase.Finishing) {
        BlockFinished(null, detail.isReview, onClose)
        return
    }

    val focus = remember { FocusRequester() }
    val mainAction: (() -> Unit)? =
        when {
            run.phase is BlockPhase.Checked -> ({ viewModel.next(questions) })
            run.phase == BlockPhase.FinishReady || run.phase == BlockPhase.FinishFailed -> viewModel::finish
            run.phase == BlockPhase.AlreadyAnswered -> viewModel::reread
            question == null -> null
            run.stage == DrillStage.Ideas -> ({ viewModel.startDrill(questions) })
            run.stage == DrillStage.Reading -> viewModel::reveal
            run.canAnswer && draft != null -> ({ viewModel.submit(question, draft) })
            else -> null
        }

    LaunchedEffect(Unit) { focus.requestFocus() }

    TaskScaffold(
        onClose = onClose,
        // A keyboard's Enter runs the main action and Escape leaves, as in the lesson player.
        modifier =
            Modifier.focusRequester(focus).focusable().onKeyEvent { event ->
                when {
                    event.type != KeyEventType.KeyDown -> false
                    event.key == Key.Enter || event.key == Key.NumPadEnter -> mainAction?.invoke() != null
                    event.key == Key.Escape -> true.also { onClose() }
                    else -> false
                }
            },
        title = { LessonTitle(title) },
        actions = { reportTarget(question, run)?.let { ReportProblemMenu(app, it) } },
        bottomBar = { ActionBarWidth { BlockActions(read, run, question, draft, viewModel, app, navigator) } },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (questions.isNotEmpty()) Segments(questions, run)
            BlockBody(read, run, question, onDraft = { answer ->
                saved = question?.let { Draft(it.itemId, answer) }
            }, viewModel, navigator, examTomorrow)
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

    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .widthIn(max = CONTENT_WIDTH)
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 8.dp)
                .semantics {
                    contentDescription = label
                    progressBarRangeInfo = ProgressBarRangeInfo(run.index.toFloat(), 0f..questions.size.toFloat())
                },
        ) { MeterParts(parts) }
    }
}

@Composable
private fun BlockBody(
    read: BlockQuestions,
    run: BlockRun,
    question: Question?,
    onDraft: (Answer?) -> Unit,
    viewModel: QuestionBlockViewModel,
    navigator: AppNavigator,
    examTomorrow: Boolean,
) {
    val phase = run.phase

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val aside = question?.set?.takeIf { it.listening == null && maxWidth >= ASIDE_FROM }
        val continued =
            question != null && read.questions
                .getOrNull(run.index - 1)
                ?.set
                ?.id == question.set?.id

        Row(Modifier.fillMaxSize()) {
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
                                examTomorrow,
                            )
                        }
                    }
                }
            }

            if (aside != null) {
                VerticalDivider()
                // A rail beside the question, half the window only for a long passage, as main's aside.
                val rail = if (isLongText(aside.text)) Modifier.weight(1f) else Modifier.width(ASIDE_WIDTH)
                Column(
                    rail
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 24.dp, vertical = 8.dp),
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
    examTomorrow: Boolean,
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

    if (question.placement && run.stage != DrillStage.Reading) PlacementNote()
    question.citation?.takeIf { question.quoted }?.let { QuotedSource(it) }

    question.set?.let { set ->
        if (set.listening != null) {
            ListeningSet(set)
        } else if (inlineSet) {
            ItemSetText(set, continued = continued)
        }
    }

    ItemSupport(question)

    if (run.stage == DrillStage.Reading) {
        QuestionTitle(question.question)
        return
    }

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
            examTomorrow = examTomorrow,
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
        // Not on a placement question, nor on a timed one before its answer, as main.
        if (question != null && !question.placement && !(question.drill?.timeLimitSeconds != null && phase !is BlockPhase.Checked)) {
            TutorAskButton(
                TutorScope.Item(
                    question.itemId,
                    read.detail.block.id
                        .toString(),
                    answered = phase is BlockPhase.Checked,
                ),
                app,
                navigator,
                worded = phase is BlockPhase.Checked && !phase.feedback.isCorrect,
            )
        }
    }

    when {
        phase == BlockPhase.FinishReady -> {
            ActionFlow { width ->
                Button(onClick = viewModel::finish, modifier = width) { Text(stringResource(R.string.practice_finish)) }
            }
        }

        phase == BlockPhase.FinishFailed -> {
            ActionColumn {
                SaveErrorText()
                ActionFlow { width ->
                    Button(onClick = viewModel::finish, modifier = width) { Text(stringResource(R.string.practice_try_again)) }
                }
            }
        }

        phase == BlockPhase.AlreadyAnswered -> {
            ActionColumn {
                Text(stringResource(R.string.practice_already_answered), style = MaterialTheme.typography.bodyMedium)
                ActionFlow { width ->
                    Button(onClick = viewModel::reread, modifier = width) { Text(stringResource(R.string.practice_continue)) }
                }
            }
        }

        phase is BlockPhase.Checked -> {
            ActionFlow { width ->
                Button(onClick = { viewModel.next(read.questions) }, modifier = width) { Text(stringResource(R.string.practice_continue)) }
                ask()
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
                if (phase == BlockPhase.AnswerFailed) {
                    SaveErrorText()
                    if (viewModel.canRetry) {
                        FilledTonalButton(
                            onClick = viewModel::retry,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text(stringResource(R.string.practice_try_again)) }
                    }
                }
                ActionFlow { width ->
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
                    CheckButton(busy = phase == BlockPhase.Checking, enabled = run.canAnswer && draft != null, modifier = width) {
                        draft?.let { viewModel.submit(question, it) }
                    }
                    ask()
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

@Serializable
private data class Draft(
    val itemId: String,
    val answer: Answer?,
)

private val DraftSaver =
    Saver<Draft?, String>(
        save = { it?.let { draft -> ApiJson.encodeToString(Draft.serializer(), draft) } ?: "" },
        restore = { it.takeIf(String::isNotEmpty)?.let { json -> ApiJson.decodeFromString(Draft.serializer(), json) } },
    )

private val ASIDE_FROM = 840.dp
private val ASIDE_WIDTH = 360.dp
private val CONTENT_WIDTH = 640.dp
private const val READ_ALPHA = 0.25f
