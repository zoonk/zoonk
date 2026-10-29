package com.zoonk.android.feature.player.language

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.SpokenText
import com.zoonk.android.feature.audio.rememberSpokenAudio
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.android.feature.player.steps.QuestionScene
import com.zoonk.android.feature.player.steps.QuestionText

private const val BLANK = "[BLANK]"

/** A word with the space after it, so a space is never a stop of its own. */
private val WORD = Regex("""\S+\s*""")

private val WORD_SPACE = 6.dp

/** Main's `FillBlankStep`: words from the bank fill the sentence's blanks in order; a tap empties one. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun FillBlankView(
    content: FillBlankContent,
    options: List<WordBankOption>,
    answer: LessonAnswer?,
    result: StepResult?,
    locked: Boolean,
    language: String,
    speech: SpeechPlayer?,
    onAnswer: (LessonAnswer?) -> Unit,
) {
    val blankCount = content.answers.size
    var blanks by rememberSaveable(stateSaver = BlanksSaver) {
        mutableStateOf((answer as? LessonAnswer.FillBlank)?.userAnswers ?: List(blankCount) { null })
    }
    val sounds = speech?.let { rememberSpokenAudio(it, language) }
    val checked = result != null
    val editable = !checked && !locked
    val romanization =
        remember(content) {
            val first = content.answers.firstOrNull().orEmpty()
            val sentence = content.template.replaceFirst(BLANK, first)
            templateRomanization(content.romanizations?.get(first), content.romanizations?.get(sentence))
        }
    val segments = remember(content.template) { content.template.split(BLANK) }
    val style = targetStyle(language, MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.SemiBold))

    // After the app was closed in the background, the saved blanks come back but the player's answer doesn't.
    LaunchedEffect(Unit) {
        if (answer == null && !checked && blanks.isNotEmpty() && blanks.none { it == null }) {
            onAnswer(LessonAnswer.FillBlank(blanks.filterNotNull()))
        }
    }

    QuestionScene {
        content.question?.let { QuestionText(stripWrappingQuotes(it)) }

        val words = if (checked) style.copy(color = MaterialTheme.colorScheme.onSurfaceVariant) else style
        TargetDirection(language) {
            // Words read as one stop with the empty blanks in it; a filled blank is its own stop.
            FlowRow(
                Modifier.semantics(mergeDescendants = true) {},
                verticalArrangement = Arrangement.spacedBy(8.dp),
                itemVerticalAlignment = Alignment.Bottom,
            ) {
                segments.forEachIndexed { index, segment ->
                    if (segment.startsWith(' ') && index > 0) Spacer(Modifier.width(WORD_SPACE))
                    WORD.findAll(segment).forEach { word ->
                        // The blank's word sits 4dp up on its line, so plain words sit there too.
                        Text(word.value, style = words, modifier = Modifier.padding(bottom = 4.dp))
                    }
                    if (index < segments.lastIndex) {
                        BlankSlot(
                            index = index,
                            word = blanks.getOrNull(index),
                            correct =
                                if (checked) {
                                    blanks
                                        .getOrNull(
                                            index,
                                        )?.equals(content.answers.getOrNull(index), ignoreCase = true)
                                } else {
                                    null
                                },
                            enabled = editable,
                            style = style,
                            onRemove = {
                                blanks = blanks.toMutableList().also { it[index] = null }
                                if (answer != null) onAnswer(null)
                            },
                        )
                    }
                }
            }
        }

        Romanization(romanization)

        WordBank(
            words = options,
            used = usedBlankTiles(options, blanks),
            enabled = editable,
            language = language,
            onPlace = { tile ->
                val empty = blanks.indexOf(null)
                if (empty == -1) return@WordBank
                val option = options[tile]
                option.audioUrl?.let { sounds?.speak(listOf(SpokenText(null, recording = it))) }
                val next = blanks.toMutableList().also { it[empty] = option.word }
                blanks = next
                if (next.none { it == null }) onAnswer(LessonAnswer.FillBlank(next.filterNotNull()))
            },
        )
    }
}

/** A tile is in use once as many blanks hold its word as tiles up to it show that word. */
internal fun usedBlankTiles(
    options: List<WordBankOption>,
    blanks: List<String?>,
): List<Boolean> =
    options.mapIndexed { index, option ->
        val occurrence = options.take(index + 1).count { it.word == option.word }
        blanks.count { it == option.word } >= occurrence
    }

@Composable
private fun BlankSlot(
    index: Int,
    word: String?,
    correct: Boolean?,
    enabled: Boolean,
    style: androidx.compose.ui.text.TextStyle,
    onRemove: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val line =
        when (correct) {
            true -> colors.tertiary
            false -> colors.error
            null -> if (word == null) colors.outlineVariant else colors.onSurfaceVariant
        }
    val position = index + 1
    val description =
        when {
            word == null -> {
                stringResource(R.string.player_language_blank, position)
            }

            correct == null -> {
                stringResource(R.string.player_language_blank_filled, position, word)
            }

            else -> {
                stringResource(
                    R.string.player_language_blank_checked,
                    position,
                    word,
                    stringResource(if (correct) R.string.player_language_correct else R.string.player_language_incorrect),
                )
            }
        }

    Box(
        Modifier
            .widthIn(min = 64.dp)
            .heightIn(min = 48.dp)
            .then(
                if (word != null && enabled) {
                    Modifier.clickable(
                        role = Role.Button,
                        onClickLabel = stringResource(R.string.player_language_remove),
                        onClick = onRemove,
                    )
                } else {
                    Modifier
                },
            ).semantics { contentDescription = description }
            .drawBehind {
                val stroke = 2.dp.toPx()
                drawLine(line, Offset(0f, size.height - stroke / 2), Offset(size.width, size.height - stroke / 2), stroke)
            }.padding(horizontal = 4.dp),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Text(word.orEmpty(), style = style, modifier = Modifier.padding(bottom = 4.dp))
    }
}

private val BlanksSaver =
    listSaver<List<String?>, String>(
        save = { blanks -> blanks.map { it ?: "\u0000" } },
        restore = { saved -> saved.map { it.takeUnless { value -> value == "\u0000" } } },
    )
