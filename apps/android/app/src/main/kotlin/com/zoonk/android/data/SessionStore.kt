package com.zoonk.android.data

import com.zoonk.api.models.MeResponse
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.IOException
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

/** The calls `SessionStore` makes itself: validating a token and revoking it. */
interface SessionApi {
    /** The account [token] signs in (`getCurrentUser`). */
    suspend fun currentUser(token: String): MeResponse

    /** Ends [token]'s session on the server (`deleteCurrentSession`). */
    suspend fun revoke(token: String)
}

/** Where the bearer token is kept between launches: DataStore encrypted with Tink in the app. */
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
    /** Checking the stored session with the API before showing any account data. */
    data object Restoring : SessionState

    data object SignedOut : SessionState

    data class SignedIn(
        val session: AuthenticatedSession,
        val account: MeResponse,
        val isGuest: Boolean,
    ) : SessionState

    /** The stored session couldn't be checked (offline, the API down). [SessionStore.retryRestore] keeps it. */
    data object Unavailable : SessionState
}

sealed interface SignInResult {
    data object SignedIn : SignInResult

    /** The sign-in failed; [code] is the API's error code for the screen's message. */
    data class Failed(
        val error: ApiError,
        val code: String? = null,
    ) : SignInResult

    /** Another sign-in or a sign-out finished first; nothing changed and the new token was revoked. */
    data object Obsolete : SignInResult
}

sealed interface SignOutResult {
    data object SignedOut : SignOutResult

    /** The server couldn't end the session; the learner stays signed in and can retry. */
    data class Failed(
        val error: ApiError,
    ) : SignOutResult
}

/**
 * Owns the signed-in session, the only writer of it. It restores the stored token at launch only
 * after `getCurrentUser` accepts it, stores a new token only after `getCurrentUser` succeeds with
 * it, and on every change publishes the new session and lets the cache, drafts and private images
 * follow, under the drafts lock, in one main-thread call.
 *
 * @param onChange runs right after a change is published, on the main thread: the cache follows
 *   the session and the previous session's private images are forgotten.
 * @param clearCredentialState clears Credential Manager's state on sign-out, so the next sign-in
 *   asks which account to use.
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

    /** Restores the stored session once at launch, validating it before showing account data. */
    suspend fun restore() {
        if (didRestore) return
        didRestore = true
        validateStoredSession()
    }

    /** Checks the stored session again after [SessionState.Unavailable], keeping its token. */
    suspend fun retryRestore() {
        if (mutableState.value != SessionState.Unavailable) return
        mutableState.value = SessionState.Restoring
        validateStoredSession()
    }

    /**
     * Signs in with the token [obtain] returns. [obtain] receives the current session so the
     * sign-in call can carry its bearer: a guest's progress then moves to the account, and so do
     * its drafts. Pass [asGuest] for a guest session. The token is validated with `getCurrentUser`
     * before it's stored; if another sign-in or a sign-out finished meanwhile, it's revoked.
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

    /**
     * Signs [session] out on this device if it's still the current one: after the API refused its
     * token, or after the account was deleted. Its token, drafts and private images go.
     */
    override suspend fun expire(session: AuthenticatedSession) {
        drafts.follow {
            if (current != session) return@follow null
            signOutLocally()
        }
    }

    /**
     * Ends the session on the server, then forgets it here. If the server can't be reached the
     * learner stays signed in and sees the error; a refused token signs out anyway.
     */
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
