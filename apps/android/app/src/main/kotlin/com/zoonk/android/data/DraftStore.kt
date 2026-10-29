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

@Serializable
data class LearnerDrafts(
    val entries: Map<String, JsonElement> = emptyMap(),
)

/** [moveFrom] is a guest whose drafts move into [next]'s; any other previous account's are deleted. */
data class DraftsChange(
    val next: String?,
    val moveFrom: String? = null,
)

/**
 * Keeps only the current account's file on device and writes it on [io]. A handle stays bound to
 * the account whose session opened it, so a late save from one learner never reaches the next.
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

    fun <T> open(
        session: AuthenticatedSession,
        key: String,
        serializer: KSerializer<T>,
    ): DraftHandle<T> = DraftHandle(this, session.accountId, key, serializer)

    /**
     * Runs [transition] under the lock handles wait on, then moves the files: the same account keeps
     * its file and handles, a guest's upgrade flushes and merges into the account's (the guest's
     * entries winning), and any other change closes and deletes the old file.
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

    internal inner class AccountDrafts(
        val accountId: String,
    ) {
        private val job = SupervisorJob(scope.coroutineContext[Job])
        private val sessionScope = CoroutineScope(scope.coroutineContext + job)
        private val pending = ConcurrentHashMap<String, PendingSave>()

        // Checked again inside updateData: a write queued before handover must not land after it.
        @Volatile
        private var owner: String? = accountId

        private val store: DataStore<LearnerDrafts> =
            DataStoreFactory.create(
                serializer = serializer,
                corruptionHandler = ReplaceFileCorruptionHandler { LearnerDrafts() },
                scope = CoroutineScope(job + io),
                produceFile = { File(directory, fileName(accountId)) },
            )

        // A closed DataStore's flow throws its scope's cancellation.
        val data: Flow<LearnerDrafts> =
            flow { if (owner == accountId) emitAll(store.data) else emit(LearnerDrafts()) }
                .catch { if (owner == accountId) throw it else emit(LearnerDrafts()) }

        suspend fun write(
            key: String,
            entry: JsonElement?,
        ) {
            if (owner != accountId) return
            try {
                // DataStore runs updateData's transform in its caller's context, which would make a
                // write wait for a busy main thread.
                withContext(io) {
                    store.updateData { drafts ->
                        when {
                            owner != accountId -> drafts
                            entry == null -> LearnerDrafts(drafts.entries - key)
                            else -> LearnerDrafts(drafts.entries + (key to entry))
                        }
                    }
                }
            } catch (e: CancellationException) {
                // A closed file drops the write; only the caller's own cancellation propagates.
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

        /** Whichever of the debounce and a flush removes it from [pending] writes it. */
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
