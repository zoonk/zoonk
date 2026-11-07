package com.zoonk.android.feature.practice

import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Question

/** What an answer sent, so Try again sends the same (a timed drill's "not sure" included). */
internal data class Submission(
    val question: Question,
    val answer: Answer,
    val sender: AnswerSender,
    val durationMs: Long,
) {
    companion object {
        /**
         * An answer sent again unchanged after it failed to save keeps the time it first took: a
         * timed drill grades that time, and the wait on the failure isn't the learner's. [unsaved] is
         * the last answer sent that didn't save.
         */
        fun of(
            question: Question,
            answer: Answer,
            sender: AnswerSender,
            measuredMs: Long,
            unsaved: Submission?,
        ): Submission {
            val resent = unsaved?.takeIf { it.question == question && it.answer == answer }
            return Submission(question, answer, sender, resent?.durationMs ?: measuredMs)
        }
    }
}
