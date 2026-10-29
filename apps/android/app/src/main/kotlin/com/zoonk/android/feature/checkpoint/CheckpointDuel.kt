package com.zoonk.android.feature.checkpoint

import com.zoonk.android.data.recode
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.TranscriptLine
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.api.models.Checkpoint
import com.zoonk.api.models.CheckpointQuestionsInner
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.TrueFalseLabels

/** A checkpoint with its questions as the kit's. */
data class CheckpointRead(
    val checkpoint: Checkpoint,
    val questions: List<Question>,
) {
    val words: TrueFalseWords get() = checkpoint.trueFalseLabels.recode<TrueFalseLabels, TrueFalseWords>()
    val isBoss: Boolean get() = checkpoint.kind != Checkpoint.Kind.WEEKLY
    val passMark: Int get() = checkpoint.passMark.toInt()
}

fun Checkpoint.read() = CheckpointRead(this, questions.map { it.recode<CheckpointQuestionsInner, Question>() })

enum class DuelDecision { Won, Lost }

/** A boss's duel is over once it's won or can't be won anymore; a weekly challenge asks every question. */
fun duelDecision(
    kind: Checkpoint.Kind,
    passMark: Int,
    answered: Int,
    correct: Int,
    questions: Int,
): DuelDecision? {
    if (kind == Checkpoint.Kind.WEEKLY || passMark <= 0) return null
    if (correct >= passMark) return DuelDecision.Won
    val missed = answered - correct
    return if (missed > 0 && questions - missed < passMark) DuelDecision.Lost else null
}

data class DuelFeedback(
    val itemId: String,
    val answer: Answer,
    val isCorrect: Boolean,
)

enum class DuelError { Answer, Finish }

/**
 * Right or wrong after each answer, and why only at the end. [verdicts] keep answers to questions
 * since removed from the bank; [given] are this visit's, for the review.
 */
data class DuelState(
    val verdicts: Map<String, Boolean>,
    val reinforcementLessons: Int,
    val showsResult: Boolean,
    val feedback: DuelFeedback? = null,
    val pending: Boolean = false,
    val error: DuelError? = null,
    val completion: StudyBlockCompletion? = null,
    val given: Map<String, Answer> = emptyMap(),
    val transcripts: Map<String, List<TranscriptLine>> = emptyMap(),
) {
    fun answered(
        itemId: String,
        answer: Answer,
        isCorrect: Boolean,
        reinforcementLessons: Int?,
        transcript: Pair<String, List<TranscriptLine>>?,
    ) = copy(
        feedback = DuelFeedback(itemId, answer, isCorrect),
        pending = false,
        error = null,
        verdicts = verdicts + (itemId to isCorrect),
        given = given + (itemId to answer),
        reinforcementLessons = reinforcementLessons ?: this.reinforcementLessons,
        transcripts = transcript?.let { transcripts + it } ?: transcripts,
    )

    fun finished(completion: StudyBlockCompletion) = copy(completion = completion, feedback = null, pending = false, showsResult = true)

    companion object {
        fun of(checkpoint: Checkpoint) =
            DuelState(
                verdicts =
                    checkpoint.answeredQuestions.orEmpty().associate { it.itemId.toString() to it.isCorrect } +
                        checkpoint.questions.mapNotNull { question ->
                            question.answered?.let { question.itemId.toString() to it.isCorrect }
                        },
                reinforcementLessons = checkpoint.reinforcementLessons.toInt(),
                showsResult = checkpoint.status == Checkpoint.Status.COMPLETED || checkpoint.endedWithoutQuestions == true,
            )
    }
}

data class DuelScore(
    val answered: Int,
    val correct: Int,
    val questions: Int,
    val decision: DuelDecision?,
) {
    val done: Boolean get() = decision != null || answered == questions
}

fun DuelState.score(read: CheckpointRead): DuelScore {
    val questions = (read.questions.map { it.itemId } + verdicts.keys).toSet().size
    val correct = verdicts.values.count { it }
    return DuelScore(
        verdicts.size,
        correct,
        questions,
        duelDecision(read.checkpoint.kind, read.passMark, verdicts.size, correct, questions),
    )
}

/** The question in feedback, else the next unanswered one until the duel is decided. */
fun DuelState.current(read: CheckpointRead): Question? {
    read.questions.firstOrNull { it.itemId == feedback?.itemId }?.let { return it }
    if (score(read).decision != null) return null
    return read.questions.firstOrNull { it.itemId !in verdicts }
}
