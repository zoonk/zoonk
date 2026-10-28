package com.zoonk.android.data

/**
 * The signed-in learner a request, a cached value or a draft belongs to. [localId] is a random,
 * non-secret id made when the session is installed, for keys that must tell sessions apart
 * (private image cache keys, logs) without using the token.
 */
data class AuthenticatedSession(
    val accountId: String,
    val bearerToken: String,
    val localId: String,
) {
    override fun toString() = "AuthenticatedSession(accountId=$accountId, localId=$localId)"
}

/** The session the cache follows. `SessionStore` implements it. */
interface SessionSource {
    val current: AuthenticatedSession?

    /** Signs [session] out if it's still the current one, after the API refused its token. */
    suspend fun expire(session: AuthenticatedSession)
}
