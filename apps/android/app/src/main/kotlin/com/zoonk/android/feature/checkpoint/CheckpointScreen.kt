package com.zoonk.android.feature.checkpoint

import androidx.activity.compose.BackHandler
import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
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
import com.zoonk.android.data.recode
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
import com.zoonk.android.feature.player.LessonTitle
import com.zoonk.android.feature.practice.ActionBarWidth
import com.zoonk.android.feature.practice.ActionColumn
import com.zoonk.android.feature.practice.ActionFlow
import com.zoonk.android.feature.practice.RunLoadFailed
import com.zoonk.android.feature.practice.RunLoading
import com.zoonk.android.feature.practice.RunNotFound
import com.zoonk.android.feature.practice.SaveErrorText
import com.zoonk.android.feature.practice.runAccount
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.AnswerCheck
import com.zoonk.android.feature.questions.ItemSupport
import com.zoonk.android.feature.questions.ItemText
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionAnswer
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.QuestionTitle
import com.zoonk.android.feature.questions.WorkedSteps
import com.zoonk.android.feature.questions.answerText
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.Trickster
import com.zoonk.android.ui.characters.TricksterAct
import com.zoonk.android.ui.characters.TricksterArt
import com.zoonk.android.ui.characters.rememberTricksterActorState
import com.zoonk.android.ui.components.FeedbackPanel
import com.zoonk.android.ui.components.FeedbackTone
import com.zoonk.android.ui.components.FeedbackVerdict
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.MomentReadouts
import com.zoonk.android.ui.components.MomentScore
import com.zoonk.android.ui.components.StatusMessage
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.Checkpoint
import com.zoonk.api.models.CheckpointPhase
import com.zoonk.api.models.FeedbackSubmissionContext
import com.zoonk.api.models.LanguageCheckpointCall
import com.zoonk.api.models.StudyBlockCompletionCheckpointAnswersInner
import com.zoonk.api.models.StudyQuestionAnswer
import kotlinx.coroutines.launch
import java.util.UUID

/** `/checkpoint/{blockId}` when it isn't a language call: the duel or the week's challenge. */
@Composable
fun CheckpointScreen(
    route: AppRoute.Checkpoint,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val blockId = remember(route.blockId) { runCatching { UUID.fromString(route.blockId) }.getOrNull() }
    if (blockId == null) {
        RunNotFound(navigator::closeTask)
        return
    }
    val viewModel = viewModel(key = "checkpoint:$blockId:${runAccount(app)}") { CheckpointViewModel(blockId, app.checkpoints) }
    val duel by viewModel.duel.collectAsStateWithLifecycle()
    val closed by viewModel.closed.collectAsStateWithLifecycle()

    LaunchedEffect(closed) { if (closed) navigator.closeTask() }
    BackHandler(onBack = viewModel::close)

    when (val shown = duel) {
        null -> CheckpointRead(blockId, route, viewModel, app, navigator)
        else -> if (shown.state.showsResult) DuelResult(shown, viewModel, app) else DuelPlay(shown, viewModel, app)
    }
}

/** Main's checkpoint page: a challenge not yet open, or Plus's without a call, shows its intro; a mock its own screen. */
@Composable
private fun CheckpointRead(
    blockId: UUID,
    route: AppRoute.Checkpoint,
    viewModel: CheckpointViewModel,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val loaded by viewModel.checkpoint.collectShown()
    val scope = rememberCoroutineScope()
    // L9's call screen read this before handing over; a call that needs Plus opens the challenge's intro.
    val call by app.conversations
        .checkpointCall(blockId)
        .state
        .collectAsStateWithLifecycle()
    val plusRequired = (call as? LoadState.Loaded)?.value is LanguageCheckpointCall.PlusrequiredWrapper

    when (val read = loaded) {
        is LoadState.Loaded -> {
            val checkpoint = read.value
            val intro =
                plusRequired || checkpoint.status == Checkpoint.Status.PENDING ||
                    (checkpoint.status == Checkpoint.Status.SKIPPED && checkpoint.endedWithoutQuestions != true)
            val elsewhere =
                when {
                    intro -> checkpoint.planItemId?.let { AppRoute.Challenge(it.toString(), route.sessionId) }
                    checkpoint.mock -> AppRoute.Mock(route.blockId, route.sessionId)
                    else -> null
                }
            when {
                elsewhere != null -> {
                    LaunchedEffect(elsewhere) {
                        navigator.closeTask()
                        navigator.open(elsewhere)
                    }
                    RunLoading(navigator::closeTask)
                }

                intro -> {
                    RunNotFound(navigator::closeTask)
                }

                else -> {
                    LaunchedEffect(checkpoint) { viewModel.begin(checkpoint) }
                    RunLoading(navigator::closeTask)
                }
            }
        }

        is LoadState.Failed -> {
            if (read.error == ApiError.NotFound) {
                RunNotFound(navigator::closeTask)
            } else {
                RunLoadFailed(navigator::closeTask, onRetry = { scope.launch { viewModel.checkpoint.refresh() } })
            }
        }

        LoadState.Empty -> {
            RunNotFound(navigator::closeTask)
        }

        else -> {
            RunLoading(navigator::closeTask)
        }
    }
}

@Composable
private fun eyebrow(checkpoint: Checkpoint): String {
    val phase = checkpoint.phase?.let { (it.index + 1).toString() }
    return when {
        checkpoint.kind == Checkpoint.Kind.WEEKLY -> stringResource(R.string.checkpoint_weekly)
        checkpoint.kind == Checkpoint.Kind.FINAL_BOSS -> stringResource(R.string.checkpoint_final)
        phase != null -> stringResource(R.string.checkpoint_phase, phase)
        else -> stringResource(R.string.checkpoint_phase_plain)
    }
}

@Composable
internal fun DuelPlay(
    duel: Duel,
    viewModel: CheckpointViewModel,
    app: AppContainer,
) {
    val (read, state) = duel
    val score = state.score(read)
    val question = state.current(read)
    val empty = score.questions == 0

    TaskScaffold(
        onClose = viewModel::close,
        title = { LessonTitle(stringResource(if (read.isBoss) R.string.checkpoint_trickster else R.string.checkpoint_weekly)) },
        actions = {
            question?.takeIf { state.feedback != null }?.let {
                ReportProblemMenu(app, FeedbackTarget("checkpoint", FeedbackSubmissionContext.ContentKind.ITEM, UUID.fromString(it.itemId)))
            }
        },
        bottomBar = { ActionBarWidth { DuelActions(state, score, question, viewModel) } },
    ) { padding ->
        BoxWithConstraints(Modifier.fillMaxSize().padding(padding)) {
            val wide = maxWidth >= ASIDE_FROM
            Row(Modifier.fillMaxSize()) {
                Column(
                    Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Column(Modifier.widthIn(max = CONTENT_WIDTH).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        if (!empty) {
                            if (read.isBoss && !wide) ShieldBar(score, read.passMark) else DuelSegments(read, state, question)
                        }
                        when {
                            question != null -> key(question.itemId) { QuestionCard(read, state, score, question, viewModel) }
                            empty -> QuestionsRemoved(read.checkpoint)
                            else -> DuelOver(state, score)
                        }
                    }
                }
                if (wide && !empty) {
                    VerticalDivider()
                    Column(
                        Modifier.width(ASIDE_WIDTH).verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) { DuelAside(read, state, score) }
                }
            }
        }
    }
}

@Composable
private fun QuestionCard(
    read: CheckpointRead,
    state: DuelState,
    score: DuelScore,
    question: Question,
    viewModel: CheckpointViewModel,
) {
    val feedback = state.feedback?.takeIf { it.itemId == question.itemId }

    ItemSupport(question)
    if (question.format != QuestionFormat.TrueFalse) QuestionTitle(question.question, graded = feedback != null)
    // A wrong pick never reveals the right one until the end.
    QuestionAnswer(
        question = question,
        words = read.words,
        allowBlank = false,
        check = feedback?.let { AnswerCheck(it.answer, correct = null, isCorrect = it.isCorrect) },
        enabled = feedback == null && !state.pending,
        onAnswer = viewModel::select,
        onSubmit = viewModel::confirm,
    )
    feedback?.let { Verdict(it.isCorrect, score.decision, state.reinforcementLessons) }
}

@Composable
private fun Verdict(
    isCorrect: Boolean,
    decision: DuelDecision?,
    lessons: Int,
) {
    FeedbackPanel(
        label = stringResource(R.string.questions_feedback_label),
        modifier =
            Modifier.semantics {
                liveRegion =
                    LiveRegionMode.Polite
            },
    ) {
        FeedbackVerdict(
            text = stringResource(if (isCorrect) R.string.questions_correct else R.string.questions_not_quite),
            tone = if (isCorrect) FeedbackTone.Right else FeedbackTone.Wrong,
        )
        when {
            decision != null -> Text(decisionLine(decision, lessons), style = MaterialTheme.typography.bodyMedium)
            !isCorrect -> Text(stringResource(R.string.checkpoint_why_later), style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun decisionLine(
    decision: DuelDecision,
    lessons: Int,
): String =
    when (decision) {
        DuelDecision.Won -> {
            stringResource(R.string.checkpoint_won_line)
        }

        DuelDecision.Lost -> {
            val retry =
                if (lessons == 0) {
                    stringResource(R.string.checkpoint_retry_tomorrow)
                } else {
                    pluralStringResource(R.plurals.checkpoint_retry_after_lessons, lessons, lessons)
                }
            stringResource(R.string.checkpoint_lost_line) + " " + retry
        }
    }

@Composable
private fun DuelOver(
    state: DuelState,
    score: DuelScore,
) {
    if (score.decision == null && score.answered == 0) return
    Text(
        text = score.decision?.let { decisionLine(it, state.reinforcementLessons) } ?: stringResource(R.string.checkpoint_every_answered),
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        style = MaterialTheme.typography.bodyLarge,
    )
}

@Composable
private fun QuestionsRemoved(checkpoint: Checkpoint) {
    StatusMessage(
        icon = R.drawable.ic_checklist,
        title = stringResource(R.string.checkpoint_removed_title),
        description = stringResource(R.string.checkpoint_removed_detail),
    ) {}
    Text(eyebrow(checkpoint), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
}

@Composable
private fun DuelActions(
    state: DuelState,
    score: DuelScore,
    question: Question?,
    viewModel: CheckpointViewModel,
) {
    ActionColumn {
        if (state.error != null) SaveErrorText(onRetry = viewModel::retry.takeIf { !state.pending })
        ActionFlow { width ->
            when {
                question == null || state.feedback != null -> {
                    BusyButton(busy = state.pending, enabled = true, modifier = width, onClick = viewModel::next) {
                        stringResource(if (score.done) R.string.checkpoint_see_result else R.string.checkpoint_next)
                    }
                }

                else -> {
                    BusyButton(busy = state.pending, enabled = state.selected != null, modifier = width, onClick = {
                        state.selected?.let(viewModel::confirm)
                    }) { stringResource(R.string.checkpoint_confirm) }
                }
            }
        }
    }
}

@Composable
private fun BusyButton(
    busy: Boolean,
    enabled: Boolean,
    modifier: Modifier,
    onClick: () -> Unit,
    label: @Composable () -> String,
) {
    Button(onClick = onClick, enabled = enabled && !busy, modifier = modifier) {
        if (busy) CircularProgressIndicator(Modifier.padding(end = 8.dp).size(16.dp), color = LocalContentColor.current, strokeWidth = 2.dp)
        Text(label())
    }
}

@Composable
private fun DuelSegments(
    read: CheckpointRead,
    state: DuelState,
    question: Question?,
) {
    val removed = state.verdicts.filterKeys { id -> read.questions.none { it.itemId == id } }.values
    val fills =
        removed.map { if (it) Verdict.Right else Verdict.Wrong } +
            read.questions.map { candidate ->
                state.verdicts[candidate.itemId]?.let { if (it) Verdict.Right else Verdict.Wrong }
                    ?: if (candidate.itemId == question?.itemId) Verdict.Current else Verdict.Ahead
            }
    val position = (fills.indexOf(Verdict.Current).takeIf { it >= 0 } ?: state.verdicts.size - 1) + 1
    val label = stringResource(R.string.practice_progress, position.coerceIn(1, fills.size), fills.size)

    Box(
        Modifier.semantics {
            contentDescription = label
            progressBarRangeInfo = ProgressBarRangeInfo(state.verdicts.size.toFloat(), 0f..fills.size.toFloat())
        },
    ) {
        MeterParts(
            fills.map {
                MeterPart(
                    when (it) {
                        Verdict.Right -> MeterPart.Fill.Solid(MaterialTheme.colorScheme.tertiary)
                        Verdict.Wrong -> MeterPart.Fill.Solid(MaterialTheme.colorScheme.error)
                        Verdict.Current -> MeterPart.Fill.Place()
                        Verdict.Ahead -> MeterPart.Fill.Track
                    },
                )
            },
        )
    }
}

private enum class Verdict { Right, Wrong, Current, Ahead }

/** On a phone the shield stands in for the question segments: each right answer breaks a plate. */
@Composable
private fun ShieldBar(
    score: DuelScore,
    passMark: Int,
) {
    val toGo = passMark - minOf(score.correct, passMark)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Trickster(Modifier.size(16.dp))
        ShieldPlates(score.correct, passMark, Modifier.weight(1f), plate = 4)
        Text(
            text =
                when {
                    toGo == 0 -> stringResource(R.string.checkpoint_broken_all)
                    score.decision == DuelDecision.Lost -> stringResource(R.string.checkpoint_held)
                    else -> pluralStringResource(R.plurals.checkpoint_to_go, toGo, toGo)
                },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

@Composable
private fun ShieldPlates(
    broken: Int,
    plates: Int,
    modifier: Modifier = Modifier,
    plate: Int,
) {
    val cracked = minOf(broken, plates)
    val value = pluralStringResource(R.plurals.checkpoint_shield_value, plates, cracked, plates)
    val shield = stringResource(R.string.checkpoint_shield)
    Row(
        modifier.semantics {
            contentDescription = "$shield, $value"
            progressBarRangeInfo = ProgressBarRangeInfo(cracked.toFloat(), 0f..plates.toFloat())
        },
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        repeat(plates) { index ->
            Box(
                Modifier
                    .weight(1f)
                    .height(plate.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(
                        if (index <
                            cracked
                        ) {
                            MaterialTheme.colorScheme.tertiary
                        } else {
                            MaterialTheme.colorScheme.surfaceContainerHighest
                        },
                    ),
            )
        }
    }
}

@Composable
private fun DuelAside(
    read: CheckpointRead,
    state: DuelState,
    score: DuelScore,
) {
    val note = stringResource(if (read.isBoss) R.string.checkpoint_no_hints_boss else R.string.checkpoint_no_hints_weekly)
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(eyebrow(read.checkpoint), modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
        if (read.isBoss) {
            Text(
                pluralStringResource(R.plurals.checkpoint_right_to_win, read.passMark, read.passMark),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
    if (read.isBoss) {
        val actor = rememberTricksterActorState()
        LaunchedEffect(
            state.feedback?.itemId,
        ) { state.feedback?.let { actor.play(if (it.isCorrect) TricksterAct.Sly else TricksterAct.Smug) } }
        TricksterArt(Modifier.size(104.dp), state = actor)
        Text(stringResource(R.string.checkpoint_shield), style = MaterialTheme.typography.titleSmall)
        ShieldPlates(score.correct, read.passMark, Modifier.fillMaxWidth(), plate = 8)
        val broken = minOf(score.correct, read.passMark)
        val toGo = read.passMark - broken
        val left = score.questions - score.answered
        val facts =
            listOfNotNull(
                pluralStringResource(R.plurals.checkpoint_broken, broken, broken),
                pluralStringResource(R.plurals.checkpoint_to_go, toGo, toGo).takeIf { score.decision == null && toGo > 0 },
                (
                    if (left ==
                        0
                    ) {
                        stringResource(R.string.checkpoint_no_questions_left)
                    } else {
                        pluralStringResource(R.plurals.checkpoint_questions_left, left, left)
                    }
                ).takeIf { score.decision == null },
            )
        Text(facts.joinToString(" · "), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    }
    Text(note, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    if (score.decision != DuelDecision.Lost) Prize(read)
}

@Composable
private fun Prize(read: CheckpointRead) {
    val points =
        formatNumber(
            read.checkpoint.reward.brainPower
                .toDouble(),
            currentLocale(),
        )
    val phase = read.checkpoint.phase?.let { (it.index + 1).toString() }
    DetailRow(
        icon = R.drawable.ic_psychology,
        title = stringResource(if (read.isBoss) R.string.checkpoint_winning else R.string.checkpoint_finishing),
        trailing =
            if (phase != null && read.checkpoint.reward.phaseComplete) {
                stringResource(R.string.checkpoint_prize_phase, points, phase)
            } else {
                stringResource(R.string.checkpoint_prize, points)
            },
    )
}

@Composable
private fun DetailRow(
    @DrawableRes icon: Int,
    title: String,
    detail: String? = null,
    trailing: String? = null,
) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(
            painterResource(icon),
            contentDescription = null,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = MaterialTheme.typography.bodyMedium)
            detail?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
        }
        trailing?.let { Text(it, color = MaterialTheme.zoonk.brainText, style = MaterialTheme.typography.labelLarge) }
    }
}

private data class Outcome(
    val correct: Int,
    val total: Int,
    val passed: Boolean,
)

private fun Duel.outcome(): Outcome? =
    state.completion?.checkpoint?.let { Outcome(it.correct.toInt(), it.total.toInt(), it.passed) }
        ?: read.checkpoint.result?.let { Outcome(it.correct.toInt(), it.total.toInt(), it.passed) }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun DuelResult(
    duel: Duel,
    viewModel: CheckpointViewModel,
    app: AppContainer,
) {
    val checkpoint = duel.read.checkpoint
    val outcome = duel.outcome()
    val won = outcome != null && (!duel.read.isBoss || outcome.passed)
    val answers =
        duel.state.completion
            ?.checkpoint
            ?.answers
            .orEmpty()
    var reviewing by rememberSaveable { mutableStateOf(false) }

    TaskScaffold(
        onClose = viewModel::close,
        title = { LessonTitle(eyebrow(checkpoint)) },
        bottomBar = {
            ActionBarWidth {
                ActionFlow { width ->
                    Button(onClick = viewModel::close, modifier = width) { Text(stringResource(R.string.practice_continue)) }
                }
            }
        },
    ) { padding ->
        BoxWithConstraints(Modifier.fillMaxSize().padding(padding)) {
            val wide = maxWidth >= ASIDE_FROM
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Column(Modifier.widthIn(max = CONTENT_WIDTH).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    if (outcome == null) {
                        QuestionsRemoved(checkpoint)
                        return@Column
                    }
                    if (duel.read.isBoss) TricksterArt(Modifier.size(104.dp), beaten = won, reacts = true)
                    Text(
                        text =
                            stringResource(
                                when {
                                    !duel.read.isBoss -> R.string.checkpoint_weekly_done
                                    won -> R.string.checkpoint_beat
                                    else -> R.string.checkpoint_not_this_time
                                },
                            ),
                        modifier = Modifier.semantics { heading() },
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    val passMark =
                        duel.state.completion
                            ?.checkpoint
                            ?.passMark
                            ?.toInt()
                    MomentReadouts(
                        brainPower = 0,
                        score = MomentScore(outcome.total, outcome.correct),
                        facts =
                            listOfNotNull(
                                passMark?.takeIf { !won }?.let {
                                    pluralStringResource(R.plurals.checkpoint_right_to_win_of, it, it, duel.read.questions.size)
                                },
                            ),
                    )
                    if (won) WonDetails(duel) else NotWonDetails(duel)
                    if (answers.isNotEmpty()) {
                        if (wide) {
                            Review(duel, answers, app)
                        } else {
                            FilledTonalButton(onClick = { reviewing = true }) { Text(stringResource(R.string.checkpoint_review)) }
                        }
                    }
                }
            }
        }
    }

    if (reviewing) {
        ModalBottomSheet(onDismissRequest = { reviewing = false }) {
            Column(
                Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 24.dp),
            ) { Review(duel, answers, app) }
        }
    }
}

@Composable
private fun phaseLabel(phase: CheckpointPhase): String =
    phase.name.ifEmpty { stringResource(R.string.checkpoint_phase_name, phase.index + 1) }

@Composable
private fun Section(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(Modifier.fillMaxWidth()) {
        Text(title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.titleSmall)
        content()
    }
}

@Composable
private fun WonDetails(duel: Duel) {
    val checkpoint = duel.read.checkpoint
    val points = duel.state.completion?.brainPower ?: checkpoint.reward.brainPower
    val phase = checkpoint.phase?.let { (it.index + 1).toString() }

    Section(stringResource(R.string.checkpoint_rewards)) {
        DetailRow(
            R.drawable.ic_psychology,
            stringResource(R.string.checkpoint_brain_power),
            trailing = stringResource(R.string.checkpoint_prize, formatNumber(points.toDouble(), currentLocale())),
        )
        if (checkpoint.reward.phaseComplete) {
            DetailRow(
                R.drawable.ic_flag,
                phase?.let { stringResource(R.string.checkpoint_phase_complete, it) }
                    ?: stringResource(R.string.checkpoint_phase_complete_plain),
            )
        }
        if (checkpoint.reward.badge) DetailRow(R.drawable.ic_search_check, stringResource(R.string.checkpoint_badge))
    }
    checkpoint.nextPhase?.takeIf { checkpoint.reward.phaseComplete && duel.read.isBoss }?.let { next ->
        Section(stringResource(R.string.checkpoint_next_phase)) { DetailRow(R.drawable.ic_arrow_forward, phaseLabel(next)) }
    }
}

@Composable
private fun NotWonDetails(duel: Duel) {
    val checkpoint = duel.read.checkpoint
    val lessons = duel.state.reinforcementLessons
    val retry = if (duel.state.completion != null) Checkpoint.Retry.TOMORROW else checkpoint.retry
    val nextPhase = checkpoint.nextPhase?.takeIf { checkpoint.retry != Checkpoint.Retry.PASSED }
    val earned = duel.state.completion?.brainPower ?: 0

    if (retry != null || nextPhase != null) {
        Section(stringResource(R.string.checkpoint_whats_next)) {
            when (retry) {
                Checkpoint.Retry.PASSED -> {
                    DetailRow(
                        R.drawable.ic_check,
                        stringResource(R.string.checkpoint_passed_later),
                        stringResource(R.string.checkpoint_phase_done),
                    )
                }

                Checkpoint.Retry.TOMORROW, Checkpoint.Retry.OPEN -> {
                    DetailRow(
                        R.drawable.ic_replay,
                        stringResource(
                            if (retry ==
                                Checkpoint.Retry.TOMORROW
                            ) {
                                R.string.checkpoint_new_try_tomorrow
                            } else {
                                R.string.checkpoint_new_try_next
                            },
                        ),
                        if (lessons == 0) {
                            stringResource(R.string.checkpoint_nothing_lost)
                        } else {
                            pluralStringResource(R.plurals.checkpoint_after_lessons, lessons, lessons)
                        },
                    )
                }

                null -> {}
            }
            nextPhase?.let { DetailRow(R.drawable.ic_arrow_forward, stringResource(R.string.checkpoint_next_phase_open, phaseLabel(it))) }
        }
    }
    if (earned > 0) {
        Section(stringResource(R.string.checkpoint_earned)) {
            DetailRow(
                R.drawable.ic_psychology,
                stringResource(R.string.checkpoint_brain_power),
                trailing = stringResource(R.string.checkpoint_prize, formatNumber(earned.toDouble(), currentLocale())),
            )
        }
    }
}

/** Why each answer was right or wrong, the traps included, now that the duel is over. */
@Composable
private fun Review(
    duel: Duel,
    answers: List<StudyBlockCompletionCheckpointAnswersInner>,
    app: AppContainer,
) {
    Section(stringResource(R.string.checkpoint_answers)) {
        answers.forEachIndexed { index, answer ->
            val question = duel.read.questions.firstOrNull { it.itemId == answer.itemId.toString() } ?: return@forEachIndexed
            if (index > 0) HorizontalDivider()
            ReviewItem(duel, question, answer, app)
        }
    }
}

@Composable
private fun ReviewItem(
    duel: Duel,
    question: Question,
    answer: StudyBlockCompletionCheckpointAnswersInner,
    app: AppContainer,
) {
    val correct = answer.correctAnswer.toAnswer()
    val given = duel.state.given[question.itemId]
    Column(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(
                painterResource(if (answer.isCorrect) R.drawable.ic_check else R.drawable.ic_close),
                contentDescription = stringResource(if (answer.isCorrect) R.string.questions_correct else R.string.questions_not_quite),
                modifier = Modifier.size(20.dp),
                tint = if (answer.isCorrect) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error,
            )
            Text(question.question, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
            ReportProblemMenu(app, FeedbackTarget("checkpoint-review", FeedbackSubmissionContext.ContentKind.ITEM, answer.itemId))
        }
        Column(Modifier.padding(start = 32.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (question.format == QuestionFormat.MultipleChoice || question.format == QuestionFormat.TrueFalse) {
                QuestionAnswer(
                    question = question,
                    words = duel.read.words,
                    allowBlank = false,
                    // An answer given before the screen opened again isn't known: a miss then shows only the right option.
                    check =
                        AnswerCheck(
                            given ?: if (answer.isCorrect &&
                                correct != null
                            ) {
                                correct
                            } else {
                                Answer.DontKnow
                            },
                            correct,
                            answer.isCorrect,
                        ),
                    enabled = false,
                    onAnswer = {},
                    onSubmit = {},
                )
            } else {
                answerText(correct, question, duel.read.words)?.let {
                    Text(stringResource(R.string.checkpoint_answer, it), style = MaterialTheme.typography.bodyMedium)
                }
            }
            answer.explanation?.let { ItemText(it, style = MaterialTheme.typography.bodyMedium) }
            if (!answer.isCorrect) WorkedSteps(answer.workedSteps)
        }
    }
}

private fun StudyQuestionAnswer.toAnswer(): Answer? = runCatching { recode<StudyQuestionAnswer, Answer>() }.getOrNull()

private val ASIDE_FROM = 840.dp
private val ASIDE_WIDTH = 360.dp
private val CONTENT_WIDTH = 640.dp
