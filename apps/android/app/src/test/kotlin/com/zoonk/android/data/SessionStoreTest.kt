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

    override suspend fun apple(
        request: com.zoonk.api.models.AppleSessionRequest,
        guest: AuthenticatedSession?,
    ): String = "token-b"

    override suspend fun revoke(token: String) {
        failure?.let { throw ApiException(it) }
        revoked += token
    }
}

internal class MemoryCredentials(
    var stored: StoredSession? = null,
) : SessionCredentials {
    var pending: PendingAppleSignIn? = null

    override suspend fun pendingApple() = pending

    override suspend fun writePendingApple(pending: PendingAppleSignIn?) {
        this.pending = pending
    }

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
            credentials.stored = StoredSession(AuthenticatedSession(ANA, "token-a", "local-a"))
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
            credentials.stored = StoredSession(AuthenticatedSession(ANA, "expired", "local-a"))
            store().apply { restore() }.also { assertEquals(SessionState.SignedOut(sessionEnded = true), it.state.value) }
            assertNull(credentials.stored)

            credentials.stored = StoredSession(AuthenticatedSession(ANA, "token-a", "local-a"))
            api.failure = ApiError.Network
            val offline = store().apply { restore() }
            assertEquals(SessionState.Unavailable, offline.state.value)
            assertEquals(StoredSession(AuthenticatedSession(ANA, "token-a", "local-a")), credentials.stored)

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
            assertEquals("token-a", credentials.stored?.session?.bearerToken)
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
            assertEquals("token-b", credentials.stored?.session?.bearerToken)
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
            assertEquals(SessionState.SignedOut(sessionEnded = true), sessions.state.value)
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
            assertEquals(SessionState.SignedOut(), sessions.state.value)
            advanceUntilIdle()
        }
}
