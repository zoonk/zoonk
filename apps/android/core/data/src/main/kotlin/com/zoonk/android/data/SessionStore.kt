package com.zoonk.android.data

import androidx.credentials.exceptions.restorecredential.E2eeUnavailableException
import com.zoonk.api.models.MeResponse
import com.zoonk.api.models.RestoreKeySessionResponse
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.IOException
import java.security.SecureRandom
import java.util.Base64
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

interface SessionApi {
    suspend fun currentUser(token: String): MeResponse

    suspend fun revoke(token: String)

    suspend fun apple(
        request: com.zoonk.api.models.AppleSessionRequest,
        guest: AuthenticatedSession?,
    ): String

    /** Single-use for five minutes, and already unpadded base64url as WebAuthn wants. */
    suspend fun challenge(): String

    suspend fun registerRestoreKey(
        session: AuthenticatedSession,
        registrationResponseJson: String,
    )

    /** [ApiError.Unauthorized] only when the key itself can't sign in again; other refusals may pass on a retry. */
    suspend fun restoreKeySession(authenticationResponseJson: String): RestoreKeySessionResponse
}

interface SessionCredentials {
    suspend fun read(): StoredSession?

    suspend fun write(session: StoredSession?)

    suspend fun pendingApple(): PendingAppleSignIn?

    suspend fun writePendingApple(pending: PendingAppleSignIn?)

    /** Whether this device has looked for a restore key, which it does only on its first launch. */
    suspend fun restoreChecked(): Boolean

    suspend fun markRestoreChecked()
}

@kotlinx.serialization.Serializable
data class StoredSession(
    val session: AuthenticatedSession,
    val isGuest: Boolean = false,
    val hasRestoreKey: Boolean = false,
)

sealed interface SessionState {
    data object Restoring : SessionState

    /** [sessionEnded] when the API refused the session rather than the learner signing out. */
    data class SignedOut(
        val sessionEnded: Boolean = false,
    ) : SessionState

    data class SignedIn(
        val session: AuthenticatedSession,
        val account: MeResponse,
        val isGuest: Boolean,
    ) : SessionState

    /** The stored session couldn't be checked; [SessionStore.retryRestore] keeps its token. */
    data object Unavailable : SessionState
}

sealed interface SignInResult {
    data object SignedIn : SignInResult

    /** [code] is the API's error code, for the screen's message. */
    data class Failed(
        val error: ApiError,
        val code: String? = null,
    ) : SignInResult

    /** Another sign-in or a sign-out finished first: nothing changed and the new token was revoked. */
    data object Obsolete : SignInResult
}

sealed interface SignOutResult {
    data object SignedOut : SignOutResult

    data class Failed(
        val error: ApiError,
    ) : SignOutResult
}

/**
 * The only writer of the session. Stored identities can start reads during validation;
 * account screens and new credentials wait for `getCurrentUser`. [onChange] runs on the main thread right after each change is published, under the drafts
 * lock.
 */
class SessionStore(
    private val api: SessionApi,
    private val credentials: SessionCredentials,
    private val drafts: DraftStore,
    private val onChange: (previous: AuthenticatedSession?, next: AuthenticatedSession?) -> Unit,
    private val clearCredentialState: suspend () -> Unit,
    private val restoreKeys: RestoreKeys = RestoreKeys.None,
    private val appleClientId: String = "",
    private val appleReflectorUrl: String = "",
    private val now: () -> Long = System::currentTimeMillis,
    private val newSecret: () -> String = ::randomSecret,
    private val newLocalId: () -> String = { UUID.randomUUID().toString() },
) : SessionSource {
    private val mutableState = MutableStateFlow<SessionState>(SessionState.Restoring)
    val state: StateFlow<SessionState> = mutableState.asStateFlow()

    private var didRestore = false
    private var restoring: StoredSession? = null
    private val signInMutex = Mutex()
    private val restoreMutex = Mutex()

    override val current: AuthenticatedSession?
        get() = (mutableState.value as? SessionState.SignedIn)?.session ?: restoring?.session

    private val isGuest: Boolean
        get() = (mutableState.value as? SessionState.SignedIn)?.isGuest ?: restoring?.isGuest ?: false

    suspend fun restore() =
        restoreMutex.withLock {
            if (didRestore) return@withLock
            didRestore = true
            validateStoredSession()
        }

    suspend fun retryRestore() =
        restoreMutex.withLock {
            if (mutableState.value != SessionState.Unavailable) return@withLock
            mutableState.value = SessionState.Restoring
            validateStoredSession()
        }

    /**
     * [obtain] gets the current session so the sign-in call can send its bearer: the server then
     * moves a guest's progress to the account, and the guest's drafts move too.
     */
    suspend fun signIn(
        asGuest: Boolean = false,
        obtain: suspend (current: AuthenticatedSession?) -> String,
    ): SignInResult {
        val started = current
        val wasGuest = isGuest
        val token: String
        val account: MeResponse
        try {
            token = obtain(started)
            account = api.currentUser(token)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            return SignInResult.Failed(e.toApiError(), (e as? ApiException)?.code)
        }
        return signInMutex.withLock { install(token, account, started, wasGuest, asGuest) }
    }

    suspend fun startAppleSignIn(
        clientId: String = appleClientId,
        reflectorUrl: String = appleReflectorUrl,
    ): String =
        signInMutex.withLock {
            require(clientId.isNotBlank() && reflectorUrl.isNotBlank())
            check(mutableState.value is SessionState.SignedIn || mutableState.value is SessionState.SignedOut)
            val pending =
                PendingAppleSignIn(
                    newSecret(),
                    newSecret(),
                    current,
                    isGuest,
                    now(),
                )
            credentials.writePendingApple(pending)
            appleAuthorizeUrl(clientId, reflectorUrl, pending)
        }

    suspend fun cancelAppleSignIn(state: String) =
        signInMutex.withLock {
            if (credentials.pendingApple()?.state == state) credentials.writePendingApple(null)
        }

    suspend fun completeAppleSignIn(callback: AppleCallback): SignInResult =
        signInMutex.withLock {
            val pending = credentials.pendingApple() ?: return@withLock SignInResult.Obsolete
            if (pending.state != callback.state) return@withLock SignInResult.Obsolete
            credentials.writePendingApple(null)
            if (callback.error != null || now() - pending.startedAt !in 0 until 600_000 || current != pending.startedFrom) {
                return@withLock SignInResult.Obsolete
            }
            val request = callback.request(pending.rawNonce) ?: return@withLock SignInResult.Obsolete
            val token: String
            try {
                token = api.apple(request, pending.startedFrom.takeIf { pending.isGuest })
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                return@withLock SignInResult.Failed(e.toApiError(), (e as? ApiException)?.code)
            }
            val account =
                try {
                    api.currentUser(token)
                } catch (e: CancellationException) {
                    revokeQuietly(token)
                    throw e
                } catch (e: Exception) {
                    revokeQuietly(token)
                    return@withLock SignInResult.Failed(e.toApiError(), (e as? ApiException)?.code)
                }
            install(token, account, pending.startedFrom, pending.isGuest, false)
        }

    private suspend fun install(
        token: String,
        account: MeResponse,
        started: AuthenticatedSession?,
        wasGuest: Boolean,
        asGuest: Boolean,
    ): SignInResult {
        var installed = false
        drafts.follow {
            if (current != started) return@follow null
            val session = AuthenticatedSession(account.user.id.toString(), token, newLocalId())
            try {
                credentials.writePendingApple(null)
                credentials.write(StoredSession(session, asGuest))
                credentials.markRestoreChecked()
            } catch (_: IOException) {
                // A failed credential write keeps this session in memory until process death.
            }
            publish(SessionState.SignedIn(session, account, asGuest))
            installed = true
            val upgradesGuest = wasGuest && started?.accountId != session.accountId
            DraftsChange(next = session.accountId, moveFrom = started?.accountId?.takeIf { upgradesGuest })
        }
        if (installed) return SignInResult.SignedIn
        revokeQuietly(token)
        return SignInResult.Obsolete
    }

    /** A profile write's answer, shown only while [session] is still the one signed in. */
    fun showAccount(
        session: AuthenticatedSession,
        account: MeResponse,
    ) {
        val signedIn = mutableState.value as? SessionState.SignedIn ?: return
        if (signedIn.session == session) mutableState.value = signedIn.copy(account = account)
    }

    override suspend fun expire(session: AuthenticatedSession) = leave(session, sessionEnded = true)

    /** A request the deletion refused may have signed [session] out already; its drafts go either way. */
    suspend fun forgetDeletedAccount(session: AuthenticatedSession) =
        drafts.follow {
            if (current == session) {
                signOutLocally(sessionEnded = false, deleted = true)
            } else {
                DraftsChange(next = current?.accountId, forget = session.accountId)
            }
        }

    /** Keeps the session when the server can't end it, unless the server refused its token. */
    suspend fun signOut(): SignOutResult {
        val session = current ?: return SignOutResult.SignedOut
        try {
            api.revoke(session.bearerToken)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            val error = e.toApiError()
            if (error != ApiError.Unauthorized) return SignOutResult.Failed(error)
        }
        leave(session, sessionEnded = false)
        return SignOutResult.SignedOut
    }

    private suspend fun leave(
        session: AuthenticatedSession,
        sessionEnded: Boolean,
    ) {
        drafts.follow {
            if (current != session) return@follow null
            signOutLocally(sessionEnded)
        }
    }

    private suspend fun validateStoredSession() {
        val stored =
            try {
                credentials.read()
            } catch (e: IOException) {
                null
            }
        if (stored == null) return restoreFromKey()
        if (mutableState.value != SessionState.Restoring) return
        if (restoring == null) {
            restoring = stored
            onChange(null, stored.session)
        }
        val identity = stored.session
        val account =
            try {
                api.currentUser(identity.bearerToken)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (current != identity || mutableState.value != SessionState.Restoring) return
                if (e.toApiError() == ApiError.Unauthorized) {
                    drafts.follow {
                        if (current != identity) return@follow null
                        signOutLocally(sessionEnded = true)
                    }
                } else {
                    mutableState.value = SessionState.Unavailable
                }
                return
            }
        drafts.follow {
            if (mutableState.value != SessionState.Restoring || current != identity) return@follow null
            if (account.user.id.toString() != identity.accountId) return@follow signOutLocally(sessionEnded = true)
            val session = identity
            publish(SessionState.SignedIn(session, account, stored.isGuest))
            DraftsChange(next = session.accountId)
        }
    }

    /**
     * A new phone's first launch, where Google may have moved the old phone's restore key: the API
     * trades it for a fresh session of the same learner. Without a key nothing reaches the network.
     */
    private suspend fun restoreFromKey() {
        val firstLaunch =
            try {
                !credentials.restoreChecked()
            } catch (e: IOException) {
                false
            }
        if (!firstLaunch) return endRestore()
        val probe =
            try {
                restoreKeys.sign(restoreKeyRequest(newSecret()))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                return endRestore()
            }
        if (probe == null) return endRestore(checked = true)
        val restored: RestoreKeySessionResponse
        try {
            val signed = restoreKeys.sign(restoreKeyRequest(api.challenge())) ?: return endRestore(checked = true)
            restored = api.restoreKeySession(signed)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            val refused = e.toApiError() == ApiError.Unauthorized || (e as? ApiException)?.status == 403
            return if (refused) endRestore(checked = true, refused = true) else showUnavailable()
        }
        val account =
            try {
                api.currentUser(restored.token)
            } catch (e: CancellationException) {
                revokeQuietly(restored.token)
                throw e
            } catch (e: Exception) {
                revokeQuietly(restored.token)
                return showUnavailable()
            }
        signInMutex.withLock { install(restored.token, account, started = null, wasGuest = false, asGuest = restored.isGuest) }
    }

    /** [checked] once this device has its answer, so later launches don't look for a key; a [refused] key is deleted. */
    private suspend fun endRestore(
        checked: Boolean = false,
        refused: Boolean = false,
    ) = drafts.follow {
        if (mutableState.value != SessionState.Restoring) return@follow null
        if (refused) clearCredentialState()
        if (checked) {
            try {
                credentials.markRestoreChecked()
            } catch (e: IOException) {
                // The next launch looks again.
            }
        }
        publish(SessionState.SignedOut())
        DraftsChange(next = null)
    }

    private fun showUnavailable() {
        if (mutableState.value == SessionState.Restoring) mutableState.value = SessionState.Unavailable
    }

    /**
     * Runs for the app's life: each signed-in session gets this device's restore key once, so the
     * learner's next phone starts signed in. A failure tries again on the next validated launch.
     */
    suspend fun keepRestoreKeys() {
        state
            .map { (it as? SessionState.SignedIn)?.session }
            .distinctUntilChanged()
            .collectLatest { session -> session?.let { enrollRestoreKey(it) } }
    }

    private suspend fun enrollRestoreKey(session: AuthenticatedSession) {
        val stored =
            try {
                credentials.read()
            } catch (e: IOException) {
                return
            }
        if (stored?.session != session || stored.hasRestoreKey) return
        try {
            val request = restoreKeyCreation(api.challenge(), userId = newSecret())
            val registration =
                try {
                    restoreKeys.create(request, isCloudBackupEnabled = true)
                } catch (e: E2eeUnavailableException) {
                    // Without a Google account or a screen lock there's no encrypted cloud backup; a phone-to-phone transfer still moves the key.
                    restoreKeys.create(request, isCloudBackupEnabled = false)
                } ?: return
            api.registerRestoreKey(session, registration)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            return
        }
        drafts.follow {
            if (current != session) return@follow null
            try {
                credentials.write(stored.copy(hasRestoreKey = true))
            } catch (e: IOException) {
                // The next validated launch registers a new key.
            }
            null
        }
    }

    /** Nobody signs in to a deleted account or a guest again, so their drafts go with them. */
    private suspend fun signOutLocally(
        sessionEnded: Boolean,
        deleted: Boolean = false,
    ): DraftsChange {
        val forgotten = current?.accountId?.takeIf { deleted || isGuest }
        try {
            credentials.writePendingApple(null)
            credentials.write(null)
        } catch (e: IOException) {
            // The next launch's restore finds the token refused and clears it.
        }
        val hadSession = current != null
        publish(SessionState.SignedOut(sessionEnded))
        if (hadSession) clearCredentialState()
        return DraftsChange(next = null, forget = forgotten)
    }

    private fun publish(next: SessionState) {
        val previous = current
        restoring = null
        mutableState.value = next
        val session = (next as? SessionState.SignedIn)?.session
        if (previous != session) onChange(previous, session)
    }

    private suspend fun revokeQuietly(token: String) {
        try {
            api.revoke(token)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // The server ends unused sessions when they expire.
        }
    }
}

internal fun randomSecret(): String =
    Base64.getUrlEncoder().withoutPadding().encodeToString(
        ByteArray(32).also {
            SecureRandom().nextBytes(it)
        },
    )
