package com.zoonk.android.feature.player.language

import androidx.compose.runtime.Immutable
import com.zoonk.android.feature.player.model.LanguageExercise
import com.zoonk.api.models.PlayableLibraryStepAnyOf5ListeningOneOf1Content
import com.zoonk.api.models.PlayableLibraryStepAnyOf5ListeningOneOf3ContentPairsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOf5ListeningOneOf4Content
import com.zoonk.api.models.PlayableLibraryStepAnyOf5ListeningOneOfContent
import com.zoonk.api.models.PlayableLibraryStepAnyOf5ListeningOneOfFillBlankOptionsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOf5ListeningOneOfSentence
import com.zoonk.api.models.PlayableLibraryStepAnyOf5ListeningOneOfTranslationOptionsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOf5ListeningOneOfWord
import com.zoonk.api.models.PlayableLibraryStepAnyOf9Exercise

// The contract's names for a language screen's parts, so code reads by meaning, not by union position.
typealias ExerciseWord = PlayableLibraryStepAnyOf5ListeningOneOfWord
typealias ExerciseSentence = PlayableLibraryStepAnyOf5ListeningOneOfSentence
typealias WordBankOption = PlayableLibraryStepAnyOf5ListeningOneOfFillBlankOptionsInner
typealias TranslationOption = PlayableLibraryStepAnyOf5ListeningOneOfTranslationOptionsInner
typealias AlphabetContent = PlayableLibraryStepAnyOf5ListeningOneOfContent
typealias FillBlankContent = PlayableLibraryStepAnyOf5ListeningOneOf1Content
typealias MatchPair = PlayableLibraryStepAnyOf5ListeningOneOf3ContentPairsInner
typealias MultipleChoiceContent = PlayableLibraryStepAnyOf5ListeningOneOf4Content

/** What every language screen carries, with its kind's own content; the generated union has eight copies. */
@Immutable
data class Exercise(
    val word: ExerciseWord?,
    val sentence: ExerciseSentence?,
    val translationOptions: List<TranslationOption>,
    val fillBlankOptions: List<WordBankOption>,
    val wordBankOptions: List<WordBankOption>,
    val sentenceWordOptions: List<WordBankOption>,
    val matchColumnsRightItems: List<String>,
    val content: ExerciseContent,
)

@Immutable
sealed interface ExerciseContent {
    data class Alphabet(
        val content: AlphabetContent,
    ) : ExerciseContent

    data class FillBlank(
        val content: FillBlankContent,
    ) : ExerciseContent

    data class MatchColumns(
        val pairs: List<MatchPair>,
        val question: String?,
    ) : ExerciseContent

    data class MultipleChoice(
        val content: MultipleChoiceContent,
    ) : ExerciseContent

    /** Listening, reading, translation and vocabulary read the shared word or sentence. */
    data object Shared : ExerciseContent
}

fun LanguageExercise.toExercise(): Exercise =
    when (this) {
        is PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOfValue -> {
            with(value) {
                Exercise(
                    word,
                    sentence,
                    translationOptions,
                    fillBlankOptions,
                    wordBankOptions,
                    sentenceWordOptions,
                    matchColumnsRightItems,
                    ExerciseContent.Alphabet(content),
                )
            }
        }

        is PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf1Value -> {
            with(value) {
                Exercise(
                    word,
                    sentence,
                    translationOptions,
                    fillBlankOptions,
                    wordBankOptions,
                    sentenceWordOptions,
                    matchColumnsRightItems,
                    ExerciseContent.FillBlank(content),
                )
            }
        }

        is PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf2Value -> {
            with(value) {
                Exercise(
                    word,
                    sentence,
                    translationOptions,
                    fillBlankOptions,
                    wordBankOptions,
                    sentenceWordOptions,
                    matchColumnsRightItems,
                    ExerciseContent.Shared,
                )
            }
        }

        is PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf3Value -> {
            with(value) {
                Exercise(
                    word,
                    sentence,
                    translationOptions,
                    fillBlankOptions,
                    wordBankOptions,
                    sentenceWordOptions,
                    matchColumnsRightItems,
                    ExerciseContent.MatchColumns(content.pairs, content.question),
                )
            }
        }

        is PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf4Value -> {
            with(value) {
                Exercise(
                    word,
                    sentence,
                    translationOptions,
                    fillBlankOptions,
                    wordBankOptions,
                    sentenceWordOptions,
                    matchColumnsRightItems,
                    ExerciseContent.MultipleChoice(content),
                )
            }
        }

        is PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf5Value -> {
            with(value) {
                Exercise(
                    word,
                    sentence,
                    translationOptions,
                    fillBlankOptions,
                    wordBankOptions,
                    sentenceWordOptions,
                    matchColumnsRightItems,
                    ExerciseContent.Shared,
                )
            }
        }

        is PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf6Value -> {
            with(value) {
                Exercise(
                    word,
                    sentence,
                    translationOptions,
                    fillBlankOptions,
                    wordBankOptions,
                    sentenceWordOptions,
                    matchColumnsRightItems,
                    ExerciseContent.Shared,
                )
            }
        }

        is PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf7Value -> {
            with(value) {
                Exercise(
                    word,
                    sentence,
                    translationOptions,
                    fillBlankOptions,
                    wordBankOptions,
                    sentenceWordOptions,
                    matchColumnsRightItems,
                    ExerciseContent.Shared,
                )
            }
        }
    }
