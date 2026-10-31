package com.zoonk.android.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * Reads and writes nothing once its account isn't signed in. Pending debounced saves end with the
 * session. Screens [flush] on `ON_STOP` and [remove] the draft once the server has the work.
 */
class DraftHandle<T> internal constructor(
    private val store: DraftStore,
    private val accountId: String,
    private val key: String,
    private val serializer: KSerializer<T>,
) {
    private var bound: DraftStore.AccountDrafts? = null
    private var resolved = false

    /** Null when there's none or it no longer decodes with this serializer. */
    val value: Flow<T?> =
        flow {
            val drafts = drafts() ?: return@flow emit(null)
            emitAll(drafts.data.map { it.entries[key]?.let(::decode) })
        }

    suspend fun save(value: T) {
        val drafts = drafts() ?: return
        drafts.cancelPending(key)
        drafts.write(key, json.encodeToJsonElement(serializer, value))
    }

    fun saveDebounced(value: T) {
        val entry = json.encodeToJsonElement(serializer, value)
        store.launch { drafts()?.writeLater(key, entry) }
    }

    suspend fun remove() {
        val drafts = drafts() ?: return
        drafts.cancelPending(key)
        drafts.write(key, null)
    }

    suspend fun flush() {
        drafts()?.flush(key)
    }

    private suspend fun drafts(): DraftStore.AccountDrafts? {
        if (!resolved) {
            bound = store.drafts(accountId)
            resolved = true
        }
        return bound
    }

    private fun decode(entry: kotlinx.serialization.json.JsonElement): T? =
        try {
            json.decodeFromJsonElement(serializer, entry)
        } catch (e: SerializationException) {
            null
        } catch (e: IllegalArgumentException) {
            null
        }

    private companion object {
        val json = Json { ignoreUnknownKeys = true }
    }
}
