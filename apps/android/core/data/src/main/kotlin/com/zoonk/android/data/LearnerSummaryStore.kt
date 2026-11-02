package com.zoonk.android.data

import com.zoonk.api.models.LearnerSummary
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.minutes

fun interface LearnerSummaryApi {
    suspend fun summary(session: AuthenticatedSession): LearnerSummary
}

/** Every domain, because any write can change the summary; screens read frame state from it, never per screen. */
class LearnerSummaryStore(
    api: LearnerSummaryApi,
    cache: AppCache,
    scope: CoroutineScope,
    now: () -> Long = System::currentTimeMillis,
) {
    val summary: Resource<LearnerSummary> =
        cache.resource(Audience.SignedIn, DataDomain.entries.toSet(), maxAge = 1.minutes) { session ->
            session?.let { api.summary(it) }
        }

    init {
        scope.invalidateAtNextChange(summary, summary, now)
    }
}

/**
 * Reads [resource] again when [summary] says things change without a write (`nextChangeAt`): the
 * next midnight, the subscription's next change.
 */
fun CoroutineScope.invalidateAtNextChange(
    summary: Resource<LearnerSummary>,
    resource: Resource<*>,
    now: () -> Long = System::currentTimeMillis,
) = launch {
    summary.state
        .map { it.value?.nextChangeAt }
        .distinctUntilChanged()
        .collectLatest { nextChangeAt ->
            nextChangeAt ?: return@collectLatest
            delay((nextChangeAt - now()).coerceAtLeast(0).milliseconds)
            resource.invalidate()
        }
}
