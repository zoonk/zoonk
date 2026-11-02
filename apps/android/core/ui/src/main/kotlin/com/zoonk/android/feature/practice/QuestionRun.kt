package com.zoonk.android.feature.practice

import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.AnswerFeedback
import com.zoonk.android.feature.questions.Drill
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.api.models.StudyBlockCompletion

sealed interface RunPhase {
    data object Answering : RunPhase

    data object Checking : RunPhase

    data class Checked(
        val answer: Answer,
        val feedback: AnswerFeedback,
    ) : RunPhase

    data object AnswerFailed : RunPhase

    /** A session's block only: the question was answered elsewhere. */
    data object AlreadyAnswered : RunPhase

    /** A session's block only: finishing can prepare the rest of the day, so it waits for a tap. */
    data object FinishReady : RunPhase

    data object Finishing : RunPhase

    data object FinishFailed : RunPhase

    /** A session's block only; a mistakes practice ends with its own summary. */
    data class Finished(
        val completion: StudyBlockCompletion,
    ) : RunPhase
}

enum class DrillStage { Ideas, Reading, Open }

data class Graded(
    val isCorrect: Boolean,
    val blank: Boolean,
)

/** [answers] are this visit's, by step: a mistakes practice can ask one item under two mistakes. */
data class QuestionRun(
    val index: Int,
    val phase: RunPhase,
    val stage: DrillStage,
    val timedOut: Boolean = false,
    val answers: Map<Int, Graded> = emptyMap(),
) {
    val canAnswer: Boolean get() = phase == RunPhase.Answering || phase == RunPhase.AnswerFailed

    fun checking() = copy(phase = RunPhase.Checking)

    /** [blank] answers are neither right nor wrong: a block's blank statement, a practice's honest "I don't know". */
    fun answered(
        answer: Answer,
        feedback: AnswerFeedback,
        blank: Boolean = feedback.blank,
    ) = copy(
        phase = RunPhase.Checked(answer, feedback),
        answers = answers + (index to Graded(feedback.isCorrect, blank)),
    )

    fun failed(phase: RunPhase) = copy(phase = phase)

    fun timeUp() = copy(timedOut = true)

    /** A content gap's ideas lead to its questions, read first when the drill asks for that. */
    fun start(questions: List<Question>) =
        copy(
            stage =
                if (questions.getOrNull(index)?.drill?.isReadFirst ==
                    true
                ) {
                    DrillStage.Reading
                } else {
                    DrillStage.Open
                },
        )

    fun reveal() = copy(stage = DrillStage.Open)

    fun next(questions: List<Question>): QuestionRun {
        val next = index + 1
        return if (next >= questions.size) {
            copy(index = next, phase = RunPhase.Finishing, timedOut = false)
        } else {
            copy(index = next, phase = RunPhase.Answering, stage = openingStage(questions, next), timedOut = false)
        }
    }

    fun finishing() = copy(phase = RunPhase.Finishing)

    fun finished(completion: StudyBlockCompletion) = copy(phase = RunPhase.Finished(completion))

    companion object {
        /** Resumes at the first unanswered question; a fully answered block waits for Finish. */
        fun begin(questions: List<Question>): QuestionRun {
            val index = questions.indexOfFirst { it.answered == null }.takeIf { it >= 0 } ?: questions.size
            val phase = if (index >= questions.size) RunPhase.FinishReady else RunPhase.Answering
            return QuestionRun(index, phase, openingStage(questions, index))
        }

        private fun openingStage(
            questions: List<Question>,
            index: Int,
        ): DrillStage {
            val drill = questions.getOrNull(index)?.drill ?: return DrillStage.Open
            val first = questions.getOrNull(index - 1)?.mistakeId != questions[index].mistakeId
            return when {
                first && drill.isIdeaFirst -> DrillStage.Ideas
                drill.isReadFirst -> DrillStage.Reading
                else -> DrillStage.Open
            }
        }
    }
}

enum class Segment { Ahead, Current, Right, Wrong, Read }

/** A placement question or a blank statement is read, neither right nor wrong. */
fun segments(
    questions: List<Question>,
    run: QuestionRun,
): List<Segment> =
    questions.mapIndexed { index, question ->
        val graded = run.answers[index] ?: question.answered?.let { Graded(it.isCorrect, it.blank) }
        when {
            graded == null -> if (index == run.index) Segment.Current else Segment.Ahead
            question.placement || graded.blank -> Segment.Read
            graded.isCorrect -> Segment.Right
            else -> Segment.Wrong
        }
    }

data class NetTally(
    val right: Int,
    val wrong: Int,
)

/** This visit's answers, else an earlier visit's, so a blank still counts as neither after a reload. */
fun netTally(
    questions: List<Question>,
    run: QuestionRun,
): NetTally {
    val graded =
        questions.mapIndexedNotNull { index, question ->
            run.answers[index] ?: question.answered?.let { Graded(it.isCorrect, it.blank) }
        }
    val right = graded.count { it.isCorrect }
    val blank = graded.count { !it.isCorrect && it.blank }
    return NetTally(right, graded.size - right - blank)
}

enum class NotSure { Drill, DontKnowYet }

/** A mistakes practice offers "I don't know yet" on [every] question. */
fun notSureOffer(
    question: Question,
    every: Boolean = false,
): NotSure? =
    when {
        question.drill?.kind == Drill.Kind.NoGuessing -> NotSure.Drill
        every || question.placement || question.format == QuestionFormat.Typed -> NotSure.DontKnowYet
        else -> null
    }
