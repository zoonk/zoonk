package com.zoonk.android.feature.mock.runner

import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockExamSectionsInnerNavigation

/** Main's `getSectionMoves`: where the learner may go in a section and what may still change. */
data class SectionMoves(
    val forwardOnly: Boolean,
    val mustAnswer: Boolean,
    /** A forward-only section's end review, once its last question was reached. */
    val reviewing: Boolean,
    /** Null outside a review or without a limit. */
    val changesLeft: Int?,
    /** Null in a review: its time per question has passed. */
    val itemSeconds: Int?,
    val canAdvance: Boolean,
    private val position: Int,
    private val reached: Int,
    private val total: Int,
    private val changed: Set<Int>,
) {
    private fun canReach(target: Int) = target in 0 until total && (!forwardOnly || reviewing || target == reached || target == reached + 1)

    fun canOpen(target: Int): Boolean = canReach(target) && (target == position || canAdvance)

    fun canOpenAfterTimeout(target: Int): Boolean = target == position + 1 && canReach(target)

    fun canChange(target: Int): Boolean = !forwardOnly || target >= reached || target in changed || (changesLeft ?: 0) > 0

    companion object {
        fun of(
            navigation: MockExamSectionsInnerNavigation?,
            answered: Boolean,
            position: Int,
            reached: Int,
            total: Int,
            changed: Set<Int>,
            changesLeft: Int?,
        ): SectionMoves {
            val forwardOnly = navigation?.forwardOnly ?: false
            val reviewing = forwardOnly && navigation.answerChanges != null && reached >= total - 1
            return SectionMoves(
                forwardOnly = forwardOnly,
                mustAnswer = navigation?.mustAnswer ?: false,
                reviewing = reviewing,
                changesLeft = if (reviewing) changesLeft else null,
                itemSeconds = if (reviewing) null else navigation?.itemSeconds?.toInt(),
                canAdvance = navigation?.mustAnswer != true || answered || (reviewing && position < reached),
                position = position,
                reached = reached,
                total = total,
                changed = changed,
            )
        }
    }
}

/** Core's `isMockAnswerPresent`: blank is no answer, an empty pick list or blank text. */
val MockDraft?.isAnswered: Boolean
    get() =
        when (val answer = this?.answer) {
            null -> false
            is Answer.Choices -> answer.indexes.isNotEmpty()
            is Answer.Text -> answer.text.isNotBlank()
            else -> true
        }

/**
 * The answers a question's options give, in order, or null when it isn't answered by picking. A
 * statement's "Leave blank" gives none; it's offered only where a wrong answer cancels a right one
 * (Cebraspe), and never in a section that asks for an answer before moving on.
 */
fun MockRun.optionAnswers(question: MockQuestion): List<Answer?>? {
    val kit = question.question
    return when {
        question.essay || kit.format == QuestionFormat.Numeric || kit.format == QuestionFormat.Typed -> {
            null
        }

        kit.format == QuestionFormat.TrueFalse -> {
            val statements = listOf(Answer.TrueFalse(true), Answer.TrueFalse(false))
            if (view.scoring == MockExam.Scoring.NET && !moves.mustAnswer) statements + null else statements
        }

        else -> {
            kit.options
                .orEmpty()
                .indices
                .map(Answer::Choice)
        }
    }
}

/** "12 of 45" among a section's counted questions; null for an essay, which isn't counted. */
data class SectionPlace(
    val number: Int,
    val total: Int,
)

fun sectionPlace(
    position: Int,
    questions: List<MockQuestion>,
): SectionPlace? {
    val question = questions.getOrNull(position) ?: return null
    if (question.essay) return null
    return SectionPlace(
        number = questions.take(position + 1).count { !it.essay },
        total = questions.count { !it.essay },
    )
}

/** Main's `useSectionCounts`. */
data class SectionCounts(
    val answered: Int,
    val blank: Int,
    val blankEssays: Int,
    val essays: Int,
    val flagged: Int,
    val total: Int,
)

fun sectionCounts(
    questions: List<MockQuestion>,
    drafts: Map<String, MockDraft>,
): SectionCounts {
    val blank = questions.filter { !drafts[it.itemId].isAnswered }
    return SectionCounts(
        answered = questions.size - blank.size,
        blank = blank.count { !it.essay },
        blankEssays = blank.count { it.essay },
        essays = questions.count { it.essay },
        flagged = questions.count { drafts[it.itemId]?.flagged == true },
        total = questions.size,
    )
}

/** A question's own clock ran out on another visit: its saved time already reached its seconds. */
fun isSavedQuestionExpired(
    draft: MockDraft?,
    seconds: Int?,
): Boolean = seconds != null && (draft?.durationMs ?: 0) >= seconds * MS_PER_SECOND

private const val MS_PER_SECOND = 1000L
