package com.zoonk.android.data

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
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
 * Call it on the main thread. Fetches run in the app scope, so leaving a screen doesn't cancel
 * them. A screen collects [shown] through [collectShown]; collecting counts as viewing.
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

    /** Each collection loads it when it's empty or stale; collectors other than this one don't count as viewing. */
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

    /** Bumps whenever the value changes, so an appended page can check nothing replaced it meanwhile. */
    var revision = 0
        private set

    suspend fun load() {
        followSession()
        if (!canRequest || (stored.value.hasContent && !isStale)) return
        run()
    }

    /** Loads even when fresh, keeping what's shown. */
    suspend fun refresh() {
        followSession()
        if (!canRequest) return
        run()
    }

    /** Loads only when nothing is cached, ignoring staleness: for a screen a task opens over. */
    suspend fun prepare() {
        followSession()
        if (!canRequest || stored.value.hasContent) return
        run()
    }

    /**
     * Marks it stale: refetched now if a screen shows it, otherwise on its next [load]. A write can
     * bring back what wasn't found (a moved challenge's Undo), so a not-found is dropped.
     */
    fun invalidate() {
        isInvalidated = true
        if (request == null && stored.value == LoadState.Idle) return
        cancelRequest()
        if (stored.value == LoadState.Failed(ApiError.NotFound)) {
            stored.value = LoadState.Idle
            revision++
        }
        if (isShown && canRequest) scope.launch { run() }
    }

    /** Doesn't count as fresh, unlike [replace]. */
    fun update(transform: (T) -> T) {
        val current = stored.value as? LoadState.Loaded ?: return
        stored.value = shownState(transform(current.value))
        revision++
    }

    /** For a response carrying the whole new value: it counts as fresh and an older read in flight can't land. */
    fun replace(value: T) {
        followSession()
        cancelRequest()
        stored.value = shownState(value)
        loadedAt = timeSource.markNow()
        isInvalidated = false
        revision++
    }

    fun replacing(value: T) = Replacement(this) { replace(value) }

    fun followSession() {
        if (audience == Audience.Everyone || owner == session.current) return
        cancelRequest()
        owner = session.current
        stored.value = LoadState.Idle
        loadedAt = null
        isInvalidated = false
        revision++
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
            // Only this caller's own cancellation propagates, not the replaced request's.
            currentCoroutineContext().ensureActive()
        }
    }

    private fun start(): Deferred<Unit> {
        val owner = owner
        if (stored.value.hasContent) refreshing.value = true else stored.value = LoadState.Loading
        lateinit var deferred: Deferred<Unit>
        // Lazy, so a fetch that answers without suspending finds itself as the request.
        deferred =
            scope.async(start = CoroutineStart.LAZY) {
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
        deferred.start()
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

@Suppress("StateFlowValueCalledInComposition") // Only the first frame's state, as for a StateFlow.
@Composable
fun <T : Any> Resource<T>.collectShown(): State<LoadState<T>> = shown.collectAsStateWithLifecycle(state.value)

class Replacement internal constructor(
    val resource: Resource<*>,
    internal val apply: () -> Unit,
)
