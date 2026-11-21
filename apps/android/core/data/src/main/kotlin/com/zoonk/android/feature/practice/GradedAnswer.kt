package com.zoonk.android.feature.practice

import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.tap
import com.zoonk.api.models.ChapterTestOutInputAnswersInner
import kotlinx.serialization.Serializable
import java.util.UUID

/** One answer of a run graded only at its end, in the API's shape. */
@Serializable
data class GradedAnswer(
    val itemId: String,
    val answer: Answer,
    val durationMs: Long,
)

/** A chapter test-out asks by taps alone, so its answers are always taps. */
fun GradedAnswer.input() = ChapterTestOutInputAnswersInner(checkNotNull(answer.tap()), durationMs, UUID.fromString(itemId))

/** A run's answers so far and the id they're sent with, kept until graded so a send that never answered counts once. */
@Serializable
data class AnswersDraft(
    val requestId: String,
    val answers: List<GradedAnswer> = emptyList(),
)
