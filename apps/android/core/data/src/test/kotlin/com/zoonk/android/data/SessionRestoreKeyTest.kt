package com.zoonk.android.data

import androidx.credentials.exceptions.restorecredential.E2eeUnavailableException
import com.zoonk.api.models.RestoreKeySessionResponse
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

@OptIn(ExperimentalCoroutinesApi::class)
class SessionRestoreKeyTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val api =
        FakeSessionApi().apply {
            accounts += mapOf("token-a" to ANA, "token-b" to BIA, "restored-a" to ANA, "restored-guest" to GUEST)
        }
    private var credentials = MemoryCredentials()
    private var keys = FakeRestoreKeys()
    private var clears = 0
    private lateinit var drafts: DraftStore

    private fun TestScope.store(): SessionStore {
        val main = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        drafts = DraftStore(folder.newFolder(), main, io = StandardTestDispatcher(testScheduler))
        return SessionStore(
            api,
            credentials,
            drafts,
            onChange = { _, _ -> },
            clearCredentialState = {
                clears++
                keys.key = null
            },
            restoreKeys = keys,
        ).also { main.launch { it.keepRestoreKeys() } }
    }

    private fun newPhone(
        key: String,
        redeemsFor: RestoreKeySessionResponse?,
    ) {
        credentials = MemoryCredentials()
        keys = FakeRestoreKeys(key)
        redeemsFor?.let { api.redeemable[key] = it }
        api.restoreKeyRequests.clear()
        clears = 0
    }

    @Test
    fun aMovedKeyRestoresTheAccountOrGuestAsAFreshSessionThatEnrollsThisPhone() =
        runTest {
            for ((token, accountId, isGuest) in listOf(Triple("restored-a", ANA, false), Triple("restored-guest", GUEST, true))) {
                newPhone("old-phone-$accountId", RestoreKeySessionResponse(token = token, isGuest = isGuest))
                val sessions = store().apply { restore() }
                advanceUntilIdle()

                val signedIn = sessions.state.value as SessionState.SignedIn
                assertEquals(accountId, signedIn.session.accountId)
                assertEquals(isGuest, signedIn.isGuest)
                assertEquals(StoredSession(signedIn.session, isGuest, hasRestoreKey = true), credentials.stored)
                assertTrue(credentials.restoreChecked)
                assertEquals(listOf("challenge", "redeem", "challenge", "register"), api.restoreKeyRequests)
                assertEquals(signedIn.session to "key-1", api.registered.last())
                assertEquals("key-1", keys.key)

                if (isGuest) {
                    drafts.open(signedIn.session, "essay:1", EssayDraft.serializer()).save(EssayDraft("from the old phone"))
                    sessions.signIn { "token-a" }
                    val upgraded = drafts.open(sessions.current!!, "essay:1", EssayDraft.serializer())
                    assertEquals(EssayDraft("from the old phone"), upgraded.value.first())
                }
            }
        }

    @Test
    fun aStoredSessionWinsAndAnEnrolledOneMakesNoRestoreKeyRequest() =
        runTest {
            newPhone("old-phone", RestoreKeySessionResponse(token = "restored-a", isGuest = false))
            credentials.stored = StoredSession(AuthenticatedSession(BIA, "token-b", "local-b"), hasRestoreKey = true)
            val sessions = store().apply { restore() }
            advanceUntilIdle()

            assertEquals("token-b", sessions.current?.bearerToken)
            assertEquals(emptyList<String>(), keys.signed)
            assertEquals(emptyList<String>(), api.restoreKeyRequests)
        }

    @Test
    fun withoutAKeyTheFirstLaunchMakesNoRequestAndLaterLaunchesDontLook() =
        runTest {
            val first = store().apply { restore() }
            assertEquals(SessionState.SignedOut(), first.state.value)
            assertTrue(credentials.restoreChecked)
            assertEquals(1, keys.signed.size)

            keys.key = "arrived-later"
            val later = store().apply { restore() }
            advanceUntilIdle()
            assertEquals(SessionState.SignedOut(), later.state.value)
            assertEquals(1, keys.signed.size)
            assertEquals(emptyList<String>(), api.restoreKeyRequests)
        }

    @Test
    fun aProbeCredentialManagerCantAnswerSignsOutWithoutRequestsAndLooksAgainNextLaunch() =
        runTest {
            newPhone("old-phone", RestoreKeySessionResponse(token = "restored-a", isGuest = false))
            keys.signFailure = IllegalStateException("Play services is updating")
            val first = store().apply { restore() }
            assertEquals(SessionState.SignedOut(), first.state.value)
            assertFalse(credentials.restoreChecked)
            assertEquals(emptyList<String>(), api.restoreKeyRequests)

            keys.signFailure = null
            val next = store().apply { restore() }
            assertEquals(ANA, next.current?.accountId)
        }

    @Test
    fun aKeyTheServerRefusesIsDeletedAndThePhoneStartsSignedOut() =
        runTest {
            for (disabled in listOf(false, true)) {
                newPhone("signed-out-phone", redeemsFor = null)
                api.redeemFailure = ApiException(ApiError.Unavailable, "ACCOUNT_DISABLED", 403).takeIf { disabled }
                val sessions = store().apply { restore() }
                advanceUntilIdle()

                assertEquals(SessionState.SignedOut(), sessions.state.value)
                assertNull(keys.key)
                assertEquals(1, clears)
                assertTrue(credentials.restoreChecked)
                assertEquals(listOf("challenge", "redeem"), api.restoreKeyRequests)
            }
            api.redeemFailure = null
        }

    @Test
    fun aKeyThatCantBeRedeemedYetIsKeptAndRetryRestores() =
        runTest {
            val failures =
                listOf(
                    ApiException(ApiError.Network),
                    ApiException(ApiError.Unavailable, "CHALLENGE_EXPIRED", 400),
                    ApiException(ApiError.Unavailable, "RATE_LIMIT_EXCEEDED", 429),
                )
            for (failure in failures) {
                newPhone("old-phone", RestoreKeySessionResponse(token = "restored-a", isGuest = false))
                api.redeemFailure = failure
                val sessions = store().apply { restore() }
                assertEquals(SessionState.Unavailable, sessions.state.value)
                assertEquals("old-phone", keys.key)
                assertEquals(0, clears)
                assertFalse(credentials.restoreChecked)

                api.redeemFailure = null
                sessions.retryRestore()
                assertEquals(ANA, sessions.current?.accountId)
            }
        }

    @Test
    fun aPhoneWithoutCloudBackupStillKeepsAKeyForAPhoneToPhoneMove() =
        runTest {
            keys.hasCloudBackup = false
            store().apply { restore() }.signIn { "token-a" }
            advanceUntilIdle()
            assertEquals(listOf(true, false), keys.created)
            assertEquals(credentials.stored?.session to "key-2", api.registered.single())
            assertEquals(true, credentials.stored?.hasRestoreKey)
        }

    @Test
    fun aFailedEnrollmentTriesAgainOnTheNextValidatedLaunch() =
        runTest {
            api.registerGate = CompletableDeferred()
            store().apply { restore() }.signIn { "token-a" }
            runCurrent()
            api.failure = ApiError.Network
            api.registerGate?.complete(Unit)
            advanceUntilIdle()
            assertEquals(false, credentials.stored?.hasRestoreKey)

            api.failure = null
            store().restore()
            advanceUntilIdle()
            assertEquals(credentials.stored?.session to "key-2", api.registered.single())
            assertEquals(true, credentials.stored?.hasRestoreKey)
        }

    @Test
    fun anEnrollmentOvertakenBySignOutWritesNothingBack() =
        runTest {
            val sessions = store().apply { restore() }
            api.registerGate = CompletableDeferred()
            sessions.signIn { "token-a" }
            runCurrent()
            assertEquals(listOf("challenge", "register"), api.restoreKeyRequests)

            sessions.signOut()
            api.registerGate?.complete(Unit)
            advanceUntilIdle()
            assertEquals(SessionState.SignedOut(), sessions.state.value)
            assertNull(credentials.stored)
            assertNull(keys.key)
            assertEquals(emptyList<Pair<AuthenticatedSession, String>>(), api.registered)
        }

    @Test
    fun everyWayASessionEndsDeletesThisPhonesKey() =
        runTest {
            val ends =
                listOf<suspend SessionStore.() -> Unit>(
                    { signOut() },
                    { expire(current!!) },
                    { forgetDeletedAccount(current!!) },
                    {
                        api.accounts -= "token-a"
                        store().restore()
                    },
                )
            for (end in ends) {
                api.accounts["token-a"] = ANA
                val sessions = store().apply { restore() }
                sessions.signIn { "token-a" }
                advanceUntilIdle()
                assertTrue(keys.key != null)

                sessions.end()
                assertNull(keys.key)
            }
        }
}

/** Credential Manager's one key per app; it signs a request's challenge as `<key> signs <challenge>`. */
private class FakeRestoreKeys(
    var key: String? = null,
) : RestoreKeys {
    var hasCloudBackup = true
    var signFailure: Exception? = null
    val signed = mutableListOf<String>()
    val created = mutableListOf<Boolean>()

    override suspend fun sign(requestJson: String): String? {
        signFailure?.let { throw it }
        val challenge =
            Json
                .parseToJsonElement(requestJson)
                .jsonObject["challenge"]!!
                .jsonPrimitive.content
        signed += challenge
        return key?.let { "$it signs $challenge" }
    }

    override suspend fun create(
        requestJson: String,
        isCloudBackupEnabled: Boolean,
    ): String {
        created += isCloudBackupEnabled
        if (isCloudBackupEnabled && !hasCloudBackup) throw E2eeUnavailableException("No screen lock")
        return "key-${created.size}".also { key = it }
    }
}
