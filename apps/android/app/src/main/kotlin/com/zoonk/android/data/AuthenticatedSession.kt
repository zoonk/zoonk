package com.zoonk.android.data

/** [localId] is random and not secret, for keys that must tell sessions apart without the token. */
@kotlinx.serialization.Serializable
data class AuthenticatedSession(
    val accountId: String,
    val bearerToken: String,
    val localId: String,
) {
    override fun toString() = "AuthenticatedSession(accountId=$accountId, localId=$localId)"
}

interface SessionSource {
    val current: AuthenticatedSession?

    /** Signs [session] out only if it's still the current one. */
    suspend fun expire(session: AuthenticatedSession)
}
