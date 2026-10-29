package com.zoonk.android.feature.player.language

import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PlainTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipAnchorPosition
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.changedToUp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInParent
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.zoonk.android.R
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.SpokenText
import com.zoonk.android.feature.audio.rememberSpokenAudio
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.android.feature.player.steps.QuestionScene
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.LabelChip
import kotlinx.coroutines.launch

internal enum class ArrangeKind { Reading, Listening }

/**
 * Build the sentence from the word bank (main's `ArrangeWordsInteraction`): a tap places a word and
 * plays it, a tap on a placed word takes it back, and a long press drags it to another place.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ArrangeWordsView(
    answerText: String,
    kind: ArrangeKind,
    bank: List<WordBankOption>,
    answer: LessonAnswer?,
    result: StepResult?,
    locked: Boolean,
    language: String,
    speech: SpeechPlayer?,
    onAnswer: (LessonAnswer?) -> Unit,
    prompt: @Composable () -> Unit,
) {
    val correctWords = remember(answerText) { acceptedWords(answerText) }
    var placed by rememberSaveable(stateSaver = PlacedWordsSaver) { mutableStateOf(initialPlacement(answer)) }
    val sounds = speech?.let { rememberSpokenAudio(it, language) }
    val checked = result != null
    val editable = !checked && !locked

    fun update(next: List<PlacedWord>) {
        placed = next
        val words = next.map(PlacedWord::word)
        when {
            correctWords.isNotEmpty() && words.size == correctWords.size -> onAnswer(kind.answer(words))
            answer != null -> onAnswer(null)
        }
    }

    // After the app was closed in the background, the saved words come back but the player's answer doesn't.
    LaunchedEffect(Unit) {
        if (answer == null && !checked && correctWords.isNotEmpty() && placed.size == correctWords.size) {
            onAnswer(kind.answer(placed.map(PlacedWord::word)))
        }
    }

    QuestionScene {
        prompt()
        AnswerArea(
            placed = placed,
            correctWords = correctWords.takeIf { checked },
            editable = editable,
            language = language,
            onRemove = { index -> update(placed.filterIndexed { i, _ -> i != index }) },
            onMove = { from, to -> update(placed.toMutableList().apply { add(to, removeAt(from)) }) },
        )
        WordBank(
            words = bank,
            used = usedTiles(bank, placed),
            enabled = editable,
            language = language,
            onPlace = { index ->
                if (placed.size >= correctWords.size) return@WordBank
                val option = bank[index]
                option.audioUrl?.let { sounds?.speak(listOf(SpokenText(null, recording = it))) }
                update(placed + PlacedWord(option.word, option.romanization, index))
            },
        )
    }
}

private fun ArrangeKind.answer(words: List<String>): LessonAnswer =
    when (this) {
        ArrangeKind.Reading -> LessonAnswer.Reading(words)
        ArrangeKind.Listening -> LessonAnswer.Listening(words)
    }

private fun initialPlacement(answer: LessonAnswer?): List<PlacedWord> {
    val words =
        when (answer) {
            is LessonAnswer.Reading -> answer.arrangedWords
            is LessonAnswer.Listening -> answer.arrangedWords
            else -> emptyList()
        }
    return words.map { PlacedWord(it, romanization = null, bankIndex = null) }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AnswerArea(
    placed: List<PlacedWord>,
    correctWords: List<String>?,
    editable: Boolean,
    language: String,
    onRemove: (Int) -> Unit,
    onMove: (Int, Int) -> Unit,
) {
    val label = stringResource(R.string.player_language_your_answer)
    val bounds = remember { mutableStateMapOf<Int, Rect>() }
    var dragging by remember { mutableStateOf<Int?>(null) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    val haptics = LocalHapticFeedback.current
    val earlier = stringResource(R.string.player_language_move_earlier)
    val later = stringResource(R.string.player_language_move_later)
    val remove = stringResource(R.string.player_language_remove)
    val correct = stringResource(R.string.player_language_correct)
    val incorrect = stringResource(R.string.player_language_incorrect)

    fun drop(rtl: Boolean) {
        val from = dragging ?: return
        val point = bounds[from]?.center?.plus(offset)
        dragging = null
        offset = Offset.Zero
        val to = point?.let { dropIndex(it, bounds.filterKeys { key -> key <= placed.lastIndex }, rtl) } ?: return
        if (to != from) onMove(from, to)
    }

    Column {
        TargetDirection(language) {
            val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
            FlowRow(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .padding(bottom = 12.dp)
                    .semantics { contentDescription = label },
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (placed.isEmpty()) {
                    Text(
                        stringResource(R.string.player_language_pick_words),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                placed.forEachIndexed { index, word ->
                    val result = correctWords?.let { if (it.getOrNull(index) == word.word) AnswerResult.Right else AnswerResult.Wrong }
                    val verdict = if (result == AnswerResult.Right) correct else incorrect
                    val description =
                        if (result == null) {
                            stringResource(R.string.player_language_position, index + 1, word.word)
                        } else {
                            stringResource(R.string.player_language_checked_word, word.word, verdict)
                        }
                    val moves =
                        listOfNotNull(
                            CustomAccessibilityAction(earlier) { true.also { onMove(index, index - 1) } }.takeIf { index > 0 },
                            CustomAccessibilityAction(later) { true.also { onMove(index, index + 1) } }.takeIf { index < placed.lastIndex },
                        )
                    WordChip(
                        word = word.word,
                        romanization = word.romanization,
                        language = language,
                        result = result,
                        enabled = editable,
                        clickLabel = remove,
                        onClick = { onRemove(index) },
                        modifier =
                            Modifier
                                .onGloballyPositioned { bounds[index] = it.boundsInParent() }
                                .zIndex(if (dragging == index) 1f else 0f)
                                .graphicsLayer {
                                    if (dragging == index) {
                                        translationX = offset.x
                                        translationY = offset.y
                                    }
                                }.semantics {
                                    contentDescription = description
                                    if (editable) customActions = moves
                                }.then(
                                    if (editable) {
                                        Modifier
                                            .longPressIsNotATap()
                                            .pointerInput(index, placed) {
                                                detectDragGesturesAfterLongPress(
                                                    onDragStart = {
                                                        dragging = index
                                                        offset = Offset.Zero
                                                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                                    },
                                                    onDrag = { change, amount ->
                                                        change.consume()
                                                        offset += amount
                                                    },
                                                    onDragEnd = { drop(rtl) },
                                                    // The release that ends a drag is consumed, so a drag ends as a cancel.
                                                    onDragCancel = { drop(rtl) },
                                                )
                                            }
                                    } else {
                                        Modifier
                                    },
                                ),
                    )
                }
            }
        }
        HorizontalDivider()
    }
}

/** The word nearest the drop; past the last word on its line, the last place. */
internal fun dropIndex(
    point: Offset,
    bounds: Map<Int, Rect>,
    rtl: Boolean,
): Int? {
    if (bounds.isEmpty()) return null
    val last = bounds.maxBy { it.key }
    val pastLast = if (rtl) point.x < last.value.left else point.x > last.value.right
    if (point.y >= last.value.top && pastLast) return last.key
    return bounds.minBy { (it.value.center - point).getDistanceSquared() }.key
}

/**
 * A press held long enough to start a drag doesn't also count as a tap when it lifts, so a long press
 * that never moves leaves the word where it is.
 */
private fun Modifier.longPressIsNotATap() =
    pointerInput(Unit) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
            val longPressAt = down.uptimeMillis + viewConfiguration.longPressTimeoutMillis
            while (true) {
                val change = awaitPointerEvent(PointerEventPass.Initial).changes.firstOrNull { it.id == down.id } ?: break
                if (change.changedToUp()) {
                    if (change.uptimeMillis >= longPressAt) change.consume()
                    break
                }
            }
        }
    }

private val PlacedWordsSaver =
    listSaver<List<PlacedWord>, String>(
        save = { words -> words.flatMap { listOf(it.word, it.romanization ?: NONE, it.bankIndex?.toString() ?: NONE) } },
        restore = { saved ->
            saved.chunked(3).map { (word, romanization, index) ->
                PlacedWord(word, romanization.takeUnless { it == NONE }, index.takeUnless { it == NONE }?.toInt())
            }
        },
    )

private const val NONE = "\u0000"

/**
 * Reading's prompt: the sentence in the learner's language, each word that stands for a word of the
 * answer showing it on a tap. It steps back once the answer is checked.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ReadingPrompt(
    sentence: String,
    sentenceWordOptions: List<WordBankOption>,
    answered: Boolean,
) {
    val prompt = remember(sentence) { stripWrappingQuotes(sentence) }
    val hints = remember(prompt, sentenceWordOptions) { readingPromptHints(prompt, sentenceWordOptions) }
    val color = if (answered) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface
    val style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.SemiBold, color = color)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        LabelChip(stringResource(R.string.player_language_translate))
        FlowRow(
            // One stop reads the whole sentence; each word with a translation is its own stop after it.
            Modifier.semantics(mergeDescendants = true) {
                contentDescription = prompt
                heading()
            },
            horizontalArrangement = Arrangement.spacedBy(if (' ' in prompt) 6.dp else 0.dp),
        ) {
            hints.forEach { hint ->
                val translation = hint.translation
                if (translation == null) {
                    Text(hint.word, style = style)
                } else {
                    HintedWord(hint.word, translation, style)
                }
            }
        }
    }
}

/** Main's dotted underline: the word has more to show, without reading as a link. */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun HintedWord(
    word: String,
    translation: String,
    style: androidx.compose.ui.text.TextStyle,
) {
    val tooltip = rememberTooltipState(isPersistent = true)
    val scope = rememberCoroutineScope()
    val dots = MaterialTheme.colorScheme.onSurfaceVariant
    var baseline by remember { mutableFloatStateOf(0f) }

    TooltipBox(
        positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Above),
        tooltip = {
            PlainTooltip {
                Text(
                    translation,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        },
        state = tooltip,
    ) {
        Text(
            word,
            style = style,
            onTextLayout = { baseline = it.firstBaseline },
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clickable(
                        role = Role.Button,
                        onClickLabel = stringResource(R.string.player_language_show_translation),
                    ) { scope.launch { tooltip.show() } }
                    .drawBehind {
                        val y = baseline + 4.dp.toPx()
                        val radius = 1.25.dp.toPx()
                        val step = 4.dp.toPx()
                        var x = radius
                        while (x < size.width) {
                            drawCircle(dots, radius, Offset(x, y))
                            x += step
                        }
                    },
        )
    }
}
