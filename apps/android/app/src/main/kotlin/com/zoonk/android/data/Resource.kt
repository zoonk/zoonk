package com.zoonk.android.data

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.launch
import kotlin.coroutines.cancellation.CancellationException
import kotlin.time.Duration
import kotlin.time.TimeMark
import kotlin.time.TimeSource

/**
 * One piece of server data, kept for the app's lifetime and created only by [AppCache]. Screens
 * collect [shown] (through [collectShown]); collecting is viewing, so a screen loads it when it's
 * empty or stale on appear and on the app's return to the foreground. Every method runs on the
 * main thread; fetches run in the app scope, so leaving a screen doesn't cancel them.
 */
class Resource<T : Any> internal constructor(
    val audience: Audience,
    val domains: Set<DataDomain>,
    private val maxAge: Duration,
    private val session: SessionSource,
    private val scope: CoroutineScope,
    private val timeSource: TimeSource,
    private val isEmpty: (T) -> Boolean,
    private val fetch: suspend (AuthenticatedSession?) -> T?,
) {
    private val stored = MutableStateFlow<LoadState<T>>(LoadState.Idle)
    private val refreshing = MutableStateFlow(false)
    private var owner: AuthenticatedSession? = if (audience == Audience.Everyone) null else session.current
    private var loadedAt: TimeMark? = null
    private var isInvalidated = false
    private var request: Deferred<Unit>? = null
    private var viewers = 0

    val state: StateFlow<LoadState<T>> = stored.asStateFlow()
    val isRefreshing: StateFlow<Boolean> = refreshing.asStateFlow()

    /** What a screen collects: each new collection (the screen shown, the app back in front) loads it. */
    val shown: Flow<LoadState<T>> =
        flow {
            viewers++
            try {
                scope.launch { load() }
                emitAll(stored)
            } finally {
                viewers--
            }
        }

    /** Bumps whenever the value is replaced or dropped, so a page appended with [update] can check it. */
    var revision = 0
        private set

    /** Loads when nothing is cached or it's stale. */
    suspend fun load() {
        followSession()
        if (!canRequest || (stored.value.hasContent && !isStale)) return
        run()
    }

    /** Loads now, keeping what's shown (pull to refresh, retry). */
    suspend fun refresh() {
        followSession()
        if (!canRequest) return
        run()
    }

    /** Loads only when nothing is cached: a screen opened beneath a task gets ready while hidden. */
    suspend fun prepare() {
        followSession()
        if (!canRequest || stored.value.hasContent) return
        run()
    }

    /** Marks it stale: refetched now if a screen shows it, otherwise on its next [load]. */
    fun invalidate() {
        isInvalidated = true
        if (request == null && stored.value == LoadState.Idle) return
        cancelRequest()
        if (isShown && canRequest) scope.launch { run() }
    }

    /** Derives a new value from what's shown (appending the next page). It doesn't count as fresh. */
    fun update(transform: (T) -> T) {
        val current = stored.value as? LoadState.Loaded ?: return
        stored.value = shownState(transform(current.value))
        revision++
    }

    /**
     * Shows [value] as the whole, current value: a mutation's response that carries the full new
     * value. It cancels an older read so that read can't land afterwards, and counts as fresh.
     */
    fun replace(value: T) {
        followSession()
        cancelRequest()
        stored.value = shownState(value)
        loadedAt = timeSource.markNow()
        isInvalidated = false
        revision++
    }

    /** [replace], applied by [AppCache.mutate] after the write instead of refetching this resource. */
    fun replacing(value: T) = Replacement(this) { replace(value) }

    /** Drops another session's data, and loads the new session's at once if a screen shows it. */
    fun followSession() {
        if (audience == Audience.Everyone || owner == session.current) return
        cancelRequest()
        owner = session.current
        stored.value = LoadState.Idle
        loadedAt = null
        isInvalidated = false
        revision++
        // A screen still collecting doesn't resubscribe, so it loads the new session's value here.
        if (isShown && canRequest) scope.launch { run() }
    }

    internal val isShown get() = viewers > 0
    private val canRequest get() = audience != Audience.SignedIn || owner != null
    private val isStale get() = isInvalidated || loadedAt?.let { it.elapsedNow() > maxAge } ?: true

    private fun shownState(value: T?): LoadState<T> = value?.takeUnless(isEmpty)?.let { LoadState.Loaded(it) } ?: LoadState.Empty

    private suspend fun run() {
        val pending = request ?: start()
        try {
            pending.await()
        } catch (e: CancellationException) {
            // The request was replaced (an invalidation or a session change); only this caller's
            // own cancellation propagates.
            currentCoroutineContext().ensureActive()
        }
    }

    private fun start(): Deferred<Unit> {
        val owner = owner
        if (stored.value.hasContent) refreshing.value = true else stored.value = LoadState.Loading
        lateinit var deferred: Deferred<Unit>
        deferred =
            scope.async {
                val result =
                    try {
                        Result.success(fetch(owner))
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        Result.failure(e)
                    }
                finish(deferred, owner, result)
            }
        request = deferred
        return deferred
    }

    private suspend fun finish(
        deferred: Deferred<Unit>,
        owner: AuthenticatedSession?,
        result: Result<T?>,
    ) {
        if (request !== deferred) return
        request = null
        refreshing.value = false
        if (audience != Audience.Everyone && owner != session.current) {
            followSession()
            return
        }
        result.fold(
            onSuccess = { value ->
                stored.value = shownState(value)
                loadedAt = timeSource.markNow()
                isInvalidated = false
                revision++
            },
            onFailure = { fail(it.toApiError(), owner) },
        )
    }

    private suspend fun fail(
        error: ApiError,
        owner: AuthenticatedSession?,
    ) {
        when (error) {
            ApiError.Unauthorized -> {
                stored.value = LoadState.Idle
                revision++
                owner?.let { session.expire(it) }
            }

            ApiError.NotFound -> {
                stored.value = LoadState.Failed(error)
                revision++
            }

            ApiError.Network, ApiError.Unavailable -> {
                if (!stored.value.hasContent) stored.value = LoadState.Failed(error)
            }
        }
    }

    private fun cancelRequest() {
        request?.cancel()
        request = null
        refreshing.value = false
        if (stored.value == LoadState.Loading) stored.value = LoadState.Idle
    }
}

/**
 * Collects a resource the way every screen should: it loads on appear and on the app's return to
 * the foreground, and stops counting as shown when the screen leaves.
 */
@Suppress("StateFlowValueCalledInComposition") // Only the first frame's state, as for a StateFlow.
@Composable
fun <T : Any> Resource<T>.collectShown(): State<LoadState<T>> = shown.collectAsStateWithLifecycle(state.value)

/** A resource's new value, applied by [AppCache.mutate] after a successful write. */
class Replacement internal constructor(
    val resource: Resource<*>,
    internal val apply: () -> Unit,
)
