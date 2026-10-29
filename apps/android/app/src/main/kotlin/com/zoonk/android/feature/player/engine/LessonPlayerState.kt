package com.zoonk.android.feature.player.engine

import androidx.compose.runtime.Immutable
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.api.models.LibraryLessonCompletion
import kotlin.time.Instant

enum class LessonPhase { Playing, Checking, Feedback, Completed }

enum class LessonNotice { AnswerNotSaved, PictureReady, SelfCorrect, WritingSkipped }

enum class LessonSupport { ExplanationFirst, QuestionFirst }

enum class RefusalTier { Free, Guest, Plus }

enum class RefusalPeriod { Day, Month, Total }

/** Why the run, or a piece of AI help, was refused. None is a dead end: each screen offers a way on. */
@Immutable
sealed interface LessonRefusal {
    data object Failed : LessonRefusal

    data class LimitReached(
        val tier: RefusalTier,
        val period: RefusalPeriod,
    ) : LessonRefusal

    data object NotFound : LessonRefusal

    data object PlusRequired : LessonRefusal

    data class SlowDown(
        val retryAfterSeconds: Long,
    ) : LessonRefusal

    data object SignUpRequired : LessonRefusal
}

/** A typed or spoken answer the server couldn't grade for a reason the learner should see. */
@Immutable
sealed interface CheckIssue {
    data class Refused(
        val refusal: LessonRefusal,
    ) : CheckIssue

    data object NoSpeech : CheckIssue
}

@Immutable
data class RunAnswer(
    val stepId: String,
    val isCorrect: Boolean,
    val answeredAt: Instant,
)

/** Where Hyperdrive stood when the run started: right answers on [knownStepIds] don't build it. */
@Immutable
data class HyperdriveStart(
    val knownStepIds: Set<String>,
    val streak: Int,
)

@Immutable
sealed interface LessonRun {
    data object Idle : LessonRun

    data object Starting : LessonRun

    /** [carriedStepIds] were answered in an earlier sitting, so they don't replay Hyperdrive. */
    data class Started(
        val runId: String,
        val hyperdrive: HyperdriveStart,
        val carriedStepIds: Set<String>,
    ) : LessonRun

    data class Refused(
        val refusal: LessonRefusal,
    ) : LessonRun
}

enum class CompletionStatus { Ready, Saving, Saved, Failed }

/** [testedOut] when "I already know this" passed every check and skipped the rest. */
@Immutable
data class LessonCompletion(
    val status: CompletionStatus,
    val result: LibraryLessonCompletion? = null,
    val testedOut: Boolean = false,
)

@Immutable
data class QuickCheck(
    val missed: Boolean,
    val returnPosition: Int,
    val returnQueue: List<String>,
)

@Immutable
data class Miss(
    val stepId: String,
    val skillId: String?,
)

@Immutable
data class WritingRestore(
    val position: Int,
    val queue: List<String>,
    val skippedWritingStepIds: List<String>,
)

/**
 * One lesson's play, as main's reducer keeps it: [queue] is the order of screens (a missed check
 * comes back at its end), [position] the one in view. Times are epoch milliseconds.
 */
@Immutable
data class LessonPlayerState(
    val lessonId: String,
    val steps: Map<String, LessonStep>,
    val queue: List<String>,
    val position: Int = 0,
    val phase: LessonPhase = LessonPhase.Playing,
    val answers: Map<String, LessonAnswer> = emptyMap(),
    val results: Map<String, StepResult> = emptyMap(),
    val firstVerdicts: Map<String, Boolean> = emptyMap(),
    val checkFailed: Boolean = false,
    val checkIssue: CheckIssue? = null,
    val completion: LessonCompletion? = null,
    val helped: List<String> = emptyList(),
    val misses: List<Miss> = emptyList(),
    val notice: LessonNotice? = null,
    val quickCheck: QuickCheck? = null,
    val retried: List<String> = emptyList(),
    val revealed: Map<String, Int> = emptyMap(),
    val run: LessonRun = LessonRun.Idle,
    val reviewing: Boolean = false,
    val selfCorrected: List<String> = emptyList(),
    val skippedWritingStepIds: List<String> = emptyList(),
    val stepStartedAt: Long = 0,
    val support: LessonSupport? = null,
    val unavailableStepIds: List<String> = emptyList(),
    val writingRestore: WritingRestore? = null,
) {
    val currentStep: LessonStep? get() = queue.getOrNull(position)?.let(steps::get)

    companion object {
        fun initial(
            lessonId: String,
            steps: List<LessonStep>,
            support: LessonSupport? = null,
            now: Long,
        ): LessonPlayerState {
            val byId = steps.associateBy(LessonStep::id)
            val queue = steps.map(LessonStep::id)
            val isEmpty = queue.isEmpty()

            return LessonPlayerState(
                lessonId = lessonId,
                steps = byId,
                queue = orderLessonOpening(queue, byId, support),
                phase = if (isEmpty) LessonPhase.Completed else LessonPhase.Playing,
                completion = if (isEmpty) LessonCompletion(CompletionStatus.Ready) else null,
                stepStartedAt = now,
                support = support,
            )
        }
    }
}
