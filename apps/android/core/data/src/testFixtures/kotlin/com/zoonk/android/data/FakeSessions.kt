package com.zoonk.android.data

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
}

class MemoryCredentials(
    var stored: StoredSession? = null,
) : SessionCredentials {
    var pending: PendingAppleSignIn? = null

    override suspend fun pendingApple() = pending

    override suspend fun writePendingApple(pending: PendingAppleSignIn?) {
        this.pending = pending
    }

    override suspend fun read() = stored

    override suspend fun write(session: StoredSession?) {
        stored = session
    }
}
