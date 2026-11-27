package com.zoonk.android.data

import com.zoonk.api.models.LessonReadiness
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull

const val LESSON_CHECK_MILLIS = 5_000L

/**
 * Follows a lesson's writing as its readiness says, as main's `useLessonReadiness` does: it asks now,
 * every [LESSON_CHECK_MILLIS] and as soon as the followed run stops, and [follower] follows whichever
 * run an answer names. A run whose updates stop, and a read the server couldn't answer, decide
 * nothing: they only ask again.
 */
class LessonReadinessFollower(
    private val follower: GenerationFollower,
) {
    /** Asks until [onAnswer] returns false or the session that asked isn't current anymore. */
    suspend fun follow(
        read: suspend () -> MutationResult<LessonReadiness>,
        onAnswer: suspend (LessonReadiness) -> Boolean,
    ) {
        try {
            while (true) {
                // Taken before the read, since following its run can fail at once.
                val seen = follower.run.value
                when (val result = read()) {
                    MutationResult.Obsolete -> {
                        return
                    }

                    is MutationResult.Failed -> {}

                    is MutationResult.Done -> {
                        val answer = result.value
                        if (answer.status == LessonReadiness.Status.GENERATING) followRun(answer.generationId)
                        if (!onAnswer(answer)) return
                    }
                }
                withTimeoutOrNull(LESSON_CHECK_MILLIS) { follower.run.first { it != seen && it.status == GenerationRun.Status.Failed } }
            }
        } finally {
            follower.stop()
        }
    }

    /** Follows [generationId] unless it's the run already followed and still going. */
    fun followRun(generationId: String?) {
        if (generationId == null || follower.isFollowing(generationId)) return
        follower.follow(generationId)
    }
}
