package com.zoonk.android.data

import androidx.datastore.core.CorruptionException
import androidx.datastore.core.DataStore
import androidx.datastore.core.DataStoreFactory
import androidx.datastore.core.Serializer
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import java.io.File
import java.io.IOException
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

/** [moveFrom] is a guest whose drafts move into [next]'s; [forget] is an account nobody can sign in to again. */
data class DraftsChange(
    val next: String?,
    val moveFrom: String? = null,
    val forget: String? = null,
)

/**
 * Keeps each account's file on device until it's forgotten, so signing in again finds the drafts, as
 * main and Apple keep unsent work, and writes it on [io]. A handle stays bound to the account whose
 * session opened it, so a late save from one learner never reaches the next.
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
     * Runs [transition] under the lock handles wait on, then switches files: the same account keeps
     * its handles, the previous account's pending saves land in its file, a guest's upgrade merges
     * into the account's (the guest's entries winning), and a forgotten account's file is deleted.
     */
    suspend fun follow(transition: suspend () -> DraftsChange?) {
        lock.withLock {
            val change = transition() ?: return
            val previous = current
            val switching = previous?.accountId != change.next
            if (!switching && change.forget == null) return
            // [transition] already published the session, so a caller cancelled now must not leave it without drafts.
            withContext(NonCancellable) {
                if (switching) {
                    current = null
                    previous?.close(flush = previous.accountId != change.forget)
                }
                withContext(io) {
                    directory.mkdirs()
                    if (change.next != null && change.moveFrom != null) merge(change.moveFrom, into = change.next)
                    listOfNotNull(change.moveFrom, change.forget).forEach { File(directory, fileName(it)).delete() }
                }
                if (switching) current = change.next?.let { AccountDrafts(it) }
            }
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
            } catch (e: IOException) {
                // A disk that refuses a draft leaves it on screen for a later save; it never crashes the app.
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
            saves.forEach { it.land() }
        }

        suspend fun close(flush: Boolean) {
            if (flush) flush()
            owner = null
            job.cancelAndJoin()
            pending.clear()
        }

        /** Only its own job writes it, so a flush that's cancelled while waiting for it can't drop it. */
        private inner class PendingSave(
            val key: String,
            val entry: JsonElement,
        ) {
            private val asked = CompletableDeferred<Unit>()

            val job =
                sessionScope.launch(start = CoroutineStart.LAZY) {
                    withTimeoutOrNull(debounce) { asked.await() }
                    write(key, entry)
                    pending.remove(key, this@PendingSave)
                }

            suspend fun land() {
                asked.complete(Unit)
                job.join()
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
