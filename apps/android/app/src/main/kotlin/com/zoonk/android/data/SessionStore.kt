package com.zoonk.android.data

import com.zoonk.api.models.MeResponse
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.IOException
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

interface SessionApi {
    suspend fun currentUser(token: String): MeResponse

    suspend fun revoke(token: String)
}

interface SessionCredentials {
    suspend fun read(): StoredSession?

    suspend fun write(session: StoredSession?)
}

@kotlinx.serialization.Serializable
data class StoredSession(
    val token: String,
    val isGuest: Boolean = false,
)

sealed interface SessionState {
    data object Restoring : SessionState

    data object SignedOut : SessionState

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
 * The only writer of the session. A token is shown or stored only after `getCurrentUser` accepts
 * it. [onChange] runs on the main thread right after each change is published, under the drafts
 * lock.
 */
class SessionStore(
    private val api: SessionApi,
    private val credentials: SessionCredentials,
    private val drafts: DraftStore,
    private val onChange: (previous: AuthenticatedSession?, next: AuthenticatedSession?) -> Unit,
    private val clearCredentialState: suspend () -> Unit,
    private val newLocalId: () -> String = { UUID.randomUUID().toString() },
) : SessionSource {
    private val mutableState = MutableStateFlow<SessionState>(SessionState.Restoring)
    val state: StateFlow<SessionState> = mutableState.asStateFlow()

    private var didRestore = false

    override val current: AuthenticatedSession?
        get() = (mutableState.value as? SessionState.SignedIn)?.session

    suspend fun restore() {
        if (didRestore) return
        didRestore = true
        validateStoredSession()
    }

    suspend fun retryRestore() {
        if (mutableState.value != SessionState.Unavailable) return
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
        val started = mutableState.value as? SessionState.SignedIn
        val token: String
        val account: MeResponse
        try {
            token = obtain(started?.session)
            account = api.currentUser(token)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            return SignInResult.Failed(e.toApiError(), (e as? ApiException)?.code)
        }
        var installed = false
        drafts.follow {
            if (current != started?.session) return@follow null
            credentials.write(StoredSession(token, asGuest))
            val session = AuthenticatedSession(account.user.id.toString(), token, newLocalId())
            publish(SessionState.SignedIn(session, account, asGuest))
            installed = true
            val upgradesGuest = started?.isGuest == true && started.session.accountId != session.accountId
            DraftsChange(next = session.accountId, moveFrom = started?.session?.accountId?.takeIf { upgradesGuest })
        }
        if (installed) return SignInResult.SignedIn
        revokeQuietly(token)
        return SignInResult.Obsolete
    }

    /** Only if [session] is still current; also for after the account was deleted. */
    override suspend fun expire(session: AuthenticatedSession) {
        drafts.follow {
            if (current != session) return@follow null
            signOutLocally()
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
        expire(session)
        return SignOutResult.SignedOut
    }

    private suspend fun validateStoredSession() {
        val stored =
            try {
                credentials.read()
            } catch (e: IOException) {
                null
            }
        if (stored == null) {
            drafts.follow { signOutLocally() }
            return
        }
        val account =
            try {
                api.currentUser(stored.token)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (e.toApiError() == ApiError.Unauthorized) {
                    drafts.follow { signOutLocally() }
                } else {
                    mutableState.value = SessionState.Unavailable
                }
                return
            }
        drafts.follow {
            if (mutableState.value != SessionState.Restoring) return@follow null
            val session = AuthenticatedSession(account.user.id.toString(), stored.token, newLocalId())
            publish(SessionState.SignedIn(session, account, stored.isGuest))
            DraftsChange(next = session.accountId)
        }
    }

    private suspend fun signOutLocally(): DraftsChange {
        try {
            credentials.write(null)
        } catch (e: IOException) {
            // The next launch's restore finds the token refused and clears it.
        }
        val hadSession = current != null
        publish(SessionState.SignedOut)
        if (hadSession) clearCredentialState()
        return DraftsChange(next = null)
    }

    private fun publish(next: SessionState) {
        val previous = current
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
