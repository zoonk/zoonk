package com.zoonk.android.data

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

@OptIn(ExperimentalCoroutinesApi::class)
class SessionLaunchTest {
    @get:Rule val folder = TemporaryFolder()

    @Test fun launchReadsOverlapValidationAndA401DropsEitherSummaryResponseOrder() =
        runTest {
            for (accepted in listOf(true, false)) {
                for (summaryFirst in listOf(true, false)) {
                    val identity = AuthenticatedSession(ANA, "stored", "local")
                    val credentials = MemoryCredentials(StoredSession(identity))
                    val validation = CompletableDeferred<Unit>()
                    val summaryGate = CompletableDeferred<Unit>()
                    var summaryReads = 0
                    val api =
                        object : SessionApi {
                            override suspend fun currentUser(token: String) =
                                validation.await().let {
                                    if (!accepted) throw ApiException(ApiError.Unauthorized)
                                    account(ANA)
                                }

                            override suspend fun revoke(token: String) = Unit

                            override suspend fun apple(
                                request: com.zoonk.api.models.AppleSessionRequest,
                                guest: AuthenticatedSession?,
                            ) = error("unexpected")
                        }
                    lateinit var cache: AppCache
                    val sessions =
                        SessionStore(
                            api,
                            credentials,
                            DraftStore(folder.newFolder(), backgroundScope, io = StandardTestDispatcher(testScheduler)),
                            onChange = { _, _ -> cache.followSession() },
                            clearCredentialState = {},
                        )
                    cache = AppCache(sessions, backgroundScope)
                    val summaryStore =
                        LearnerSummaryStore({ session ->
                            assertEquals(identity, session)
                            summaryReads++
                            withContext(NonCancellable) { summaryGate.await() }
                            summary(0, Long.MAX_VALUE)
                        }, cache, backgroundScope)
                    val shown = backgroundScope.launch { summaryStore.summary.shown.collect {} }
                    val restore = async { sessions.restore() }
                    runCurrent()
                    assertEquals(1, summaryReads)
                    assertEquals(SessionState.Restoring, sessions.state.value)
                    assertEquals(identity, sessions.current)
                    if (summaryFirst) {
                        summaryGate.complete(Unit)
                        runCurrent()
                    }
                    validation.complete(Unit)
                    restore.await()
                    if (!summaryFirst) {
                        summaryGate.complete(Unit)
                        runCurrent()
                    }
                    if (accepted) {
                        assertTrue(sessions.state.value is SessionState.SignedIn)
                        assertEquals(identity, sessions.current)
                        assertTrue(summaryStore.summary.state.value is LoadState.Loaded)
                        assertEquals(1, summaryReads)
                    } else {
                        assertEquals(SessionState.SignedOut(true), sessions.state.value)
                        assertNull(sessions.current)
                        assertNull(summaryStore.summary.state.value.value)
                        assertNull(credentials.stored)
                    }
                    shown.cancel()
                }
            }
        }
}
