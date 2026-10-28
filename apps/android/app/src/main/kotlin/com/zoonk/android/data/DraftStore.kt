package com.zoonk.android.data

import androidx.datastore.core.CorruptionException
import androidx.datastore.core.DataStore
import androidx.datastore.core.DataStoreFactory
import androidx.datastore.core.Serializer
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.cancellation.CancellationException
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds

/** One account's drafts on device: each feature's entry by key (`essay:<blockId>`). */
@Serializable
data class LearnerDrafts(
    val entries: Map<String, JsonElement> = emptyMap(),
)

/** Where drafts go when the session changes: [next]'s file, moving [moveFrom]'s drafts into it. */
data class DraftsChange(
    val next: String?,
    val moveFrom: String? = null,
)

/**
 * Learner work that must survive process death and restarts (the mock's save queue, essay text,
 * test-out answers): one DataStore file per account (`drafts/<accountId>.json`), only the current
 * account's on device, written on [io] and never on the main thread. Screens open a [DraftHandle]
 * from the session they show; a handle stays bound to that account's file, so a late save made
 * under one learner can never reach another learner's file. `SessionStore` moves drafts between
 * accounts through [follow], under the one lock every handle waits on.
 */
class DraftStore(
    private val directory: File,
    private val scope: CoroutineScope,
    private val io: CoroutineDispatcher = Dispatchers.IO,
    private val debounce: Duration = 500.milliseconds,
    private val serializer: Serializer<LearnerDrafts> = LearnerDraftsSerializer,
) {
    private val lock = Mutex()
    private var current: AccountDrafts? = null

    /** A handle on [key] in [session]'s drafts; it does nothing once that account isn't signed in. */
    fun <T> open(
        session: AuthenticatedSession,
        key: String,
        serializer: KSerializer<T>,
    ): DraftHandle<T> = DraftHandle(this, session.accountId, key, serializer)

    /**
     * Runs [transition] (which publishes the next session) under the drafts lock, then moves the
     * drafts where it says: the same account keeps its file and handles; another account (or none)
     * closes the old file and deletes it; a guest's upgrade flushes the guest's pending saves and
     * merges its file into the account's, the guest's entries winning.
     */
    suspend fun follow(transition: suspend () -> DraftsChange?) {
        lock.withLock {
            val change = transition() ?: return
            val previous = current
            if (previous?.accountId == change.next) return
            current = null
            previous?.close(flush = previous.accountId == change.moveFrom)
            withContext(io) {
                directory.mkdirs()
                if (change.next != null && change.moveFrom != null) merge(change.moveFrom, into = change.next)
                directory.listFiles()?.filter { it.name != change.next?.let(::fileName) }?.forEach { it.delete() }
            }
            current = change.next?.let { AccountDrafts(it) }
        }
    }

    internal suspend fun drafts(accountId: String): AccountDrafts? = lock.withLock { current?.takeIf { it.accountId == accountId } }

    internal fun launch(block: suspend CoroutineScope.() -> Unit) = scope.launch(block = block)

    private fun fileName(accountId: String) = "$accountId.json"

    private fun merge(
        from: String,
        into: String,
    ) {
        val guest = read(File(directory, fileName(from))) ?: return
        val account = read(File(directory, fileName(into))) ?: LearnerDrafts()
        File(directory, fileName(into)).writeText(
            json.encodeToString(
                LearnerDrafts.serializer(),
                LearnerDrafts(account.entries + guest.entries),
            ),
        )
    }

    private fun read(file: File): LearnerDrafts? =
        try {
            file.takeIf { it.exists() }?.let { json.decodeFromString(LearnerDrafts.serializer(), it.readText()) }
        } catch (e: SerializationException) {
            null
        }

    /** One account's open file. Its DataStore and its debounced saves run in [job], cancelled on handover. */
    internal inner class AccountDrafts(
        val accountId: String,
    ) {
        private val job = SupervisorJob(scope.coroutineContext[Job])
        private val sessionScope = CoroutineScope(scope.coroutineContext + job)
        private val pending = ConcurrentHashMap<String, PendingSave>()

        /** The account the open file belongs to; cleared before handover, checked inside every write. */
        @Volatile
        private var owner: String? = accountId

        private val store: DataStore<LearnerDrafts> =
            DataStoreFactory.create(
                serializer = serializer,
                corruptionHandler = ReplaceFileCorruptionHandler { LearnerDrafts() },
                scope = CoroutineScope(job + io),
                produceFile = { File(directory, fileName(accountId)) },
            )

        /** The file's drafts; empty once it's closed (the account isn't signed in anymore). */
        val data: Flow<LearnerDrafts> =
            flow { if (owner == accountId) emitAll(store.data) else emit(LearnerDrafts()) }
                .catch { if (owner == accountId) throw it else emit(LearnerDrafts()) }

        suspend fun write(
            key: String,
            entry: JsonElement?,
        ) {
            if (owner != accountId) return
            try {
                store.updateData { drafts ->
                    when {
                        owner != accountId -> drafts
                        entry == null -> LearnerDrafts(drafts.entries - key)
                        else -> LearnerDrafts(drafts.entries + (key to entry))
                    }
                }
            } catch (e: CancellationException) {
                // The file closed (another session); only the caller's own cancellation propagates.
                currentCoroutineContext().ensureActive()
            }
        }

        fun writeLater(
            key: String,
            entry: JsonElement,
        ) {
            if (owner != accountId) return
            val save = PendingSave(key, entry)
            pending.put(key, save)?.job?.cancel()
            save.job.start()
        }

        fun cancelPending(key: String) {
            pending.remove(key)?.job?.cancel()
        }

        /** Writes [key]'s debounced save now, or every pending one without a key. */
        suspend fun flush(key: String? = null) {
            val saves = if (key == null) pending.values.toList() else listOfNotNull(pending[key])
            for (save in saves) {
                if (!pending.remove(save.key, save)) continue
                save.job.cancel()
                write(save.key, save.entry)
            }
        }

        suspend fun close(flush: Boolean) {
            if (flush) flush()
            owner = null
            job.cancelAndJoin()
            pending.clear()
        }

        /** A save waiting out the debounce; whichever of it and a flush takes it from [pending] writes it. */
        private inner class PendingSave(
            val key: String,
            val entry: JsonElement,
        ) {
            val job =
                sessionScope.launch(start = CoroutineStart.LAZY) {
                    delay(debounce)
                    if (pending.remove(key, this@PendingSave)) write(key, entry)
                }
        }
    }

    internal object LearnerDraftsSerializer : Serializer<LearnerDrafts> {
        override val defaultValue = LearnerDrafts()

        override suspend fun readFrom(input: InputStream): LearnerDrafts =
            try {
                json.decodeFromString(LearnerDrafts.serializer(), input.readBytes().decodeToString())
            } catch (e: SerializationException) {
                throw CorruptionException("Unreadable drafts", e)
            }

        override suspend fun writeTo(
            t: LearnerDrafts,
            output: OutputStream,
        ) {
            output.write(json.encodeToString(LearnerDrafts.serializer(), t).encodeToByteArray())
        }
    }

    private companion object {
        val json = Json { ignoreUnknownKeys = true }
    }
}
