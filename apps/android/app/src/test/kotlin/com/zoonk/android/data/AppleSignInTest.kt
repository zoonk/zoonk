package com.zoonk.android.data

import androidx.datastore.core.DataStoreFactory
import androidx.datastore.core.Serializer
import com.zoonk.android.navigation.AppLink
import com.zoonk.api.models.AppleSessionRequest
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

@OptIn(ExperimentalCoroutinesApi::class)
class AppleSignInTest {
    @get:Rule val folder = TemporaryFolder()
    private var credentials: SessionCredentials = MemoryCredentials()
    private var time = 0L
    private var serial = 0
    private var exchangeGate: CompletableDeferred<Unit>? = null
    private var validationGate: CompletableDeferred<Unit>? = null
    private val exchanged = mutableListOf<Pair<AppleSessionRequest, AuthenticatedSession?>>()
    private val revoked = mutableListOf<String>()
    private val api =
        object : SessionApi {
            override suspend fun currentUser(token: String) =
                account(if (token == "apple") BIA else ANA).also {
                    if (token == "apple") validationGate?.await()
                }

            override suspend fun revoke(token: String) {
                revoked += token
            }

            override suspend fun apple(
                request: AppleSessionRequest,
                guest: AuthenticatedSession?,
            ): String {
                exchanged += request to guest
                exchangeGate?.await()
                return "apple"
            }
        }

    private fun TestScope.store() =
        SessionStore(
            api,
            credentials,
            DraftStore(folder.newFolder(), backgroundScope, io = StandardTestDispatcher(testScheduler)),
            onChange = { _, _ -> },
            clearCredentialState = {},
            now = { time },
            newSecret = { "secret-${serial++}" },
        )

    private suspend fun SessionStore.start(): String =
        startAppleSignIn("services-id", "https://api.zoonk.com/auth/apple/android").toHttpUrl().queryParameter("state")!!

    private fun callback(state: String) = AppleCallback(state, "code", "id-token")

    @Test fun unsolicitedWrongExpiredSupersededAndDuplicateCallbacksNeverExchangeTwice() =
        runTest {
            val sessions = store().apply { restore() }
            assertEquals(SignInResult.Obsolete, sessions.completeAppleSignIn(callback("unsolicited")))
            val old = sessions.start()
            assertEquals(SignInResult.Obsolete, sessions.completeAppleSignIn(callback("wrong")))
            val latest = sessions.start()
            assertEquals(SignInResult.Obsolete, sessions.completeAppleSignIn(callback(old)))
            time = 600_000
            assertEquals(SignInResult.Obsolete, sessions.completeAppleSignIn(callback(latest)))
            assertTrue(exchanged.isEmpty())
            val active = sessions.start()
            assertEquals(SignInResult.SignedIn, sessions.completeAppleSignIn(callback(active)))
            assertEquals(SignInResult.Obsolete, sessions.completeAppleSignIn(callback(active)))
            assertEquals(1, exchanged.size)
        }

    @Test fun cancellationAndErrorOnlyConsumeTheMatchingSlot() =
        runTest {
            val sessions = store().apply { restore() }
            val old = sessions.start()
            val active = sessions.start()
            sessions.cancelAppleSignIn(old)
            sessions.completeAppleSignIn(AppleCallback(old, error = "access_denied"))
            assertEquals(active, credentials.pendingApple()?.state)
            sessions.completeAppleSignIn(AppleCallback(active, error = "access_denied"))
            assertNull(credentials.pendingApple())
            val next = sessions.start()
            sessions.cancelAppleSignIn(next)
            assertNull(credentials.pendingApple())
            assertTrue(exchanged.isEmpty())
        }

    @Test fun authorizeHashesTheNonceAndTheFragmentMapsAppleProfileAndGuestBearer() =
        runTest {
            val sessions =
                store().apply {
                    restore()
                    signIn(asGuest = true) { "guest" }
                }
            val guest = sessions.current
            val url = sessions.startAppleSignIn("services-id", "https://api.zoonk.com/auth/apple/android").toHttpUrl()
            val pending = credentials.pendingApple()!!
            assertEquals("code id_token", url.queryParameter("response_type"))
            assertEquals("form_post", url.queryParameter("response_mode"))
            assertEquals("https://api.zoonk.com/auth/apple/android", url.queryParameter("redirect_uri"))
            assertEquals(64, url.queryParameter("nonce")!!.length)
            assertNotEquals(pending.rawNonce, url.queryParameter("nonce"))
            val fragment =
                "https://zoonk.com/auth/apple#state=${pending.state}&code=a%2Bb%20c&id_token=id&" +
                    "user=%7B%22email%22%3A%22a%40example.com%22%2C%22name%22%3A%7B%22firstName%22%3A%22Ana%22%7D%7D"
            assertEquals(SignInResult.SignedIn, sessions.completeAppleSignIn(AppLink.appleCallback(fragment)!!))
            val (request, bearer) = exchanged.single()
            assertEquals(guest, bearer)
            assertEquals("a+b c", request.authorizationCode)
            assertEquals(pending.rawNonce, request.nonce)
            assertEquals(AppleSessionRequest.Client.WEB, request.client)
            assertEquals("Ana", request.user?.name?.firstName)
            assertEquals("a@example.com", request.user?.email)
            assertEquals(BIA, sessions.current?.accountId)
            assertNull(AppLink.appleCallback("https://evil.com/auth/apple#state=x"))
            assertNull(AppLink.appleCallback("https://zoonk.com/auth/app#state=x"))
            assertNull(AppLink.appleCallback("https://zoonk.com/auth/apple?state=x"))
        }

    @Test fun aDifferentSignInBeforeTheCallbackSendsNothing() =
        runTest {
            val sessions = store().apply { restore() }
            val state = sessions.start()
            sessions.signIn { "google" }
            assertEquals(SignInResult.Obsolete, sessions.completeAppleSignIn(callback(state)))
            assertTrue(exchanged.isEmpty())
        }

    @Test fun sessionEndingDuringExchangeOrValidationRevokesTheAppleToken() =
        runTest {
            for (duringValidation in listOf(false, true)) {
                val sessions =
                    store().apply {
                        restore()
                        signIn(asGuest = true) { "guest" }
                    }
                val state = sessions.start()
                val gate = CompletableDeferred<Unit>()
                if (duringValidation) validationGate = gate else exchangeGate = gate
                val result = async { sessions.completeAppleSignIn(callback(state)) }
                runCurrent()
                sessions.expire(sessions.current!!)
                gate.complete(Unit)
                assertEquals(SignInResult.Obsolete, result.await())
                assertNull(sessions.current)
                validationGate = null
                exchangeGate = null
            }
            assertEquals(listOf("apple", "apple"), revoked)
        }

    @Test fun aGoogleSignInFinishingDuringTheAppleExchangeCannotOverwriteIt() =
        runTest {
            val sessions = store().apply { restore() }
            val state = sessions.start()
            exchangeGate = CompletableDeferred()
            val apple = async { sessions.completeAppleSignIn(callback(state)) }
            runCurrent()
            val google = async { sessions.signIn { "google" } }
            runCurrent()
            exchangeGate!!.complete(Unit)
            assertEquals(SignInResult.SignedIn, apple.await())
            assertEquals(SignInResult.Obsolete, google.await())
            assertEquals("apple", sessions.current?.bearerToken)
            assertEquals(listOf("google"), revoked)
        }

    @Test fun aRecreatedStoreCanCompleteThePendingTransaction() =
        runTest {
            val first =
                store().apply {
                    restore()
                    signIn(asGuest = true) { "guest" }
                }
            val state = first.start()
            val second = store().apply { restore() }
            assertEquals(first.current, second.current)
            assertEquals(SignInResult.SignedIn, second.completeAppleSignIn(callback(state)))
            assertEquals(first.current, exchanged.single().second)
        }

    @Test fun pendingTransactionsSurviveDataStoreRecreationFromGuestAndSignedOut() =
        runTest {
            for (guest in listOf(false, true)) {
                val file = folder.newFile()
                file.delete()
                var diskScope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))

                fun diskCredentials(): SessionCredentials {
                    val disk =
                        DataStoreFactory.create(
                            serializer =
                                object : Serializer<SessionFile> {
                                    override val defaultValue = SessionFile()

                                    override suspend fun readFrom(input: java.io.InputStream) =
                                        Json.decodeFromString<SessionFile>(input.readBytes().decodeToString())

                                    override suspend fun writeTo(
                                        t: SessionFile,
                                        output: java.io.OutputStream,
                                    ) {
                                        output.write(Json.encodeToString(t).encodeToByteArray())
                                    }
                                },
                            scope = diskScope,
                            produceFile = { file },
                        )
                    return object : SessionCredentials {
                        override suspend fun read() = disk.data.first().session

                        override suspend fun write(session: StoredSession?) {
                            disk.updateData { it.copy(session = session) }
                        }

                        override suspend fun pendingApple() = disk.data.first().pendingApple

                        override suspend fun writePendingApple(pending: PendingAppleSignIn?) {
                            disk.updateData { it.copy(pendingApple = pending) }
                        }
                    }
                }
                credentials = diskCredentials()
                val first = store().apply { restore() }
                if (guest) first.signIn(asGuest = true) { "guest" }
                val state = first.start()
                diskScope.coroutineContext[kotlinx.coroutines.Job]!!.cancelAndJoin()
                diskScope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
                credentials = diskCredentials()
                val recreated = store().apply { restore() }
                assertEquals(SignInResult.SignedIn, recreated.completeAppleSignIn(callback(state)))
                assertEquals(first.current, exchanged.last().second)
                diskScope.coroutineContext[kotlinx.coroutines.Job]!!.cancelAndJoin()
            }
        }
}
