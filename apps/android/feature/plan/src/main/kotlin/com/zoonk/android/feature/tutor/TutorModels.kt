package com.zoonk.android.feature.tutor

import androidx.compose.runtime.Immutable
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.memory.MemoryChangeShown
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.StudyMissionMoment
import com.zoonk.api.models.TutorToolOffer
import kotlinx.serialization.Contextual
import kotlinx.serialization.Serializable
import java.util.UUID
import kotlin.time.Instant

internal val TutorMemoryChange.shown: MemoryChangeShown
    get() = MemoryChangeShown(fact?.id, fact?.statement, previous?.id, previous?.statement)

@Immutable
sealed interface TutorFailure {
    /** A help limit takes the composer's place; a slow-down only asks to wait. */
    data class Refused(
        val limit: Limit,
    ) : TutorFailure

    data object PlusRequired : TutorFailure

    data object Gone : TutorFailure

    data object Invalid : TutorFailure

    data object SignedOut : TutorFailure

    data object Failed : TutorFailure
}

internal val TutorFailure.helpLimit: Limit?
    get() = (this as? TutorFailure.Refused)?.limit?.takeUnless { it is Limit.SlowDown }

internal fun ApiException.toTutorFailure(): TutorFailure = failure(Limit.of(this), error, status)

internal fun MutationResult.Failed.toTutorFailure(): TutorFailure = failure(Limit.of(this), error, status)

private fun failure(
    limit: Limit?,
    error: ApiError,
    status: Int?,
): TutorFailure =
    when {
        limit != null -> TutorFailure.Refused(limit)
        status == PAYMENT_REQUIRED -> TutorFailure.PlusRequired
        error == ApiError.Unauthorized -> TutorFailure.SignedOut
        error == ApiError.NotFound -> TutorFailure.Gone
        status == BAD_REQUEST || status == UNPROCESSABLE -> TutorFailure.Invalid
        else -> TutorFailure.Failed
    }

internal const val CONFLICT = 409
private const val BAD_REQUEST = 400
private const val PAYMENT_REQUIRED = 402
private const val UNPROCESSABLE = 422
