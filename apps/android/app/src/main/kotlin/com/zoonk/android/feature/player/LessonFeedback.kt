package com.zoonk.android.feature.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.player.engine.isLanguageStep
import com.zoonk.android.feature.player.model.AnswerCorrection
import com.zoonk.android.feature.player.model.AnswerKeyPoint
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.android.feature.player.steps.count
import com.zoonk.android.ui.components.FeedbackNote
import com.zoonk.android.ui.components.FeedbackPanel
import com.zoonk.android.ui.components.FeedbackTone
import com.zoonk.android.ui.components.FeedbackVerdict
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.richtext.RichText
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import kotlin.time.Instant
import kotlin.time.toJavaInstant

private enum class Verdict(
    val label: Int,
    val tone: FeedbackTone,
) {
    Almost(R.string.player_verdict_almost, FeedbackTone.Almost),
    Correct(R.string.player_verdict_correct, FeedbackTone.Right),
    Guess(R.string.player_verdict_guess, FeedbackTone.Neutral),
    GuessRight(R.string.player_verdict_guess_right, FeedbackTone.Right),
    Incorrect(R.string.player_verdict_incorrect, FeedbackTone.Wrong),
    SampleAnswer(R.string.player_verdict_sample_answer, FeedbackTone.Neutral),
    Typo(R.string.player_verdict_typo, FeedbackTone.Right),
    Unchecked(R.string.player_verdict_unchecked, FeedbackTone.Neutral),
}

private fun verdictOf(
    step: LessonStep,
    result: StepResult,
): Verdict =
    when {
        step.kind == StepKind.Hook -> if (result.isCorrect) Verdict.GuessRight else Verdict.Guess
        !result.checked -> if (result.answerText == null) Verdict.SampleAnswer else Verdict.Unchecked
        result.isCorrect -> if (result.spelling != null) Verdict.Typo else Verdict.Correct
        (result.score ?: 0.0) > 0 -> Verdict.Almost
        else -> Verdict.Incorrect
    }

/** Where the question goes next, said once under the verdict. */
data class ResultNext(
    val nextReviewAt: Instant?,
    val savedMistake: Boolean,
    val willReturn: Boolean,
)

/** Key points shown only when they agree with the verdict, as main does. */
private fun shownKeyPoints(result: StepResult): List<AnswerKeyPoint>? {
    val keyPoints = result.keyPoints ?: return null
    if (result.feedback == null || result.corrections.isNotEmpty()) return keyPoints
    return keyPoints.takeIf { points -> points.all { it.met } == result.isCorrect }
}

private val OPTION_LANGUAGE_KINDS = setOf(StepKind.MultipleChoice, StepKind.Translation)

/** What a checked answer got, under the question (main's `LessonStepResultView`). */
@Composable
fun LessonStepResultView(
    step: LessonStep,
    result: StepResult,
    next: ResultNext,
    hyperdriveStreak: Int?,
) {
    val verdict = verdictOf(step, result)
    val keyPoints = shownKeyPoints(result)

    FeedbackPanel(label = stringResource(R.string.player_answer_feedback)) {
        FeedbackVerdict(
            text = stringResource(verdict.label),
            tone = verdict.tone,
            icon = if (verdict == Verdict.Guess) R.drawable.ic_auto_awesome else null,
            end = hyperdriveStreak?.let { stringResource(R.string.player_hyperdrive_streak, count(it)) },
        )

        result.spelling?.let { LabeledAnswer(stringResource(R.string.player_spelled), it) }
        if (result.corrections.isNotEmpty()) Corrections(result.corrections)

        val showsCorrectAnswer =
            result.correctAnswer != null && !result.isCorrect && result.checked && step.isLanguageStep &&
                step.kind !in OPTION_LANGUAGE_KINDS
        if (showsCorrectAnswer) LabeledAnswer(stringResource(R.string.player_correct_answer_label), result.correctAnswer.orEmpty())

        SampleAnswer(result)

        if (keyPoints != null) {
            KeyPoints(keyPoints)
        } else {
            result.feedback?.let { RichText(text = it, style = MaterialTheme.typography.bodyMedium) }
        }

        ResultNote(next)
    }
}

@Composable
private fun LabeledAnswer(
    label: String,
    answer: String,
) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        RichInlineText(
            text = answer,
            style =
                MaterialTheme.typography.bodyMedium.copy(
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                    fontWeight = FontWeight.Medium,
                ),
        )
    }
}

@Composable
private fun SampleAnswer(result: StepResult) {
    val sample = result.correctAnswer
    if (result.checked || sample == null) return

    if (result.answerText == null) {
        RichText(text = sample, style = MaterialTheme.typography.bodyMedium)
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            stringResource(R.string.player_unchecked_compare),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        RichText(text = sample, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
    }
}

@Composable
private fun Corrections(corrections: List<AnswerCorrection>) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        corrections.forEach { correction ->
            CorrectionLine(
                R.drawable.ic_remove,
                stringResource(R.string.player_correction_yours),
                correction.wrong,
                MaterialTheme.colorScheme.error,
            )
            CorrectionLine(
                R.drawable.ic_check,
                stringResource(R.string.player_correction_right),
                correction.right,
                MaterialTheme.colorScheme.onTertiaryContainer,
            )
        }
    }
}

@Composable
private fun CorrectionLine(
    icon: Int,
    label: String,
    text: String,
    color: Color,
) {
    Row(
        modifier = Modifier.clearAndSetSemantics { contentDescription = "$label: $text" },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(painterResource(icon), contentDescription = null, modifier = Modifier.padding(top = 2.dp).size(16.dp), tint = color)
        Text(text, color = color, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun KeyPoints(keyPoints: List<AnswerKeyPoint>) {
    val met = keyPoints.count { it.met }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = pluralStringResource(R.plurals.player_key_points, keyPoints.size, count(met), count(keyPoints.size)),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
        keyPoints.forEach { point ->
            val described =
                stringResource(if (point.met) R.string.player_key_point_stated else R.string.player_key_point_missing, point.text)
            Row(Modifier.clearAndSetSemantics { contentDescription = described }, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(
                    painterResource(if (point.met) R.drawable.ic_check else R.drawable.ic_remove),
                    contentDescription = null,
                    modifier = Modifier.padding(top = 2.dp).size(16.dp),
                    tint = if (point.met) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                RichInlineText(
                    text = point.text,
                    style =
                        MaterialTheme.typography.bodyMedium.copy(
                            color = if (point.met) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                        ),
                )
            }
        }
    }
}

private sealed interface ReviewDay {
    data object Today : ReviewDay

    data object Tomorrow : ReviewDay

    data class Weekday(
        val day: LocalDate,
    ) : ReviewDay

    data class Date(
        val day: LocalDate,
    ) : ReviewDay
}

private const val DAYS_IN_A_WEEK = 7

private fun reviewDay(
    reviewAt: Instant,
    today: LocalDate = LocalDate.now(),
): ReviewDay {
    val day = reviewAt.toJavaInstant().atZone(ZoneId.systemDefault()).toLocalDate()
    val days = ChronoUnit.DAYS.between(today, day)

    return when {
        days <= 0 -> ReviewDay.Today
        days == 1L -> ReviewDay.Tomorrow
        days < DAYS_IN_A_WEEK -> ReviewDay.Weekday(day)
        else -> ReviewDay.Date(day)
    }
}

/** Where the question goes next; nothing when it goes nowhere special. */
@Composable
internal fun ResultNote(next: ResultNext) {
    val review = next.nextReviewAt?.let(::reviewDay)
    val locale = currentLocale()

    val text =
        when {
            next.savedMistake && next.willReturn -> {
                stringResource(R.string.player_saved_to_mistakes_back_at_end)
            }

            next.savedMistake -> {
                when (review) {
                    null -> {
                        stringResource(R.string.player_saved_to_mistakes)
                    }

                    ReviewDay.Today -> {
                        stringResource(R.string.player_saved_to_mistakes_back_today)
                    }

                    ReviewDay.Tomorrow -> {
                        stringResource(R.string.player_saved_to_mistakes_back_tomorrow)
                    }

                    is ReviewDay.Weekday -> {
                        stringResource(
                            R.string.player_saved_to_mistakes_back_weekday,
                            formatDate(review.day, locale, DateStyle.Weekday),
                        )
                    }

                    is ReviewDay.Date -> {
                        stringResource(
                            R.string.player_saved_to_mistakes_back_date,
                            formatDate(review.day, locale, DateStyle.Day),
                        )
                    }
                }
            }

            next.willReturn -> {
                stringResource(R.string.player_comes_back_at_end)
            }

            else -> {
                when (review) {
                    null -> {
                        return
                    }

                    ReviewDay.Today -> {
                        stringResource(R.string.player_comes_back_today)
                    }

                    ReviewDay.Tomorrow -> {
                        stringResource(R.string.player_comes_back_tomorrow)
                    }

                    is ReviewDay.Weekday -> {
                        stringResource(
                            R.string.player_comes_back_weekday,
                            formatDate(review.day, locale, DateStyle.Weekday),
                        )
                    }

                    is ReviewDay.Date -> {
                        stringResource(R.string.player_comes_back_date, formatDate(review.day, locale, DateStyle.Day))
                    }
                }
            }
        }

    FeedbackNote(text)
}

/** True when a screen draws its own result and only needs the notes under it. */
fun showsOwnResult(step: LessonStep): Boolean = step.kind in OWN_RESULT_KINDS

private val OWN_RESULT_KINDS = setOf(StepKind.Activity, StepKind.Challenge, StepKind.MatchColumns)
