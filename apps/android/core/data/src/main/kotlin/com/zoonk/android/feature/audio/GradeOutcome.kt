package com.zoonk.android.feature.audio

import com.zoonk.android.data.MutationResult
import com.zoonk.android.ui.components.Limit

sealed interface GradeOutcome<out T> {
    data class Graded<T>(
        val value: T,
    ) : GradeOutcome<T>

    data object NoSpeech : GradeOutcome<Nothing>

    data class Limited(
        val limit: Limit,
    ) : GradeOutcome<Nothing>

    data object Failed : GradeOutcome<Nothing>

    data object Obsolete : GradeOutcome<Nothing>
}

/** Turns a grading write's result into what the recorder says. */
fun <T> MutationResult<T>.toGradeOutcome(): GradeOutcome<T> =
    when (this) {
        is MutationResult.Done -> {
            GradeOutcome.Graded(value)
        }

        is MutationResult.Failed -> {
            val limit = Limit.of(this)
            when {
                code == NO_SPEECH -> GradeOutcome.NoSpeech
                limit != null -> GradeOutcome.Limited(limit)
                else -> GradeOutcome.Failed
            }
        }

        MutationResult.Obsolete -> {
            GradeOutcome.Obsolete
        }
    }

private const val NO_SPEECH = "NO_SPEECH"
