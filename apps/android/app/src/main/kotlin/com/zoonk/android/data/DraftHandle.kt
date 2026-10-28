package com.zoonk.android.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * One draft (`essay:<blockId>`) in the drafts of the account whose session opened it. It stays
 * bound to that account: once another session is signed in it reads nothing and writes nothing.
 * Debounced saves belong to that session and end with it. Screens [flush] on `ON_STOP`, and remove
 * the draft once the server has the work.
 */
class DraftHandle<T> internal constructor(
    private val store: DraftStore,
    private val accountId: String,
    private val key: String,
    private val serializer: KSerializer<T>,
) {
    private var bound: DraftStore.AccountDrafts? = null
    private var resolved = false

    /** The saved draft, or null when there's none (or it can't be read with this serializer). */
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

    /** Saves [value] once edits pause for a moment; a newer value replaces a waiting one. */
    fun saveDebounced(value: T) {
        val entry = json.encodeToJsonElement(serializer, value)
        store.launch { drafts()?.writeLater(key, entry) }
    }

    suspend fun remove() {
        val drafts = drafts() ?: return
        drafts.cancelPending(key)
        drafts.write(key, null)
    }

    /** Writes a debounced save now. */
    suspend fun flush() {
        drafts()?.flush(key)
    }

    /** The account's open drafts, found once: a handle never moves to another account's file. */
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
