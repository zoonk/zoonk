package com.zoonk.android.feature.practice

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
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
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.SessionState
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
import com.zoonk.android.feature.tutor.TutorAskButton
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.api.ApiJson
import com.zoonk.api.models.FeedbackSubmissionContext
import kotlinx.serialization.Serializable
import java.util.UUID

interface RunControls {
    /** The last answer didn't go through and can be sent again as it was. */
    val canRetry: Boolean

    fun startDrill(questions: List<Question>)

    fun reveal()

    /** [minDurationMs] is a timed drill's whole time when it ran out, however the clock ticked. */
    fun submit(
        question: Question,
        answer: Answer,
        minDurationMs: Long = 0,
    )

    fun retry()

    fun timeUp(
        question: Question,
        seconds: Int,
    )

    fun next(questions: List<Question>)
}

/** A keyboard's Enter runs [mainAction] and Escape closes, as in the lesson player. */
@Composable
internal fun RunFrame(
    title: String,
    questions: List<Question>,
    run: QuestionRun,
    question: Question?,
    app: AppContainer,
    onClose: () -> Unit,
    mainAction: (() -> Unit)?,
    report: FeedbackTarget?,
    actions: @Composable () -> Unit,
    closeLabel: String? = null,
    content: @Composable ColumnScope.(inlineSet: Boolean) -> Unit,
) {
    val focus = remember { FocusRequester() }

    LaunchedEffect(Unit) { focus.requestFocus() }

    TaskScaffold(
        onClose = onClose,
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
        actions = { report?.let { ReportProblemMenu(app, it) } },
        closeLabel = closeLabel,
        bottomBar = { ActionBarWidth(actions) },
    ) { padding ->
        RunLayout(
            question,
            Modifier.padding(padding),
            header = { if (questions.isNotEmpty()) RunSegments(questions, run) },
            content = content,
        )
    }
}

@Composable
private fun RunSegments(
    questions: List<Question>,
    run: QuestionRun,
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
private fun RunLayout(
    question: Question?,
    modifier: Modifier,
    header: @Composable () -> Unit,
    content: @Composable ColumnScope.(inlineSet: Boolean) -> Unit,
) {
    BoxWithConstraints(modifier.fillMaxSize()) {
        val aside = question?.set?.takeIf { it.listening == null && maxWidth >= ASIDE_FROM }

        Row(Modifier.fillMaxSize()) {
            // The progress stays over the question, in its pane, when a passage shows beside it.
            Column(Modifier.weight(1f)) {
                header()
                Column(
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Column(Modifier.widthIn(max = CONTENT_WIDTH).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        content(aside == null)
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

/** A drill's line goes once answered; [lastAnswer] is the learner's earlier answer to the mistake's own question. */
@Composable
internal fun RunQuestion(
    questions: List<Question>,
    run: QuestionRun,
    question: Question,
    controls: RunControls,
    words: TrueFalseWords,
    navigator: AppNavigator,
    inlineSet: Boolean,
    onDraft: (Answer?) -> Unit,
    netScored: Boolean = false,
    examTomorrow: Boolean = false,
    lastAnswer: String? = null,
    afterFeedback: @Composable () -> Unit = {},
) {
    val drill = question.drill
    val phase = run.phase
    val checked = phase as? RunPhase.Checked
    val openLesson: (String) -> Unit = { lessonId -> navigator.open(AppRoute.Lesson(lessonId)) }
    val previous = questions.getOrNull(run.index - 1)

    if (drill != null && run.stage == DrillStage.Ideas) {
        DrillIdeas(drill, openLesson)
        return
    }

    if (netScored) SwipeScore(netTally(questions, run))
    if (checked == null) question.timeMachine?.let { TimeMachine(it, question.format, words) }

    if (drill != null) {
        val first = previous?.mistakeId != question.mistakeId
        val shown = if (drill.isIdeaFirst) lastAnswer != null else first || drill.isReadFirst
        if (shown) {
            DrillNote(
                drill,
                openLesson,
                answered = checked != null || drill.isIdeaFirst,
                lastAnswer = lastAnswer?.takeIf { first || drill.isIdeaFirst },
            )
        }
    }
    val seconds = drill?.timeLimitSeconds
    if (seconds != null && phase == RunPhase.Answering) {
        DrillCountdown(seconds = seconds, onTimeUp = { controls.timeUp(question, seconds) })
    }

    if (question.placement && run.stage != DrillStage.Reading) PlacementNote()
    question.citation?.takeIf { question.quoted }?.let { QuotedSource(it) }

    question.set?.let { set ->
        if (set.listening != null) {
            ListeningSet(set)
        } else if (inlineSet) {
            ItemSetText(set, continued = previous?.set?.id == set.id)
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
        allowBlank = netScored,
        check = checked?.let { AnswerCheck(it.answer, it.feedback.correctAnswer, it.feedback.isCorrect) },
        enabled = run.canAnswer,
        onAnswer = onDraft,
        onSubmit = { controls.submit(question, it) },
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
        afterFeedback()
    }
}

/** What Enter does on a question: Continue, start the drill, show the answers, or check the pick. */
internal fun answerAction(
    questions: List<Question>,
    question: Question?,
    run: QuestionRun,
    draft: Answer?,
    controls: RunControls,
): (() -> Unit)? =
    when {
        run.phase is RunPhase.Checked -> ({ controls.next(questions) })
        question == null -> null
        run.stage == DrillStage.Ideas -> ({ controls.startDrill(questions) })
        run.stage == DrillStage.Reading -> controls::reveal
        run.canAnswer && draft != null -> ({ controls.submit(question, draft) })
        else -> null
    }

@Composable
internal fun AnswerActions(
    questions: List<Question>,
    question: Question,
    run: QuestionRun,
    draft: Answer?,
    controls: RunControls,
    ask: @Composable () -> Unit,
    notSureOnEvery: Boolean = false,
) {
    val phase = run.phase

    when {
        phase is RunPhase.Checked -> {
            ActionFlow { width ->
                Button(onClick = { controls.next(questions) }, modifier = width) { Text(stringResource(R.string.practice_continue)) }
                ask()
            }
        }

        run.stage == DrillStage.Ideas -> {
            ActionFlow { width -> DrillStartButton(onStart = { controls.startDrill(questions) }, modifier = width) }
        }

        run.stage == DrillStage.Reading -> {
            ActionFlow { width -> ShowAnswersButton(onReveal = controls::reveal, modifier = width) }
        }

        else -> {
            ActionColumn {
                if (phase == RunPhase.AnswerFailed) SaveErrorText(onRetry = controls::retry.takeIf { controls.canRetry })
                ActionFlow { width ->
                    when (notSureOffer(question, every = notSureOnEvery)) {
                        NotSure.Drill -> {
                            NotSureButton(onClick = { controls.submit(question, Answer.DontKnow) }, enabled = run.canAnswer)
                        }

                        NotSure.DontKnowYet -> {
                            NotSureButton(
                                onClick = { controls.submit(question, Answer.DontKnow) },
                                enabled = run.canAnswer,
                                dontKnowYet = true,
                            )
                        }

                        null -> {}
                    }
                    BusyButton(
                        stringResource(R.string.practice_check),
                        busy = phase == RunPhase.Checking,
                        enabled =
                            run.canAnswer && draft != null,
                        modifier = width,
                    ) {
                        draft?.let { controls.submit(question, it) }
                    }
                    ask()
                }
            }
        }
    }
}

/** The tutor on a question; not on a placement question, nor on a timed one before its answer, as main. */
@Composable
internal fun RunAskButton(
    question: Question,
    run: QuestionRun,
    blockId: String?,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val checked = run.phase as? RunPhase.Checked
    if (question.placement || (question.drill?.timeLimitSeconds != null && checked == null)) return

    TutorAskButton(
        TutorScope.Item(question.itemId, blockId, answered = checked != null),
        app,
        navigator,
        worded = checked?.feedback?.isCorrect == false,
    )
}

/** A timed drill's clock never waits on a menu, so its question is reported once answered. */
internal fun runReportTarget(
    screen: String,
    question: Question?,
    run: QuestionRun,
): FeedbackTarget? {
    if (question == null || run.stage == DrillStage.Ideas) return null
    if (question.drill?.timeLimitSeconds != null && run.phase !is RunPhase.Checked) return null
    return FeedbackTarget(screen, FeedbackSubmissionContext.ContentKind.ITEM, UUID.fromString(question.itemId))
}

/**
 * The pick before Check, kept with its step and item: a pick restored after the process was gone
 * never answers another question, nor the same item asked again under another mistake.
 */
@Serializable
internal data class Draft(
    val step: Int,
    val itemId: String,
    val answer: Answer?,
)

internal fun Draft?.answerFor(
    run: QuestionRun,
    question: Question?,
): Answer? = this?.takeIf { it.step == run.index && it.itemId == question?.itemId }?.answer

/** A run belongs to the account that started it: another account signing in gets its own. */
@Composable
internal fun runAccount(app: AppContainer): String? {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    return (session as? SessionState.SignedIn)?.session?.localId
}

@Composable
internal fun rememberDraft(): MutableState<Draft?> = rememberSaveable(stateSaver = DraftSaver) { mutableStateOf(null) }

private val DraftSaver =
    Saver<Draft?, String>(
        save = { it?.let { draft -> ApiJson.encodeToString(Draft.serializer(), draft) } ?: "" },
        restore = { it.takeIf(String::isNotEmpty)?.let { json -> ApiJson.decodeFromString(Draft.serializer(), json) } },
    )

private val ASIDE_FROM = 840.dp
private val ASIDE_WIDTH = 360.dp
private val CONTENT_WIDTH = 640.dp
private const val READ_ALPHA = 0.25f
