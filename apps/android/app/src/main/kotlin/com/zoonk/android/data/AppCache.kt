package com.zoonk.android.data

import kotlinx.coroutines.CoroutineScope
import java.lang.ref.WeakReference
import kotlin.coroutines.cancellation.CancellationException
import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes
import kotlin.time.TimeSource

/**
 * The app's cache of server data, created once in `AppContainer` with the app scope
 * (`Dispatchers.Main.immediate`). Feature stores create their resources here; a mutation names the
 * domains it changed so every resource reading one of them revalidates, and a session change drops
 * everything the previous session loaded. Memory only: the API's reads are private, so an HTTP
 * cache wouldn't serve them.
 */
class AppCache(
    private val session: SessionSource,
    private val scope: CoroutineScope,
    private val timeSource: TimeSource = TimeSource.Monotonic,
) {
    private val resources = mutableListOf<WeakReference<Resource<*>>>()
    private val keyedReads = mutableListOf<WeakReference<KeyedResources<*, *>>>()

    /**
     * Creates a resource and registers it for invalidation and session changes.
     *
     * @param audience whose data it is, which decides what a session change does to it.
     * @param domains the data it reads that mutations can change.
     * @param maxAge how long a loaded value counts as fresh; mutations revalidate sooner.
     * @param isEmpty whether a loaded value has nothing to show; a fetch returning null is empty too.
     * @param fetch one request for the value, given the session it's for (null when signed out).
     */
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
     * Heavy reads by id (a course, a lesson, a tutor thread): every key a screen shows stays, plus
     * the [recentLimit] most recently used others.
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

    /**
     * Revalidates every resource reading one of [domains]: on screen now, elsewhere the next time
     * it's shown. Mutations call it with everything they changed, as main revalidates cache tags.
     */
    fun invalidate(
        domains: Set<DataDomain>,
        except: Set<Resource<*>> = emptySet(),
    ) {
        live().filter { it !in except && it.domains.any(domains::contains) }.forEach { it.invalidate() }
    }

    /** Drops every resource that belongs to a session that's no longer current. `SessionStore` calls it. */
    fun followSession() {
        live().forEach { it.followSession() }
    }

    /** Under memory pressure (`onTrimMemory`), keyed reads no screen shows go; they load again when opened. */
    fun releaseInactive() {
        keyedReads.mapNotNull { it.get() }.forEach { it.releaseInactive() }
    }

    /**
     * Runs a write for the current session. After success it applies [replacing]'s new values,
     * then revalidates every other resource reading [invalidating]. The write is [MutationResult.Obsolete]
     * when there's no session or it changed during the write, and an `Unauthorized` answer signs
     * that session out. Run it in `viewModelScope`; cancellation propagates.
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
        /** How long a value counts as fresh; catches changes made elsewhere, such as on another device. */
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

/**
 * Keyed reads with a bounded memory: every resource a screen shows stays, plus the [recentLimit]
 * most recently used others; [AppCache.releaseInactive] releases all the others. A released key
 * loads again the next time a screen opens it.
 */
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
