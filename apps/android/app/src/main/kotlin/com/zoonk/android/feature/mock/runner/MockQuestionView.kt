package com.zoonk.android.feature.mock.runner

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.ItemLine
import com.zoonk.android.feature.questions.ItemSetText
import com.zoonk.android.feature.questions.ItemSupport
import com.zoonk.android.feature.questions.ListeningPlays
import com.zoonk.android.feature.questions.ListeningQuestions
import com.zoonk.android.feature.questions.ListeningStimulus
import com.zoonk.android.feature.questions.NumericAnswerField
import com.zoonk.android.feature.questions.PickRule
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.QuestionTitle
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.feature.questions.TypedAnswerField
import com.zoonk.android.feature.questions.formatClock
import com.zoonk.android.feature.questions.isMulti
import com.zoonk.android.feature.questions.trueFalseLabel
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerOptionGroup
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.MockExam
import kotlinx.coroutines.delay
import kotlin.time.Clock
import kotlin.time.Duration.Companion.seconds

/** What a mock's listening plays through: the app's one sound and this device's count of plays. */
class MockAudio(
    val speech: SpeechPlayer,
    val plays: ListeningPlays,
    val session: AuthenticatedSession?,
)

@Composable
internal fun MockQuestionCard(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    question: MockQuestion,
) {
    val previous = run.questions.getOrNull(run.position - 1)
    val set = question.question.set

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (set != null && set.listening == null) ItemSetText(set, continued = previous?.question?.set?.id == set.id)
        ItemSupport(question.question)
        QuestionTitle(question.question.question)
        AnswerInput(viewModel, run, question)
    }
}

@Composable
private fun AnswerInput(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    question: MockQuestion,
) {
    val draft = run.drafts[question.itemId]
    val locked = run.pending || !run.moves.canChange(run.position)

    when {
        question.essay -> EssayAnswer(viewModel, run, draft)
        question.question.format == QuestionFormat.Numeric -> NumberAnswer(viewModel, question, draft, locked)
        question.question.format == QuestionFormat.Typed -> WordAnswer(viewModel, draft, locked)
        question.question.select.isMulti -> Picks(viewModel, question, draft, locked)
        else -> Options(viewModel, run, question, draft, locked)
    }
}

/** An option and the answer it gives; a statement's "Leave blank" gives none. */
private data class MockOption(
    val answer: Answer?,
    val label: String,
)

/**
 * A statement can be left blank only where a wrong answer cancels a right one (Cebraspe), and never
 * in a section that asks for an answer before moving on.
 */
@Composable
private fun Options(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    question: MockQuestion,
    draft: MockDraft?,
    locked: Boolean,
) {
    val words = if (run.view.trueFalseLabels.value == "rightWrong") TrueFalseWords.RightWrong else TrueFalseWords.TrueFalse
    val options =
        if (question.question.format == QuestionFormat.TrueFalse) {
            listOfNotNull(
                MockOption(Answer.TrueFalse(true), trueFalseLabel(true, words)),
                MockOption(Answer.TrueFalse(false), trueFalseLabel(false, words)),
                MockOption(null, stringResource(R.string.questions_leave_blank)).takeIf {
                    run.view.scoring == MockExam.Scoring.NET &&
                        !run.moves.mustAnswer
                },
            )
        } else {
            question.question.options
                .orEmpty()
                .mapIndexed { index, label -> MockOption(Answer.Choice(index), label) }
        }

    fun pick(option: MockOption) {
        if (locked) return
        val picked = draft != null && option.answer != null && draft.answer == option.answer
        if (picked && run.moves.mustAnswer) return
        viewModel.answer(if (picked) null else option.answer)
    }

    AnswerOptionGroup(Modifier.numberKeys(options.size) { pick(options[it]) }) {
        options.forEachIndexed { index, option ->
            AnswerOption(
                marker = index + 1,
                picked = option.answer != null && draft?.answer == option.answer,
                result = null,
                onClick = { pick(option) },
                enabled = !locked,
            ) { ItemLine(option.label, style = MaterialTheme.typography.bodyLarge) }
        }
    }
}

@Composable
private fun Picks(
    viewModel: MockRunnerViewModel,
    question: MockQuestion,
    draft: MockDraft?,
    locked: Boolean,
) {
    val options = question.question.options.orEmpty()
    val picks = (draft?.answer as? Answer.Choices)?.indexes.orEmpty()

    fun toggle(index: Int) {
        if (locked) return
        val next = if (index in picks) picks - index else picks + index
        viewModel.answer(if (next.isEmpty()) null else Answer.Choices(next))
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        question.question.select?.let { PickRule(it) }
        AnswerOptionGroup(Modifier.numberKeys(options.size, ::toggle)) {
            options.forEachIndexed { index, label ->
                AnswerOption(
                    marker = index + 1,
                    picked = index in picks,
                    result = null,
                    onClick = { toggle(index) },
                    enabled = !locked,
                    role = Role.Checkbox,
                ) { ItemLine(label, style = MaterialTheme.typography.bodyLarge) }
            }
        }
    }
}

@Composable
private fun NumberAnswer(
    viewModel: MockRunnerViewModel,
    question: MockQuestion,
    draft: MockDraft?,
    locked: Boolean,
) {
    val saved =
        (draft?.answer as? Answer.Numeric)
            ?.value
            ?.let {
                formatNumber(
                    it,
                    currentLocale(),
                    NUMBER_DIGITS,
                    grouping = false,
                )
            }.orEmpty()
    NumericAnswerField(
        entry = question.question.entry,
        unit = question.question.unit,
        mark = null,
        enabled = !locked,
        onAnswer = viewModel::write,
        onSubmit = viewModel::answer,
        initialText = saved,
    )
}

@Composable
private fun WordAnswer(
    viewModel: MockRunnerViewModel,
    draft: MockDraft?,
    locked: Boolean,
) {
    TypedAnswerField(
        mark = null,
        enabled = !locked,
        onAnswer = { viewModel.write(it) },
        onSubmit = viewModel::answer,
        initialText = (draft?.answer as? Answer.Text)?.text.orEmpty(),
    )
}

@Composable
private fun EssayAnswer(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    draft: MockDraft?,
) {
    val text = (draft?.answer as? Answer.Text)?.text.orEmpty()
    val words = WORDS.findAll(text).count()

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = text,
            onValueChange = { if (it.length <= MAX_ESSAY_CHARACTERS) viewModel.write(Answer.Text(it)) },
            modifier = Modifier.fillMaxWidth().heightIn(min = ESSAY_HEIGHT),
            readOnly = run.pending,
            label = {
                Text(
                    stringResource(
                        if (run.view.essayRubric ==
                            MockExam.EssayRubric.ENEM
                        ) {
                            R.string.mock_your_essay
                        } else {
                            R.string.questions_your_answer
                        },
                    ),
                )
            },
            minLines = ESSAY_LINES,
        )
        Text(
            if (words > 0) pluralStringResource(R.plurals.mock_words, words, words) else "",
            Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        )
    }
}

/** A recording keeps playing while the learner answers its questions, as in the exam: it's keyed by its set. */
@Composable
internal fun MockRecording(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    question: MockQuestion,
    audio: MockAudio,
) {
    val set = question.question.set ?: return
    val listening = set.listening ?: return
    val session = audio.session ?: return
    val onRecording = run.questions.filter { it.question.set?.id == set.id }

    ListeningStimulus(
        listening = listening,
        playsKey = "${run.view.blockId}:${set.id}",
        session = session,
        speech = audio.speech,
        plays = audio.plays,
        countedElsewhere = run.played(set.id),
        count = { viewModel.play(set.id) },
        questions = ListeningQuestions(onRecording.indexOfFirst { it.itemId == question.itemId }, onRecording.map { it.question.question }),
    )
}

/** A cell of the answer sheet: blank, answered, flagged or the one on screen, never by color alone. */
@Composable
internal fun QuestionCell(
    run: MockRun,
    index: Int,
    question: MockQuestion,
    onPick: (Int) -> Unit,
    modifier: Modifier,
    compact: Boolean,
) {
    val draft = run.drafts[question.itemId]
    val answered = draft.isAnswered
    val flagged = draft?.flagged == true
    val current = index == run.position
    val enabled = run.moves.canOpen(index)
    val shape = RoundedCornerShape(if (compact) 6.dp else 10.dp)
    val name =
        if (question.essay) {
            stringResource(
                R.string.mock_written_part,
            )
        } else {
            stringResource(R.string.mock_question_number, question.number)
        }
    val states =
        listOfNotNull(
            stringResource(R.string.mock_cell_answered).takeIf {
                answered
            },
            stringResource(R.string.mock_cell_flagged).takeIf { flagged },
        ).joinToString(", ")
    val border =
        when {
            current -> MaterialTheme.colorScheme.tertiary
            flagged -> MaterialTheme.zoonk.warning
            answered -> Color.Transparent
            else -> MaterialTheme.colorScheme.outlineVariant
        }

    Box(
        modifier
            .heightIn(min = if (compact) 28.dp else 48.dp)
            .clip(shape)
            .background(if (answered) MaterialTheme.colorScheme.surfaceContainerHighest else Color.Transparent)
            .border(if (current) 2.dp else 1.dp, border, shape)
            .clickable(enabled = enabled) { onPick(index) }
            .clearAndSetSemantics {
                contentDescription = name
                stateDescription = states
                selected = current
                role = Role.Button
            },
        contentAlignment = Alignment.Center,
    ) {
        if (question.essay) {
            Icon(
                painterResource(R.drawable.ic_border_color),
                contentDescription = null,
                modifier = Modifier.size(if (compact) 14.dp else 16.dp),
            )
        } else {
            Text(
                question.number.toString(),
                color = if (answered || current) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                style = (if (compact) MaterialTheme.typography.labelSmall else MaterialTheme.typography.labelLarge).withTabularFigures(),
            )
        }
    }
}

@Composable
internal fun Modifier.flaggedEdge(): Modifier = border(1.5.dp, MaterialTheme.zoonk.warning, RoundedCornerShape(2.dp))

/** A new clock for every question, started when it appears; it leaves the question when it runs out. */
@Composable
internal fun ItemCountdown(
    seconds: Int,
    onTimeUp: () -> Unit,
) {
    val startedAt = rememberSaveable { Clock.System.now().toEpochMilliseconds() }
    var remaining by rememberSaveable { mutableStateOf(seconds * MS_PER_SECOND) }
    val label = stringResource(R.string.mock_time_left_question)

    LaunchedEffect(startedAt) {
        while (true) {
            remaining = (startedAt + seconds * MS_PER_SECOND - Clock.System.now().toEpochMilliseconds()).coerceAtLeast(0)
            if (remaining == 0L) {
                onTimeUp()
                return@LaunchedEffect
            }
            delay(1.seconds)
        }
    }

    Row(
        Modifier.clearAndSetSemantics { contentDescription = "$label ${formatClock(remaining)}" },
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(painterResource(R.drawable.ic_timer), contentDescription = null, modifier = Modifier.size(14.dp))
        Text(formatClock(remaining), style = MaterialTheme.typography.labelMedium.withTabularFigures())
    }
}

/** Number keys pick options, as on main; on phones without a keyboard nothing changes. */
private fun Modifier.numberKeys(
    count: Int,
    onPick: (Int) -> Unit,
): Modifier =
    onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
        val index = NUMBER_KEYS.indexOf(event.key)
        if (index !in 0 until count) return@onPreviewKeyEvent false
        onPick(index)
        true
    }

private val NUMBER_KEYS = listOf(Key.One, Key.Two, Key.Three, Key.Four, Key.Five, Key.Six, Key.Seven, Key.Eight, Key.Nine)
private val WORDS = Regex("\\S+")
private const val NUMBER_DIGITS = 4
private const val MAX_ESSAY_CHARACTERS = 12_000
private const val ESSAY_LINES = 10
private val ESSAY_HEIGHT = 288.dp
private const val MS_PER_SECOND = 1000L
