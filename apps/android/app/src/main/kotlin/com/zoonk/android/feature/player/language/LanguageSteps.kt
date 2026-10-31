package com.zoonk.android.feature.player.language

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.zoonk.android.R
import com.zoonk.android.feature.audio.SpeechFailedNote
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.SpeechState
import com.zoonk.android.feature.audio.SpokenText
import com.zoonk.android.feature.audio.buttonIconSize
import com.zoonk.android.feature.audio.rememberSpokenAudio
import com.zoonk.android.feature.player.LocalLessonSpeech
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.android.feature.player.model.WordHints
import com.zoonk.android.feature.player.steps.ChoiceOption
import com.zoonk.android.feature.player.steps.ChoiceOptions
import com.zoonk.android.feature.player.steps.ContextText
import com.zoonk.android.feature.player.steps.QuestionScene
import com.zoonk.android.feature.player.steps.QuestionText
import com.zoonk.android.feature.player.steps.ReadScene
import com.zoonk.android.feature.player.steps.StepActions
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.richtext.RichInlineText

/** A lesson's language: what the learner reads in ([learner]) and what they're learning ([target]). */
data class LessonLanguages(
    val learner: String,
    val target: String,
) {
    /** A lesson in the learner's own language defines words instead of translating them. */
    val definesWords: Boolean get() = learner.substringBefore('-') == target.substringBefore('-')
}

/**
 * What a lesson's language screens share: its languages, the screen's recording and the app's
 * player, which previews and tests leave out, so those screens make no sound.
 */
@Stable
class LessonLanguage internal constructor(
    val languages: LessonLanguages,
    val prompt: PromptAudio?,
    val speech: SpeechPlayer?,
)

/** A lesson that isn't about a language reads its words in the learner's language. */
@Composable
fun rememberLessonLanguage(
    learner: String,
    target: String?,
): LessonLanguage {
    val speech = LocalLessonSpeech.current
    val languages = remember(learner, target) { LessonLanguages(learner, target ?: learner) }
    val prompt = speech?.let { rememberPromptAudio(it, languages.target) }
    return remember(languages, prompt, speech) { LessonLanguage(languages, prompt, speech) }
}

/** Main's language screens (`ExerciseStepView`), one view per kind. */
@Composable
fun LanguageStepView(
    content: StepContent.Language,
    answer: LessonAnswer?,
    result: StepResult?,
    locked: Boolean,
    language: LessonLanguage,
    actions: StepActions,
) {
    val languages = language.languages
    val prompt = language.prompt
    val speech = language.speech
    val exercise = remember(content.exercise) { content.exercise.toExercise() }
    val select = { answer: LessonAnswer? -> if (!locked) actions.select(answer) }

    when (content.kind) {
        StepKind.Alphabet -> {
            (exercise.content as? ExerciseContent.Alphabet)?.let { AlphabetView(it.content) }
        }

        StepKind.Vocabulary -> {
            exercise.word?.let { VocabularyView(it, content.wordHints, languages.target) }
        }

        StepKind.MultipleChoice -> {
            (exercise.content as? ExerciseContent.MultipleChoice)?.let {
                MultipleChoiceView(it.content, (answer as? LessonAnswer.MultipleChoice)?.optionId, result, locked, select)
            }
        }

        StepKind.Translation -> {
            exercise.word?.let { word ->
                TranslationView(word, exercise.translationOptions, answer, result, locked, languages, speech, select)
            }
        }

        StepKind.FillBlank -> {
            (exercise.content as? ExerciseContent.FillBlank)?.let {
                FillBlankView(it.content, exercise.fillBlankOptions, answer, result, locked, languages.target, speech, select)
            }
        }

        StepKind.Reading -> {
            exercise.sentence?.let { sentence ->
                ArrangeWordsView(
                    answerText = sentence.sentence,
                    kind = ArrangeKind.Reading,
                    bank = exercise.wordBankOptions,
                    answer = answer,
                    result = result,
                    locked = locked,
                    language = languages.target,
                    speech = speech,
                    onAnswer = select,
                ) { ReadingPrompt(sentence.translation, exercise.sentenceWordOptions, answered = result != null) }
            }
        }

        StepKind.Listening -> {
            exercise.sentence?.let { sentence ->
                ArrangeWordsView(
                    answerText = sentence.translation,
                    kind = ArrangeKind.Listening,
                    bank = exercise.wordBankOptions,
                    answer = answer,
                    result = result,
                    locked = locked,
                    language = languages.learner,
                    speech = speech,
                    onAnswer = select,
                ) {
                    val url = sentence.audioUrl
                    if (url != null && prompt != null) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            LabelChip(stringResource(R.string.player_language_what_do_you_hear))
                            PromptAudioButton(url, prompt)
                            // Without its sound the screen still works: it shows the sentence to translate.
                            if (prompt.state is SpeechState.Failed) {
                                SpeechFailedNote(
                                    language = languages.target,
                                    limit = null,
                                    onRetry = { prompt.toggle(url) },
                                    navigator = null,
                                    text = stripWrappingQuotes(sentence.sentence),
                                )
                            }
                        }
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            LabelChip(stringResource(R.string.player_language_translate))
                            QuestionText(stripWrappingQuotes(sentence.sentence), answered = result != null)
                        }
                    }
                }
            }
        }

        StepKind.MatchColumns -> {
            (exercise.content as? ExerciseContent.MatchColumns)?.let {
                MatchColumnsView(it, exercise.matchColumnsRightItems, answer, result != null, locked, select)
            }
        }

        else -> {}
    }
}

/** The answer a number key picks on a language screen of options; null where keys pick nothing. */
fun languageOptionAnswer(
    content: StepContent.Language,
    index: Int,
): LessonAnswer? {
    val exercise = content.exercise.toExercise()
    return when (content.kind) {
        StepKind.MultipleChoice -> {
            (exercise.content as? ExerciseContent.MultipleChoice)
                ?.content
                ?.options
                ?.getOrNull(index)
                ?.let { LessonAnswer.MultipleChoice(it.id) }
        }

        StepKind.Translation -> {
            exercise.translationOptions.getOrNull(index)?.let { LessonAnswer.Translation(it.id) }
        }

        else -> {
            null
        }
    }
}

/** Text in the language being learned, read and spoken in that language and in its own direction. */
@Composable
internal fun targetStyle(
    language: String,
    base: androidx.compose.ui.text.TextStyle,
) = remember(language, base) { base.copy(localeList = LocaleList(language), textDirection = TextDirection.Content) }

@Composable
private fun VocabularyView(
    word: ExerciseWord,
    hints: WordHints?,
    language: String,
) {
    val label = stringResource(R.string.player_language_vocabulary, word.word)

    ReadScene {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                word.word,
                modifier = Modifier.semantics { contentDescription = label },
                style = targetStyle(language, MaterialTheme.typography.displaySmall),
            )
            Romanization(word.romanization)
            word.pronunciation?.let {
                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            }
        }
        Text(word.translation, style = MaterialTheme.typography.bodyLarge)
        hints?.let { WordHintsView(it) }
    }
}

@Composable
internal fun Romanization(text: String?) {
    if (text.isNullOrBlank()) return
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AlphabetView(content: AlphabetContent) {
    val label = stringResource(R.string.player_language_alphabet, content.symbol)

    ReadScene {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                content.symbol,
                modifier = Modifier.semantics { contentDescription = label },
                style = MaterialTheme.typography.displayLarge.copy(fontWeight = FontWeight.SemiBold, textDirection = TextDirection.Content),
            )
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(content.readingAid, style = MaterialTheme.typography.titleLarge)
                Text(content.pronunciation, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            }
        }
        if (content.forms.isNotEmpty()) {
            val formStyle = MaterialTheme.typography.headlineSmall.copy(textDirection = TextDirection.Content)
            BoxWithConstraints {
                val wide = maxWidth >= WIDE_FORMS
                Column {
                    HorizontalDivider()
                    FlowRow(
                        Modifier.fillMaxWidth().padding(vertical = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        maxItemsInEachRow = if (wide) 4 else 2,
                    ) {
                        content.forms.forEach { form ->
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    form.label,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.labelMedium,
                                )
                                Text(form.symbol, style = formStyle)
                            }
                        }
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}

/** Four forms to a row once the column is wide enough, as main's grid does from `sm`. */
private val WIDE_FORMS = 520.dp

@Composable
private fun MultipleChoiceView(
    content: MultipleChoiceContent,
    selectedId: String?,
    result: StepResult?,
    locked: Boolean,
    select: (LessonAnswer?) -> Unit,
) {
    QuestionScene {
        val image = content.image
        if (image?.url != null || content.context != null) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                image?.url?.let { url ->
                    AsyncImage(
                        model = url,
                        contentDescription = image.prompt,
                        contentScale = ContentScale.Crop,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .heightIn(max = 320.dp)
                                .clip(RoundedCornerShape(12.dp)),
                    )
                }
                ContextText(content.context?.let(::stripWrappingQuotes))
            }
        }
        content.question?.let { QuestionText(stripWrappingQuotes(it), answered = result != null) }
        ChoiceOptions(
            options = content.options.map { ChoiceOption(it.id, it.text, it.isCorrect) },
            selectedId = selectedId,
            isChecked = result != null,
            isGuess = false,
            locked = locked,
            onSelect = { id -> select(id?.let(LessonAnswer::MultipleChoice)) },
        )
    }
}

@Composable
private fun TranslationView(
    word: ExerciseWord,
    options: List<TranslationOption>,
    answer: LessonAnswer?,
    result: StepResult?,
    locked: Boolean,
    languages: LessonLanguages,
    speech: SpeechPlayer?,
    select: (LessonAnswer?) -> Unit,
) {
    val sounds = speech?.let { rememberSpokenAudio(it, languages.target) }

    QuestionScene {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            LabelChip(
                stringResource(
                    if (languages.definesWords) R.string.player_language_which_means_this else R.string.player_language_translate,
                ),
            )
            QuestionText(word.translation, answered = result != null)
        }
        ChoiceOptions(
            options = options.map { ChoiceOption(it.id, it.word, it.id == word.id) },
            selectedId = (answer as? LessonAnswer.Translation)?.optionId,
            isChecked = result != null,
            isGuess = false,
            locked = locked,
            optionContent = { option ->
                Column {
                    Text(targetText(option.text, languages.target), style = MaterialTheme.typography.bodyLarge)
                    Romanization(options.find { it.id == option.id }?.romanization)
                }
            },
            onSelect = { id ->
                options.find { it.id == id }?.audioUrl?.let { sounds?.speak(listOf(SpokenText(null, recording = it))) }
                select(id?.let(LessonAnswer::Translation))
            },
        )
    }
}

@Composable
private fun WordHintsView(hints: WordHints) {
    val note = hints.note
    val tip = hints.pronunciationTip
    if (note.isNullOrBlank() && tip.isNullOrBlank()) return

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (!note.isNullOrBlank()) WordHint(R.drawable.ic_lightbulb, stringResource(R.string.player_language_usage), note)
        if (!tip.isNullOrBlank()) WordHint(R.drawable.ic_sms, stringResource(R.string.player_language_pronunciation_tip), tip)
    }
}

/** [kind] ("Usage:") is read before the hint, since the icon alone says it only to the eye. */
@Composable
private fun WordHint(
    icon: Int,
    kind: String,
    text: String,
) {
    Row(
        Modifier.semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            painterResource(icon),
            contentDescription = kind,
            modifier = Modifier.padding(top = 2.dp).size(buttonIconSize()),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        RichInlineText(text = text, modifier = Modifier.widthIn(max = 640.dp), style = MaterialTheme.typography.bodyMedium)
    }
}
