package com.zoonk.android.feature.tutor

import androidx.compose.runtime.Immutable
import com.zoonk.api.models.LessonStepAnswer

/** What the learner asks about: the next question is about it, in its conversation ([thread]). */
@Immutable
sealed interface TutorScope {
    data class Plan(
        val goalId: String,
    ) : TutorScope

    data class Subject(
        val goalId: String,
        val subjectKey: String,
    ) : TutorScope

    data class Chapter(
        val chapterId: String,
    ) : TutorScope

    data class Mock(
        val blockId: String,
    ) : TutorScope

    /** [stepIds] are the screens the learner was shown, so the answer stays within them. */
    data class Lesson(
        val lessonId: String,
        val stepIds: List<String> = emptyList(),
    ) : TutorScope

    /** [stepNumber] counts from 1, as the learner sees it. */
    data class Step(
        val lessonId: String,
        val stepId: String,
        val stepNumber: Int,
    ) : TutorScope

    /** The learner's checked answer on a step; it shares the step's conversation. */
    data class Answer(
        val lessonId: String,
        val stepId: String,
        val stepNumber: Int,
        val answer: LessonStepAnswer,
    ) : TutorScope

    /**
     * A session's or practice's question: whether it was checked, and the session block it's asked
     * in (none in mistakes practice). Checking it doesn't start another conversation.
     */
    data class Item(
        val itemId: String,
        val blockId: String?,
        val answered: Boolean,
    ) : TutorScope
}

internal val TutorScope.goalId: String?
    get() =
        when (this) {
            is TutorScope.Plan -> goalId
            is TutorScope.Subject -> goalId
            else -> null
        }

/** One conversation per learner and thread: a lesson keeps one for itself and one per screen. */
internal sealed interface TutorThreadKey {
    data class Plan(
        val goalId: String,
    ) : TutorThreadKey

    data class Subject(
        val goalId: String,
        val subjectKey: String,
    ) : TutorThreadKey

    data class Chapter(
        val chapterId: String,
    ) : TutorThreadKey

    data class Mock(
        val blockId: String,
    ) : TutorThreadKey

    data class Lesson(
        val lessonId: String,
    ) : TutorThreadKey

    data class Step(
        val lessonId: String,
        val stepId: String,
    ) : TutorThreadKey

    data class Item(
        val itemId: String,
    ) : TutorThreadKey
}

internal val TutorScope.thread: TutorThreadKey
    get() =
        when (this) {
            is TutorScope.Plan -> TutorThreadKey.Plan(goalId)
            is TutorScope.Subject -> TutorThreadKey.Subject(goalId, subjectKey)
            is TutorScope.Chapter -> TutorThreadKey.Chapter(chapterId)
            is TutorScope.Mock -> TutorThreadKey.Mock(blockId)
            is TutorScope.Lesson -> TutorThreadKey.Lesson(lessonId)
            is TutorScope.Step -> TutorThreadKey.Step(lessonId, stepId)
            is TutorScope.Answer -> TutorThreadKey.Step(lessonId, stepId)
            is TutorScope.Item -> TutorThreadKey.Item(itemId)
        }
