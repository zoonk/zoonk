package com.zoonk.android.data

import com.zoonk.api.models.MeResponse
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.IOException
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

interface SessionApi {
    suspend fun currentUser(token: String): MeResponse

    suspend fun revoke(token: String)

    suspend fun apple(
        request: com.zoonk.api.models.AppleSessionRequest,
        guest: AuthenticatedSession?,
    ): String
}

interface SessionCredentials {
    suspend fun read(): StoredSession?

    suspend fun write(session: StoredSession?)

    suspend fun pendingApple(): PendingAppleSignIn?

    suspend fun writePendingApple(pending: PendingAppleSignIn?)
}

@kotlinx.serialization.Serializable
data class StoredSession(
    val session: AuthenticatedSession,
    val isGuest: Boolean = false,
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
    private val appleClientId: String = "",
    private val appleReflectorUrl: String = "",
    private val now: () -> Long = System::currentTimeMillis,
    private val newSecret: () -> String = ::appleSecret,
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
        val wasGuest = (mutableState.value as? SessionState.SignedIn)?.isGuest ?: restoring?.isGuest ?: false
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
                    (mutableState.value as? SessionState.SignedIn)?.isGuest == true,
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

    override suspend fun expire(session: AuthenticatedSession) = leave(session, sessionEnded = true)

    suspend fun forgetDeletedAccount(session: AuthenticatedSession) = leave(session, sessionEnded = false)

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
        if (stored == null) {
            drafts.follow {
                if (mutableState.value != SessionState.Restoring) return@follow null
                publish(SessionState.SignedOut())
                DraftsChange(next = null)
            }
            return
        }
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

    private suspend fun signOutLocally(sessionEnded: Boolean): DraftsChange {
        try {
            credentials.writePendingApple(null)
            credentials.write(null)
        } catch (e: IOException) {
            // The next launch's restore finds the token refused and clears it.
        }
        val hadSession = current != null
        publish(SessionState.SignedOut(sessionEnded))
        if (hadSession) clearCredentialState()
        return DraftsChange(next = null)
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
