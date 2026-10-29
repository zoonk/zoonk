package com.zoonk.android.feature.memory

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.perform
import com.zoonk.android.data.value
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Memory
import com.zoonk.api.models.MemoryChangeReference
import com.zoonk.api.models.MemoryExport
import com.zoonk.api.models.MemoryFact
import com.zoonk.api.models.MemoryFactDeletionChange
import com.zoonk.api.models.MemoryFactUpdate
import com.zoonk.api.models.MemorySettingsUpdate
import com.zoonk.api.models.MemoryUndoInput
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.util.UUID

interface MemoryApi {
    suspend fun memory(session: AuthenticatedSession): Memory

    suspend fun setEnabled(
        session: AuthenticatedSession,
        enabled: Boolean,
    ): Boolean

    suspend fun updateFact(
        session: AuthenticatedSession,
        id: UUID,
        statement: String,
    ): MemoryFact

    suspend fun deleteFact(
        session: AuthenticatedSession,
        id: UUID,
    ): MemoryFactDeletionChange

    /** True when every change was undone; false when one changed since. */
    suspend fun undo(
        session: AuthenticatedSession,
        changes: List<MemoryChangeReference>,
    ): Boolean

    suspend fun export(session: AuthenticatedSession): MemoryExport
}

class LiveMemoryApi(
    private val api: ApiClients,
) : MemoryApi {
    override suspend fun memory(session: AuthenticatedSession): Memory = perform { api.clients(session).memory.getCurrentUserMemory() }

    override suspend fun setEnabled(
        session: AuthenticatedSession,
        enabled: Boolean,
    ): Boolean = perform { api.clients(session).memory.updateCurrentUserMemorySettings(MemorySettingsUpdate(enabled)) }.enabled

    override suspend fun updateFact(
        session: AuthenticatedSession,
        id: UUID,
        statement: String,
    ): MemoryFact = perform { api.clients(session).memory.updateMemoryFact(id, MemoryFactUpdate(statement = statement)) }.fact

    override suspend fun deleteFact(
        session: AuthenticatedSession,
        id: UUID,
    ): MemoryFactDeletionChange = perform { api.clients(session).memory.deleteMemoryFact(id) }.change

    override suspend fun undo(
        session: AuthenticatedSession,
        changes: List<MemoryChangeReference>,
    ): Boolean {
        perform { api.clients(session).memory.createMemoryChangeReversal(MemoryUndoInput(changes)) }
        return true
    }

    override suspend fun export(session: AuthenticatedSession): MemoryExport = perform { api.clients(session).memory.exportCurrentUserMemory() }
}

/**
 * What the buddy remembers. Edits show at once and roll back if the server refuses them; each
 * write answers with what changed, so the page isn't read again.
 */
class MemoryStore(
    private val api: MemoryApi,
    private val cache: AppCache,
) {
    val memory: Resource<Memory> =
        cache.resource(Audience.SignedIn, setOf(DataDomain.Memory)) { session -> session?.let { api.memory(it) } }

    suspend fun setEnabled(enabled: Boolean): Boolean = edit({ it.copy(enabled = enabled) }) { session -> api.setEnabled(session, enabled) }

    suspend fun updateFact(
        id: UUID,
        statement: String,
    ): Boolean =
        edit({ it.copy(facts = it.facts.map { fact -> if (fact.id == id) fact.copy(statement = statement) else fact }) }) { session ->
            api.updateFact(session, id, statement)
        }

    /** The change, for Undo; null when it wasn't deleted. */
    suspend fun deleteFact(id: UUID): MemoryFactDeletionChange? {
        var change: MemoryFactDeletionChange? = null
        edit({ it.copy(facts = it.facts.filterNot { fact -> fact.id == id }) }) { session -> change = api.deleteFact(session, id) }
        return change
    }

    /** Undoing restores facts the page doesn't have, so it reads memory again. */
    suspend fun undo(changes: List<MemoryChangeReference>): Boolean =
        cache.mutate(invalidating = setOf(DataDomain.Memory)) { session -> api.undo(session, changes) } is MutationResult.Done

    suspend fun export(): String? =
        when (val result = cache.mutate { session -> api.export(session) }) {
            is MutationResult.Done -> withContext(Dispatchers.Default) { ExportJson.encodeToString(MemoryExport.serializer(), result.value) }
            else -> null
        }

    /** Shows [optimistic] at once and keeps it once saved; puts the old memory back only when the write failed. */
    private suspend fun edit(
        optimistic: (Memory) -> Memory,
        write: suspend (AuthenticatedSession) -> Any?,
    ): Boolean {
        val before = memory.state.value.value
        if (before != null) memory.update(optimistic)
        val result =
            cache.mutate(
                invalidating = setOf(DataDomain.Memory),
                replacing = { listOfNotNull(memory.state.value.value?.let(memory::replacing)) },
                write = write,
            )
        if (result is MutationResult.Failed && before != null) memory.update { before }
        return result is MutationResult.Done
    }
}

private val ExportJson =
    Json(from = ApiJson) {
        prettyPrint = true
        explicitNulls = true
    }
