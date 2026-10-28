package com.zoonk.android.data

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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

internal class FakeSessionApi : SessionApi {
    val accounts = mutableMapOf<String, String>()
    val revoked = mutableListOf<String>()
    var failure: ApiError? = null
    var gate: CompletableDeferred<Unit>? = null

    override suspend fun currentUser(token: String) =
        failure?.let { throw ApiException(it) }
            ?: account(accounts[token] ?: throw ApiException(ApiError.Unauthorized)).also { gate?.await() }

    override suspend fun revoke(token: String) {
        failure?.let { throw ApiException(it) }
        revoked += token
    }
}

internal class MemoryCredentials(
    var stored: StoredSession? = null,
) : SessionCredentials {
    override suspend fun read() = stored

    override suspend fun write(session: StoredSession?) {
        stored = session
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class SessionStoreTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val api = FakeSessionApi().apply { accounts += mapOf("token-a" to ANA, "token-b" to BIA) }
    private val credentials = MemoryCredentials()
    private val changes = mutableListOf<Pair<String?, String?>>()
    private var credentialStateClears = 0

    private fun TestScope.store(): SessionStore {
        val main = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        val drafts = DraftStore(folder.root, main, io = StandardTestDispatcher(testScheduler))
        return SessionStore(
            api,
            credentials,
            drafts,
            onChange = { previous, next -> changes += previous?.accountId to next?.accountId },
            clearCredentialState = { credentialStateClears++ },
        )
    }

    @Test
    fun restoreShowsTheAccountOnlyAfterTheApiAcceptsTheToken() =
        runTest {
            credentials.stored = StoredSession("token-a")
            val sessions = store()
            assertEquals(SessionState.Restoring, sessions.state.value)
            sessions.restore()
            val signedIn = sessions.state.value as SessionState.SignedIn
            assertEquals(ANA, signedIn.session.accountId)
            assertEquals(listOf(null to ANA), changes)
        }

    @Test
    fun aRefusedStoredTokenIsClearedAndAnUnreachableOneIsKept() =
        runTest {
            credentials.stored = StoredSession("expired")
            store().apply { restore() }.also { assertEquals(SessionState.SignedOut, it.state.value) }
            assertNull(credentials.stored)

            credentials.stored = StoredSession("token-a")
            api.failure = ApiError.Network
            val offline = store().apply { restore() }
            assertEquals(SessionState.Unavailable, offline.state.value)
            assertEquals(StoredSession("token-a"), credentials.stored)

            api.failure = null
            offline.retryRestore()
            assertTrue(offline.state.value is SessionState.SignedIn)
        }

    @Test
    fun aTokenIsStoredOnlyAfterTheApiAcceptsIt() =
        runTest {
            val sessions = store().apply { restore() }
            val refused = sessions.signIn { "not-a-session" }
            assertEquals(SignInResult.Failed(ApiError.Unauthorized), refused)
            assertNull(credentials.stored)

            assertEquals(SignInResult.SignedIn, sessions.signIn { "token-a" })
            assertEquals(StoredSession("token-a"), credentials.stored)
            assertEquals(ANA, sessions.current?.accountId)
        }

    @Test
    fun aSignInOvertakenByAnotherIsRevokedAndChangesNothing() =
        runTest {
            val sessions = store().apply { restore() }
            val gate = CompletableDeferred<Unit>()
            api.gate = gate
            val slow = async { sessions.signIn { "token-a" } }
            runCurrent()
            api.gate = null
            assertEquals(SignInResult.SignedIn, sessions.signIn { "token-b" })
            gate.complete(Unit)
            assertEquals(SignInResult.Obsolete, slow.await())
            assertEquals(BIA, sessions.current?.accountId)
            assertEquals(StoredSession("token-b"), credentials.stored)
            assertEquals(listOf("token-a"), api.revoked)
        }

    @Test
    fun expiringAnOlderSessionLeavesTheCurrentOneSignedIn() =
        runTest {
            val sessions = store().apply { restore() }
            sessions.signIn { "token-a" }
            val ana = sessions.current!!
            sessions.signIn { "token-b" }
            sessions.expire(ana)
            assertEquals(BIA, sessions.current?.accountId)

            sessions.expire(sessions.current!!)
            assertEquals(SessionState.SignedOut, sessions.state.value)
            assertNull(credentials.stored)
        }

    @Test
    fun signOutKeepsTheSessionWhenTheServerCantBeReached() =
        runTest {
            val sessions = store().apply { restore() }
            sessions.signIn { "token-a" }
            api.failure = ApiError.Network
            assertEquals(SignOutResult.Failed(ApiError.Network), sessions.signOut())
            assertEquals(ANA, sessions.current?.accountId)
            assertEquals(0, credentialStateClears)

            api.failure = null
            assertEquals(SignOutResult.SignedOut, sessions.signOut())
            assertEquals(listOf("token-a"), api.revoked)
            assertNull(credentials.stored)
            assertEquals(1, credentialStateClears)
            assertEquals(ANA to null, changes.last())
        }

    @Test
    fun aRefusedTokenSignsOutEvenWhenTheServerCantEndIt() =
        runTest {
            val sessions = store().apply { restore() }
            sessions.signIn { "token-a" }
            api.failure = ApiError.Unauthorized
            assertEquals(SignOutResult.SignedOut, sessions.signOut())
            assertEquals(SessionState.SignedOut, sessions.state.value)
            advanceUntilIdle()
        }
}
