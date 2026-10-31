package com.zoonk.android.feature.player.model

import androidx.compose.runtime.Immutable
import com.zoonk.api.models.ActivityExpected
import com.zoonk.api.models.LessonStepAnswer
import com.zoonk.api.models.LessonStepAnswerOneOf
import com.zoonk.api.models.LessonStepAnswerOneOf1
import com.zoonk.api.models.LessonStepAnswerOneOf10
import com.zoonk.api.models.LessonStepAnswerOneOf2
import com.zoonk.api.models.LessonStepAnswerOneOf3
import com.zoonk.api.models.LessonStepAnswerOneOf4
import com.zoonk.api.models.LessonStepAnswerOneOf5
import com.zoonk.api.models.LessonStepAnswerOneOf6
import com.zoonk.api.models.LessonStepAnswerOneOf7
import com.zoonk.api.models.LessonStepAnswerOneOf7UserPairsInner
import com.zoonk.api.models.LessonStepAnswerOneOf8
import com.zoonk.api.models.LessonStepAnswerOneOf9
import com.zoonk.api.models.LessonStepCheckResult
import com.zoonk.api.models.LessonStepCheckResultCorrectionsInner
import com.zoonk.api.models.LessonStepCheckResultKeyPointsInner
import com.zoonk.api.models.SpokenAnswerGrade
import com.zoonk.api.models.SpokenPracticeWord
import com.zoonk.api.models.SpokenWordResult
import kotlin.time.Instant

typealias AnswerCorrection = LessonStepCheckResultCorrectionsInner
typealias AnswerKeyPoint = LessonStepCheckResultKeyPointsInner

/** A learner's answer to one screen. A hook's guess is never sent: it isn't graded. */
@Immutable
sealed interface LessonAnswer {
    data class Hook(
        val optionId: String,
    ) : LessonAnswer

    data class Check(
        val optionId: String,
    ) : LessonAnswer

    data class Typed(
        val text: String,
    ) : LessonAnswer

    /** A spoken screen's sentence typed instead of said. */
    data class Spoken(
        val text: String,
    ) : LessonAnswer

    data class Activity(
        val answer: ActivityAnswer,
    ) : LessonAnswer

    /** The choice picked at each decision, in order. */
    data class Challenge(
        val choiceIds: List<String>,
    ) : LessonAnswer

    data class MultipleChoice(
        val optionId: String,
    ) : LessonAnswer

    data class Translation(
        val optionId: String,
    ) : LessonAnswer

    data class FillBlank(
        val userAnswers: List<String>,
    ) : LessonAnswer

    data class Reading(
        val arrangedWords: List<String>,
    ) : LessonAnswer

    data class Listening(
        val arrangedWords: List<String>,
    ) : LessonAnswer

    data class MatchColumns(
        val pairs: List<Pair<String, String>>,
        val mistakes: Int,
    ) : LessonAnswer
}

/** Written words the learner can lose by leaving: typed answers and a spoken sentence typed instead. */
val LessonAnswer.writtenText: String?
    get() =
        when (this) {
            is LessonAnswer.Typed -> text
            is LessonAnswer.Spoken -> text
            else -> null
        }

fun LessonAnswer.toApi(): LessonStepAnswer? =
    when (this) {
        is LessonAnswer.Hook -> {
            null
        }

        is LessonAnswer.Check -> {
            LessonStepAnswer.LessonStepAnswerOneOfValue(LessonStepAnswerOneOf(LessonStepAnswerOneOf.Kind.CHECK, optionId))
        }

        is LessonAnswer.Typed -> {
            LessonStepAnswer.LessonStepAnswerOneOf1Value(
                LessonStepAnswerOneOf1(LessonStepAnswerOneOf1.Kind.TYPED_ANSWER, text.trim()),
            )
        }

        is LessonAnswer.Spoken -> {
            LessonStepAnswer.LessonStepAnswerOneOf2Value(
                LessonStepAnswerOneOf2(LessonStepAnswerOneOf2.Kind.SPOKEN_ANSWER, text.trim()),
            )
        }

        is LessonAnswer.Activity -> {
            LessonStepAnswer.LessonStepAnswerOneOf3Value(LessonStepAnswerOneOf3(answer, LessonStepAnswerOneOf3.Kind.ACTIVITY))
        }

        is LessonAnswer.Challenge -> {
            LessonStepAnswer.LessonStepAnswerOneOf4Value(LessonStepAnswerOneOf4(choiceIds, LessonStepAnswerOneOf4.Kind.CHALLENGE))
        }

        is LessonAnswer.FillBlank -> {
            LessonStepAnswer.LessonStepAnswerOneOf5Value(LessonStepAnswerOneOf5(LessonStepAnswerOneOf5.Kind.FILL_BLANK, userAnswers))
        }

        is LessonAnswer.Listening -> {
            LessonStepAnswer.LessonStepAnswerOneOf6Value(LessonStepAnswerOneOf6(arrangedWords, LessonStepAnswerOneOf6.Kind.LISTENING))
        }

        is LessonAnswer.MatchColumns -> {
            LessonStepAnswer.LessonStepAnswerOneOf7Value(
                LessonStepAnswerOneOf7(
                    LessonStepAnswerOneOf7.Kind.MATCH_COLUMNS,
                    mistakes.toLong(),
                    pairs.map { (left, right) -> LessonStepAnswerOneOf7UserPairsInner(left, right) },
                ),
            )
        }

        is LessonAnswer.MultipleChoice -> {
            LessonStepAnswer.LessonStepAnswerOneOf8Value(
                LessonStepAnswerOneOf8(LessonStepAnswerOneOf8.Kind.MULTIPLE_CHOICE, optionId),
            )
        }

        is LessonAnswer.Reading -> {
            LessonStepAnswer.LessonStepAnswerOneOf9Value(LessonStepAnswerOneOf9(arrangedWords, LessonStepAnswerOneOf9.Kind.READING))
        }

        is LessonAnswer.Translation -> {
            LessonStepAnswer.LessonStepAnswerOneOf10Value(
                LessonStepAnswerOneOf10(LessonStepAnswerOneOf10.Kind.TRANSLATION, optionId),
            )
        }
    }

/** What a spoken answer was heard as, word by word, with up to two words to practice. */
@Immutable
data class SpokenHeard(
    val transcript: String,
    val words: List<SpokenWordResult>,
    val wordsToPractice: List<SpokenPracticeWord>,
)

/**
 * A screen's verdict. [checked] is false for a typed answer the server didn't grade (shown with the
 * sample answer, not as wrong); [attemptId] ties a verdict given on the device to the server's word
 * on it, which adds [nextReviewAt] and [savedMistake] later.
 */
@Immutable
data class StepResult(
    val isCorrect: Boolean,
    val checked: Boolean = true,
    val answerText: String? = null,
    val correctAnswer: String? = null,
    val feedback: String? = null,
    val corrections: List<AnswerCorrection> = emptyList(),
    val keyPoints: List<AnswerKeyPoint>? = null,
    val expected: ActivityExpected? = null,
    val nextReviewAt: Instant? = null,
    val savedMistake: Boolean = false,
    val score: Double? = null,
    val spelling: String? = null,
    val attemptId: String? = null,
    val heard: SpokenHeard? = null,
)

fun LessonStepCheckResult.toStepResult(answerText: String?): StepResult =
    StepResult(
        isCorrect = isCorrect,
        checked = checked,
        answerText = answerText,
        correctAnswer = correctAnswer,
        feedback = feedback,
        corrections = corrections,
        keyPoints = keyPoints,
        expected = expected,
        nextReviewAt = nextReviewAt,
        savedMistake = savedMistake,
        score = score,
        spelling = spelling,
    )

/** Main's `fromSpokenGrade`: what was heard, and the sentence to say when it wasn't right. */
fun SpokenAnswerGrade.toStepResult(targetText: String): StepResult =
    StepResult(
        isCorrect = isCorrect,
        answerText = transcript,
        correctAnswer = targetText.takeUnless { isCorrect },
        feedback = explanation,
        score = score,
        attemptId = attemptId.toString(),
        heard = SpokenHeard(transcript, words, wordsToPractice),
    )
