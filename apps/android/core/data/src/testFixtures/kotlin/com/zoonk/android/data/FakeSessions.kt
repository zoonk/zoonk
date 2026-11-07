package com.zoonk.android.data

import com.zoonk.api.models.RestoreKeySessionResponse
import kotlinx.coroutines.CompletableDeferred

class FakeSession(
    var session: AuthenticatedSession?,
) : SessionSource {
    val expired = mutableListOf<AuthenticatedSession>()
    override val current get() = session

    override suspend fun expire(session: AuthenticatedSession) {
        expired += session
        if (this.session == session) this.session = null
    }
}

class FakeSessionApi : SessionApi {
    val accounts = mutableMapOf<String, String>()
    val revoked = mutableListOf<String>()
    var failure: ApiError? = null
    var gate: CompletableDeferred<Unit>? = null

    /** Every restore-key request, by operation. */
    val restoreKeyRequests = mutableListOf<String>()
    val registered = mutableListOf<Pair<AuthenticatedSession, String>>()

    /** The session each registered key redeems for, by key. */
    val redeemable = mutableMapOf<String, RestoreKeySessionResponse>()
    var redeemFailure: ApiException? = null
    var registerGate: CompletableDeferred<Unit>? = null
    private val challenges = mutableSetOf<String>()

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

    override suspend fun challenge(): String {
        restoreKeyRequests += "challenge"
        failure?.let { throw ApiException(it) }
        return "challenge-${challenges.size}".also { challenges += it }
    }

    override suspend fun registerRestoreKey(
        session: AuthenticatedSession,
        registrationResponseJson: String,
    ) {
        restoreKeyRequests += "register"
        registerGate?.await()
        failure?.let { throw ApiException(it) }
        registered += session to registrationResponseJson
    }

    /** Redeems `<key> signs <challenge>` once per challenge this server issued. */
    override suspend fun restoreKeySession(authenticationResponseJson: String): RestoreKeySessionResponse {
        restoreKeyRequests += "redeem"
        redeemFailure?.let { throw it }
        val (key, challenge) = authenticationResponseJson.split(" signs ")
        if (challenge !in challenges) throw ApiException(ApiError.Unavailable, status = 400)
        challenges -= challenge
        return redeemable[key] ?: throw ApiException(ApiError.Unauthorized)
    }
}

class MemoryCredentials(
    var stored: StoredSession? = null,
) : SessionCredentials {
    var pending: PendingAppleSignIn? = null
    var restoreChecked = false

    override suspend fun pendingApple() = pending

    override suspend fun writePendingApple(pending: PendingAppleSignIn?) {
        this.pending = pending
    }

    override suspend fun read() = stored

    override suspend fun write(session: StoredSession?) {
        stored = session
    }

    override suspend fun restoreChecked() = restoreChecked

    override suspend fun markRestoreChecked() {
        restoreChecked = true
    }
}
