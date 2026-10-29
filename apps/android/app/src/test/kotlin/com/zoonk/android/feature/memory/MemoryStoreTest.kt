package com.zoonk.android.feature.memory

import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.StoredSession
import com.zoonk.android.data.value
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Memory
import com.zoonk.api.models.MemoryChangeReference
import com.zoonk.api.models.MemoryExport
import com.zoonk.api.models.MemoryFact
import com.zoonk.api.models.MemoryFactDeletionChange
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.util.UUID

private val FACT_ID: UUID = UUID.fromString("0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c0f1")

private fun memory(enabled: Boolean = true): Memory =
    ApiJson.decodeFromString(
        """
        {"enabled":$enabled,"facts":[{"category":"routine","confidence":null,"createdAt":"2026-10-28T12:00:00.000Z",
         "expiresAt":null,"id":"$FACT_ID","origin":"said","sensitive":false,"source":null,
         "statement":"Studies after work","updatedAt":"2026-10-28T12:00:00.000Z"}]}
        """.trimIndent(),
    )

private class FakeMemoryApi : MemoryApi {
    var current = memory()
    var reads = 0
    var gate: CompletableDeferred<Unit>? = null
    var failure: ApiException? = null

    override suspend fun memory(session: AuthenticatedSession): Memory {
        reads++
        return current
    }

    override suspend fun setEnabled(
        session: AuthenticatedSession,
        enabled: Boolean,
    ): Boolean {
        gate?.await()
        failure?.let { throw it }
        current = current.copy(enabled = enabled)
        return enabled
    }

    override suspend fun updateFact(
        session: AuthenticatedSession,
        id: UUID,
        statement: String,
    ): MemoryFact = throw UnsupportedOperationException()

    override suspend fun deleteFact(
        session: AuthenticatedSession,
        id: UUID,
    ): MemoryFactDeletionChange {
        gate?.await()
        failure?.let { throw it }
        val fact = current.facts.single { it.id == id }
        current = current.copy(facts = emptyList())
        return MemoryFactDeletionChange(MemoryFactDeletionChange.Action.REMOVED, null, fact)
    }

    override suspend fun undo(
        session: AuthenticatedSession,
        changes: List<MemoryChangeReference>,
    ): Boolean = true

    override suspend fun export(session: AuthenticatedSession): MemoryExport = throw UnsupportedOperationException()
}

@OptIn(ExperimentalCoroutinesApi::class)
class MemoryStoreTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val api = FakeMemoryApi()

    private suspend fun TestScope.loadedStore(): MemoryStore {
        val main = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        val sessions =
            SessionStore(
                FakeSessionApi().apply { accounts += "token-a" to ANA },
                MemoryCredentials(StoredSession(AuthenticatedSession(ANA, "token-a", "local-a"))),
                DraftStore(folder.root, main, io = StandardTestDispatcher(testScheduler)),
                onChange = { _, _ -> },
                clearCredentialState = {},
            )
        sessions.restore()
        val store = MemoryStore(api, AppCache(sessions, main))
        store.memory.load()
        advanceUntilIdle()
        return store
    }

    @Test
    fun aDeletedFactLeavesAtOnceAndIsntReadAgain() =
        runTest {
            val store = loadedStore()
            api.gate = CompletableDeferred()

            val deletion = async { store.deleteFact(FACT_ID) }
            runCurrent()
            assertTrue(store.memory.state.value.value!!.facts.isEmpty())

            api.gate!!.complete(Unit)
            assertEquals(FACT_ID, deletion.await()?.previous?.id)
            advanceUntilIdle()
            assertTrue(store.memory.state.value.value!!.facts.isEmpty())
            assertEquals(1, api.reads)
        }

    @Test
    fun aRefusedChangePutsTheOldMemoryBack() =
        runTest {
            val store = loadedStore()
            api.failure = ApiException(ApiError.Unavailable, "INTERNAL_ERROR", 500)

            assertFalse(store.setEnabled(false))
            advanceUntilIdle()

            assertTrue(store.memory.state.value.value!!.enabled)
            assertEquals(1, store.memory.state.value.value!!.facts.size)
        }

    @Test
    fun turningMemoryOffShowsAtOnce() =
        runTest {
            val store = loadedStore()

            assertTrue(store.setEnabled(false))
            advanceUntilIdle()

            assertFalse(store.memory.state.value.value!!.enabled)
            assertEquals(1, api.reads)
        }
}
