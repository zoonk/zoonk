package com.zoonk.android.feature.practice

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.semantics.isTraversalGroup
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
import com.zoonk.android.feature.player.steps.StepPart
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
import com.zoonk.android.ui.components.BusyButton
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.SectionLabel
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.taskColumn
import com.zoonk.android.ui.scaffold.PageFold
import com.zoonk.android.ui.scaffold.PageSpan
import com.zoonk.android.ui.scaffold.SpreadScreen
import com.zoonk.android.ui.scaffold.TaskAside
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.onPageSpan
import com.zoonk.android.ui.scaffold.spreadFold
import com.zoonk.android.ui.scaffold.taskAsideBeside
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

/**
 * A keyboard's Enter runs [mainAction] and Escape closes, as in the lesson player. On a wide window
 * a question's passage shows beside it, or else [aside]. Across an unfolded book's fold the run is a
 * spread: the question with its passage ([StepPart.Screen]), then [aside], on the page before the
 * fold, the learner's turn ([StepPart.Turn]) on the page after it. A new [place] starts at its top.
 */
@Composable
internal fun RunFrame(
    title: String,
    question: Question?,
    place: Int,
    app: AppContainer,
    onClose: () -> Unit,
    mainAction: (() -> Unit)?,
    report: FeedbackTarget?,
    progress: @Composable (asideShown: Boolean) -> Unit,
    actions: (@Composable (asideShown: Boolean) -> Unit)?,
    closeLabel: String? = null,
    aside: (@Composable ColumnScope.() -> Unit)? = null,
    asideTitle: String? = null,
    content: @Composable ColumnScope.(part: StepPart, inlineSet: Boolean, asideShown: Boolean) -> Unit,
) {
    val focus = remember { FocusRequester() }
    val set = question?.set?.takeIf { it.listening == null }
    val hasAside = set == null && aside != null
    // The one column and the screen's page across a fold share their scroll, so a reading place keeps as the book opens
    // or closes; the turn's page has its own.
    val scroll = rememberScrollState()
    val turnScroll = rememberScrollState()
    var span by remember { mutableStateOf<PageSpan?>(null) }
    // A new question starts at its top; the same one recreated (the book folding, a rotation) stays where it was.
    var scrolledTo by rememberSaveable { mutableStateOf<Int?>(null) }

    LaunchedEffect(place) {
        if (scrolledTo != place) {
            scroll.scrollTo(0)
            turnScroll.scrollTo(0)
            scrolledTo = place
        }
    }

    SpreadScreen {
        BoxWithConstraints(Modifier.onPageSpan { span = it }) {
            val fold = spreadFold(maxWidth, span)

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
                bottomBar = actions?.let { { TaskActionBar { it(asideShown(hasAside, fold)) } } },
                // A passage takes the rail over the run's own pane, as main's aside; across a fold both go on the page before it.
                aside =
                    when {
                        fold != null -> null
                        set != null -> TaskAside(half = isLongText(set.text)) { ItemSetText(set, inAside = true) }
                        else -> aside?.let { TaskAside(title = asideTitle, content = it) }
                    },
            ) { padding ->
                val inlineSet = set == null || fold != null || !taskAsideBeside()
                val shown = asideShown(hasAside, fold)

                Column(Modifier.padding(padding).fillMaxSize()) {
                    Box(if (fold == null) Modifier else Modifier.width(fold.start)) { progress(shown) }
                    Box(Modifier.weight(1f).fillMaxWidth()) {
                        // The turn's page is the one column's place, so its unsent work stays as the book opens or closes.
                        val turnPage =
                            if (fold == null) Modifier else Modifier.padding(start = fold.end).semantics { isTraversalGroup = true }
                        ScrollingPage(
                            Modifier.fillMaxSize().then(turnPage),
                            if (fold == null) scroll else turnScroll,
                            if (fold == null) Alignment.CenterHorizontally else Alignment.Start,
                        ) { content(if (fold == null) StepPart.Whole else StepPart.Turn, inlineSet, shown) }

                        if (fold != null) {
                            ScrollingPage(
                                Modifier.width(fold.start).fillMaxHeight().semantics { isTraversalGroup = true },
                                scroll,
                                Alignment.End,
                            ) {
                                content(StepPart.Screen, inlineSet, shown)
                                if (shown) {
                                    HorizontalDivider()
                                    asideTitle?.let { SectionLabel(it) }
                                    aside?.invoke(this)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Whether a run's own [hasAside] shows: beside the run, or across a fold on the page before it. */
@Composable
private fun asideShown(
    hasAside: Boolean,
    fold: PageFold?,
) = hasAside && (fold != null || taskAsideBeside())

/** A page of the run; a page of a spread [align]s its column toward the split, so on a very wide window the pages still meet there. */
@Composable
private fun ScrollingPage(
    modifier: Modifier,
    scroll: ScrollState,
    align: Alignment.Horizontal,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier.verticalScroll(scroll).padding(vertical = 8.dp), horizontalAlignment = align) {
        Column(Modifier.taskColumn(), verticalArrangement = Arrangement.spacedBy(16.dp), content = content)
    }
}

@Composable
internal fun RunSegments(
    questions: List<Question>,
    run: QuestionRun,
) {
    if (questions.isEmpty()) return
    RunMeter(index = run.index, total = questions.size, segments(questions, run))
}

@Composable
internal fun RunMeter(
    index: Int,
    total: Int,
    segments: List<Segment>,
    done: Int = index,
) {
    val label = stringResource(R.string.practice_progress, minOf(index + 1, total), total)
    val parts =
        segments.map { segment ->
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

    RunHeader(
        Modifier.semantics {
            contentDescription = label
            progressBarRangeInfo = ProgressBarRangeInfo(done.toFloat(), 0f..total.toFloat())
        },
    ) { MeterParts(parts) }
}

/** A run's progress over its question, on the question's edges. */
@Composable
internal fun RunHeader(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Box(Modifier.taskColumn().padding(bottom = 8.dp).then(modifier)) { content() }
    }
}

/**
 * A drill's line goes once answered; [lastAnswer] is the learner's earlier answer to the mistake's own
 * question. [part] says what of it this page draws: the question, or the learner's turn and feedback.
 */
@Composable
internal fun RunQuestion(
    questions: List<Question>,
    run: QuestionRun,
    question: Question,
    controls: RunControls,
    words: TrueFalseWords,
    navigator: AppNavigator,
    part: StepPart,
    inlineSet: Boolean,
    draft: Answer?,
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
        if (part.showsScreen) DrillIdeas(drill, openLesson)
        return
    }

    if (part.showsScreen) {
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
    }
    // The clock times the learner's answer, so it's part of their turn.
    val seconds = drill?.timeLimitSeconds
    if (part.showsTurn && seconds != null && phase == RunPhase.Answering) {
        DrillCountdown(seconds = seconds, onTimeUp = { controls.timeUp(question, seconds) })
    }

    if (part.showsScreen) {
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
    }

    if (run.stage == DrillStage.Reading) {
        if (part.showsScreen) QuestionTitle(question.question)
        return
    }

    if (part.showsScreen && question.format != QuestionFormat.TrueFalse) QuestionTitle(question.question, graded = checked != null)

    QuestionAnswer(
        question = question,
        words = words,
        allowBlank = netScored,
        check = checked?.let { AnswerCheck(it.answer, it.feedback.correctAnswer, it.feedback.isCorrect) },
        draft = draft,
        enabled = run.canAnswer,
        onAnswer = onDraft,
        onSubmit = { controls.submit(question, it) },
        part = part,
    )

    if (checked != null && part.showsTurn) {
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
            TaskActions { width ->
                Button(onClick = { controls.next(questions) }, modifier = width) { Text(stringResource(R.string.practice_continue)) }
                ask()
            }
        }

        run.stage == DrillStage.Ideas -> {
            TaskActions { width -> DrillStartButton(onStart = { controls.startDrill(questions) }, modifier = width) }
        }

        run.stage == DrillStage.Reading -> {
            TaskActions { width -> ShowAnswersButton(onReveal = controls::reveal, modifier = width) }
        }

        else -> {
            if (phase == RunPhase.AnswerFailed) SaveErrorText(onRetry = controls::retry.takeIf { controls.canRetry })
            val checking = phase as? RunPhase.Checking
            val notSure = checking?.answer == Answer.DontKnow
            TaskActions { width ->
                when (notSureOffer(question, every = notSureOnEvery)) {
                    NotSure.Drill -> {
                        NotSureButton(
                            onClick = { controls.submit(question, Answer.DontKnow) },
                            enabled = run.canAnswer,
                            busy = notSure && !run.timedOut,
                        )
                    }

                    NotSure.DontKnowYet -> {
                        NotSureButton(
                            onClick = { controls.submit(question, Answer.DontKnow) },
                            enabled = run.canAnswer,
                            busy = notSure && !run.timedOut,
                            dontKnowYet = true,
                        )
                    }

                    null -> {}
                }
                BusyButton(
                    busy = checking != null && !notSure,
                    onClick = { draft?.let { controls.submit(question, it) } },
                    modifier = width,
                    enabled = run.canAnswer && draft != null,
                ) { Text(stringResource(R.string.practice_check)) }
                ask()
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
    step: Int,
    question: Question?,
): Answer? = this?.takeIf { it.step == step && it.itemId == question?.itemId }?.answer

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

private const val READ_ALPHA = 0.25f
