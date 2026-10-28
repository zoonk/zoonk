package com.zoonk.android.data

import kotlinx.coroutines.CoroutineScope
import java.lang.ref.WeakReference
import kotlin.coroutines.cancellation.CancellationException
import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes
import kotlin.time.TimeSource

/** Call it on the main thread; [scope] is the app scope on `Dispatchers.Main.immediate`. */
class AppCache(
    private val session: SessionSource,
    private val scope: CoroutineScope,
    private val timeSource: TimeSource = TimeSource.Monotonic,
) {
    private val resources = mutableListOf<WeakReference<Resource<*>>>()
    private val keyedReads = mutableListOf<WeakReference<KeyedResources<*, *>>>()

    /** A fetch returning null shows [LoadState.Empty], as a value matching [isEmpty] does. */
    fun <T : Any> resource(
        audience: Audience,
        domains: Set<DataDomain> = emptySet(),
        maxAge: Duration = DEFAULT_MAX_AGE,
        isEmpty: (T) -> Boolean = { false },
        fetch: suspend (AuthenticatedSession?) -> T?,
    ): Resource<T> {
        val resource = Resource(audience, domains, maxAge, session, scope, timeSource, isEmpty, fetch)
        resources.removeAll { it.get() == null }
        resources += WeakReference(resource)
        return resource
    }

    /**
     * Keeps every key a screen shows plus the [recentLimit] most recently used others;
     * [releaseInactive] drops the rest, which load again when opened.
     */
    fun <K, T : Any> keyed(
        audience: Audience,
        domains: Set<DataDomain> = emptySet(),
        maxAge: Duration = DEFAULT_MAX_AGE,
        recentLimit: Int = 8,
        isEmpty: (T) -> Boolean = { false },
        fetch: suspend (AuthenticatedSession?, K) -> T?,
    ): KeyedResources<K, T> {
        val keyed =
            KeyedResources<K, T>(recentLimit) { key ->
                resource(audience, domains, maxAge, isEmpty) { session -> fetch(session, key) }
            }
        keyedReads.removeAll { it.get() == null }
        keyedReads += WeakReference(keyed)
        return keyed
    }

    /** Resources on screen refetch now, the others when next shown. */
    fun invalidate(
        domains: Set<DataDomain>,
        except: Set<Resource<*>> = emptySet(),
    ) {
        live().filter { it !in except && it.domains.any(domains::contains) }.forEach { it.invalidate() }
    }

    fun followSession() {
        live().forEach { it.followSession() }
    }

    fun releaseInactive() {
        keyedReads.mapNotNull { it.get() }.forEach { it.releaseInactive() }
    }

    /**
     * After success it applies [replacing]'s values, then revalidates every other resource reading
     * [invalidating]. [MutationResult.Obsolete] when there's no session or it changed during the
     * write; `Unauthorized` signs that session out. Run it in `viewModelScope`.
     */
    suspend fun <T> mutate(
        invalidating: Set<DataDomain> = emptySet(),
        replacing: (T) -> List<Replacement> = { emptyList() },
        write: suspend (AuthenticatedSession) -> T,
    ): MutationResult<T> {
        val identity = session.current ?: return MutationResult.Obsolete
        return try {
            val value = write(identity)
            if (session.current != identity) return MutationResult.Obsolete
            val replacements = replacing(value)
            replacements.forEach { it.apply() }
            invalidate(invalidating, except = replacements.map { it.resource }.toSet())
            MutationResult.Done(value)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            val error = e.toApiError()
            if (error == ApiError.Unauthorized) session.expire(identity)
            if (error == ApiError.Unauthorized || session.current != identity) {
                MutationResult.Obsolete
            } else {
                MutationResult.Failed(error)
            }
        }
    }

    private fun live() = resources.mapNotNull { it.get() }

    companion object {
        val DEFAULT_MAX_AGE = 5.minutes
    }
}

sealed interface MutationResult<out T> {
    data class Done<T>(
        val value: T,
    ) : MutationResult<T>

    data class Failed(
        val error: ApiError,
    ) : MutationResult<Nothing>

    /** Another session is current now (or none): change nothing on screen. */
    data object Obsolete : MutationResult<Nothing>
}

class KeyedResources<K, T : Any> internal constructor(
    private val recentLimit: Int,
    private val create: (K) -> Resource<T>,
) {
    private val entries = LinkedHashMap<K, Resource<T>>(16, 0.75f, true)

    operator fun get(key: K): Resource<T> {
        val resource = entries.getOrPut(key) { create(key) }
        // Oldest first; the key just asked for is the newest and never goes.
        val evictable = entries.filter { (k, r) -> k != key && !r.isShown }.keys.toList()
        val inactive = entries.values.count { !it.isShown }
        evictable.take((inactive - recentLimit).coerceAtLeast(0)).forEach(entries::remove)
        return resource
    }

    internal fun releaseInactive() {
        entries.values.removeAll { !it.isShown }
    }

    internal val size get() = entries.size
}
