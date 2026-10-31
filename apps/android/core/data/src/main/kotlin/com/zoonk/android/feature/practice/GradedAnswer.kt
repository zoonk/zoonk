package com.zoonk.android.feature.practice

import com.zoonk.android.data.recode
import com.zoonk.android.feature.questions.Answer
import com.zoonk.api.models.ItemAnswerInput
import kotlinx.serialization.Serializable
import java.util.UUID

/** One answer of a run graded only at its end, in the API's shape. */
@Serializable
data class GradedAnswer(
    val itemId: String,
    val answer: Answer,
    val durationMs: Long,
)

fun GradedAnswer.input() = ItemAnswerInput(answer.recode(), durationMs, UUID.fromString(itemId))

/** A run's answers so far and the id they're sent with, kept until graded so a send that never answered counts once. */
@Serializable
data class AnswersDraft(
    val requestId: String,
    val answers: List<GradedAnswer> = emptyList(),
)
