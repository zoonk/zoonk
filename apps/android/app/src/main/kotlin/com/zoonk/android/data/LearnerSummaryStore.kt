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

/** Reads the signed-in learner's summary (`getCurrentUserSummary`). */
fun interface LearnerSummaryApi {
    suspend fun summary(session: AuthenticatedSession): LearnerSummary
}

/**
 * The learner summary every part of the frame reads (goals, tier, day, today, level, places,
 * missions), kept fresh for the app's lifetime: the shell collects it, so it loads on launch and
 * sign-in, revalidates on returning to the foreground after a minute and after any mutation (every
 * write can change it), and is marked stale at its `nextChangeAt`. Screens read frame state from
 * it, never per screen.
 */
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
        // When the summary says it changes without a write (the next midnight, the subscription's
        // next change, the session's end). A newer summary reschedules it.
        scope.launch {
            summary.state
                .map { it.value?.nextChangeAt }
                .distinctUntilChanged()
                .collectLatest { nextChangeAt ->
                    nextChangeAt ?: return@collectLatest
                    delay((nextChangeAt - now()).coerceAtLeast(0).milliseconds)
                    summary.invalidate()
                }
        }
    }
}
