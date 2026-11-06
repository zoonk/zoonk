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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
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
import com.zoonk.android.feature.player.steps.DescribedPicture
import com.zoonk.android.feature.player.steps.QuestionScene
import com.zoonk.android.feature.player.steps.QuestionText
import com.zoonk.android.feature.player.steps.ReadScene
import com.zoonk.android.feature.player.steps.StepActions
import com.zoonk.android.feature.player.steps.StepPart
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.theme.ZoonkRadius

/**
 * A lesson's language: what the learner reads in ([learner]) and what they're learning ([target]); a lesson that
 * isn't about a language reads its words in the learner's language.
 */
data class LessonLanguages(
    val learner: String,
    private val lessonTarget: String?,
) {
    val target: String get() = lessonTarget ?: learner

    /** A language lesson keeps its own look; the lesson marks, maps and icons are for knowledge lessons. */
    val isLanguageLesson: Boolean get() = lessonTarget != null

    /** A lesson in the learner's own language defines words instead of translating them. */
    val definesWords: Boolean get() = lessonTarget != null && learner.substringBefore('-') == lessonTarget.substringBefore('-')
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

@Composable
fun rememberLessonLanguage(
    learner: String,
    target: String?,
): LessonLanguage {
    val speech = LocalLessonSpeech.current
    val languages = remember(learner, target) { LessonLanguages(learner, target) }
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
    part: StepPart,
) {
    val languages = language.languages
    val prompt = language.prompt
    val speech = language.speech
    val exercise = remember(content.exercise) { content.exercise.toExercise() }
    val select = { answer: LessonAnswer? -> if (!locked) actions.select(answer) }
    val sound: (@Composable () -> Unit)? = prompt?.let { promptAudioUrl(content)?.let { url -> { PromptAudioInlineButton(url, prompt) } } }

    when (content.kind) {
        StepKind.Alphabet -> {
            if (part.showsScreen) (exercise.content as? ExerciseContent.Alphabet)?.let { AlphabetView(it.content, sound) }
        }

        StepKind.Vocabulary -> {
            exercise.word?.let { VocabularyView(it, content.wordHints, languages.target, part, sound) }
        }

        StepKind.MultipleChoice -> {
            (exercise.content as? ExerciseContent.MultipleChoice)?.let {
                MultipleChoiceView(it.content, (answer as? LessonAnswer.MultipleChoice)?.optionId, result, locked, select, part)
            }
        }

        StepKind.Translation -> {
            exercise.word?.let { word ->
                TranslationView(word, exercise.translationOptions, answer, result, locked, languages, speech, select, actions, part)
            }
        }

        StepKind.FillBlank -> {
            (exercise.content as? ExerciseContent.FillBlank)?.let { blanks ->
                QuestionWithTurn(part, { blanks.content.question?.let { QuestionText(stripWrappingQuotes(it)) } }) { question ->
                    FillBlankView(
                        blanks.content,
                        exercise.fillBlankOptions,
                        answer,
                        result,
                        locked,
                        languages.target,
                        speech,
                        select,
                        question,
                    )
                }
            }
        }

        StepKind.Reading -> {
            exercise.sentence?.let { sentence ->
                QuestionWithTurn(part, { ReadingPrompt(sentence.translation, exercise.readingPromptWords) }) { question ->
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
                        prompt = question,
                    )
                }
            }
        }

        StepKind.Listening -> {
            exercise.sentence?.let { sentence ->
                val listen = @Composable {
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
                            QuestionText(stripWrappingQuotes(sentence.sentence))
                        }
                    }
                }
                QuestionWithTurn(part, listen) { question ->
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
                        prompt = question,
                    )
                }
            }
        }

        StepKind.MatchColumns -> {
            (exercise.content as? ExerciseContent.MatchColumns)?.let { pairs ->
                val instruction = stripWrappingQuotes(pairs.question ?: stringResource(R.string.player_language_match_the_pairs))
                QuestionWithTurn(part, { QuestionText(instruction) }) { question ->
                    MatchColumnsView(pairs, exercise.matchColumnsRightItems, answer, result != null, locked, select, question)
                }
            }
        }

        else -> {}
    }
}

/**
 * A screen whose view keeps the learner's unsent work (words placed, blanks filled, pairs matched)
 * draws its [question] inside that view, which a spread's turn draws without it, so the work stays
 * where it was when the book opens or closes.
 */
@Composable
private fun QuestionWithTurn(
    part: StepPart,
    question: @Composable () -> Unit,
    turn: @Composable (question: @Composable () -> Unit) -> Unit,
) {
    if (part == StepPart.Screen) QuestionScene { question() } else turn(if (part.showsScreen) question else ({}))
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

/** On a spread the word faces what it means, as a bilingual reader faces its two languages. */
@Composable
private fun VocabularyView(
    word: ExerciseWord,
    hints: WordHints?,
    language: String,
    part: StepPart,
    sound: (@Composable () -> Unit)?,
) {
    val label = stringResource(R.string.player_language_vocabulary, word.word)

    ReadScene {
        if (part.showsScreen) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SoundAfter(sound) { modifier ->
                    Text(
                        word.word,
                        modifier = modifier.semantics { contentDescription = label },
                        style = targetStyle(language, MaterialTheme.typography.displaySmall),
                    )
                }
                Romanization(word.romanization)
                word.pronunciation?.let {
                    Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        if (part.showsTurn) {
            Text(word.translation, style = MaterialTheme.typography.bodyLarge)
            hints?.let { WordHintsView(it) }
        }
    }
}

@Composable
private fun SoundAfter(
    sound: (@Composable () -> Unit)?,
    text: @Composable (Modifier) -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        text(Modifier.weight(1f, fill = false))
        sound?.invoke()
    }
}

@Composable
internal fun Romanization(text: String?) {
    if (text.isNullOrBlank()) return
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AlphabetView(
    content: AlphabetContent,
    sound: (@Composable () -> Unit)?,
) {
    val label = stringResource(R.string.player_language_alphabet, content.symbol)

    ReadScene {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SoundAfter(sound) { modifier ->
                Text(
                    content.symbol,
                    modifier = modifier.semantics { contentDescription = label },
                    style =
                        MaterialTheme.typography.displayLarge.copy(
                            fontWeight = FontWeight.SemiBold,
                            textDirection = TextDirection.Content,
                        ),
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(content.readingAid, style = MaterialTheme.typography.titleLarge)
                Text(
                    content.pronunciation,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
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

/** Main's `StepImageView`: the picture drawn whole, or what it shows when it has no address or doesn't load. */
@Composable
private fun ChoicePicture(
    url: String?,
    prompt: String,
) {
    var failed by remember(url) { mutableStateOf(false) }

    if (url == null || failed) {
        DescribedPicture(prompt)
    } else {
        AsyncImage(
            model = url,
            contentDescription = prompt,
            contentScale = ContentScale.Fit,
            onError = { failed = true },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(max = 320.dp)
                    .clip(RoundedCornerShape(ZoonkRadius.option)),
        )
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
    part: StepPart,
) {
    QuestionScene {
        if (part.showsScreen) {
            val image = content.image
            if (image != null || content.context != null) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    image?.let { ChoicePicture(it.url, it.prompt) }
                    ContextText(content.context?.let(::stripWrappingQuotes))
                }
            }
            content.question?.let { QuestionText(stripWrappingQuotes(it)) }
        }
        if (part.showsTurn) {
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
    actions: StepActions,
    part: StepPart,
) {
    val sounds = speech?.let { rememberSpokenAudio(it, languages.target) }
    val pick = { id: String? ->
        options.find { it.id == id }?.audioUrl?.let { sounds?.speak(listOf(SpokenText(null, recording = it))) }
        select(id?.let(LessonAnswer::Translation))
    }
    val latestPick by rememberUpdatedState(pick)

    if (part.showsTurn) {
        DisposableEffect(actions) {
            actions.takeKeyPicks { answer -> latestPick((answer as? LessonAnswer.Translation)?.optionId) }
            onDispose { actions.takeKeyPicks(null) }
        }
    }

    QuestionScene {
        if (part.showsScreen) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                LabelChip(
                    stringResource(
                        if (languages.definesWords) R.string.player_language_which_means_this else R.string.player_language_translate,
                    ),
                )
                QuestionText(word.translation)
            }
        }
        if (part.showsTurn) {
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
                // A pick tapped again stays picked and says its word again.
                onSelect = { tapped -> pick(tapped ?: (answer as? LessonAnswer.Translation)?.optionId) },
            )
        }
    }
}

@Composable
fun WordHintsView(hints: WordHints) {
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
