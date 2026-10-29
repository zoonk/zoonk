package com.zoonk.android.feature.practice.block

import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.AnswerFeedback
import com.zoonk.android.feature.questions.Drill
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.api.models.StudyBlockCompletion

/** Where a block's run is (main's `QuestionBlockPhase`). */
sealed interface BlockPhase {
    data object Answering : BlockPhase

    data object Checking : BlockPhase

    data class Checked(
        val answer: Answer,
        val feedback: AnswerFeedback,
    ) : BlockPhase

    data object AnswerFailed : BlockPhase

    data object AlreadyAnswered : BlockPhase

    /** Every question is answered; finishing can prepare the rest of the day, so it waits for a tap. */
    data object FinishReady : BlockPhase

    data object Finishing : BlockPhase

    data object FinishFailed : BlockPhase

    data class Finished(
        val completion: StudyBlockCompletion,
    ) : BlockPhase
}

/** A drill's screen: its lesson's ideas first, the question to read before its answers, or open. */
enum class DrillStage { Ideas, Reading, Open }

data class Graded(
    val isCorrect: Boolean,
    val blank: Boolean,
)

/** One run through a block's questions; [answers] are this visit's, by item. */
data class BlockRun(
    val index: Int,
    val phase: BlockPhase,
    val stage: DrillStage,
    val timedOut: Boolean = false,
    val answers: Map<String, Graded> = emptyMap(),
) {
    val canAnswer: Boolean get() = phase == BlockPhase.Answering || phase == BlockPhase.AnswerFailed

    fun checking() = copy(phase = BlockPhase.Checking)

    fun answered(
        itemId: String,
        answer: Answer,
        feedback: AnswerFeedback,
    ) = copy(
        phase = BlockPhase.Checked(answer, feedback),
        answers = answers + (itemId to Graded(feedback.isCorrect, feedback.blank)),
    )

    fun failed(phase: BlockPhase) = copy(phase = phase)

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

    fun next(questions: List<Question>): BlockRun {
        val next = index + 1
        return if (next >= questions.size) {
            copy(index = next, phase = BlockPhase.Finishing, timedOut = false)
        } else {
            copy(index = next, phase = BlockPhase.Answering, stage = openingStage(questions, next), timedOut = false)
        }
    }

    fun finishing() = copy(phase = BlockPhase.Finishing)

    fun finished(completion: StudyBlockCompletion) = copy(phase = BlockPhase.Finished(completion))

    companion object {
        /** Resumes at the first unanswered question; a fully answered block waits for Finish. */
        fun begin(questions: List<Question>): BlockRun {
            val index = questions.indexOfFirst { it.answered == null }.takeIf { it >= 0 } ?: questions.size
            val phase = if (index >= questions.size) BlockPhase.FinishReady else BlockPhase.Answering
            return BlockRun(index, phase, openingStage(questions, index))
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

/** What each question's segment in the header shows. */
enum class Segment { Ahead, Current, Right, Wrong, Read }

/** A placement question or a blank statement is read, neither right nor wrong. */
fun segments(
    questions: List<Question>,
    run: BlockRun,
): List<Segment> =
    questions.mapIndexed { index, question ->
        val graded = run.answers[question.itemId] ?: question.answered?.let { Graded(it.isCorrect, it.blank) }
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
    run: BlockRun,
): NetTally {
    val graded = questions.mapNotNull { run.answers[it.itemId] ?: it.answered?.let { mark -> Graded(mark.isCorrect, mark.blank) } }
    val right = graded.count { it.isCorrect }
    val blank = graded.count { !it.isCorrect && it.blank }
    return NetTally(right, graded.size - right - blank)
}

/** A drill's "I'm not sure", a placement's or typed question's "I don't know yet", or neither. */
enum class NotSure { Drill, DontKnowYet }

fun notSureOffer(question: Question): NotSure? =
    when {
        question.drill?.kind == Drill.Kind.NoGuessing -> NotSure.Drill
        question.placement || question.format == QuestionFormat.Typed -> NotSure.DontKnowYet
        else -> null
    }
