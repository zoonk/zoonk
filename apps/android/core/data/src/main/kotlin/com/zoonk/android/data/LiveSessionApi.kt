package com.zoonk.android.data

import com.zoonk.api.models.MeResponse
import com.zoonk.api.models.RestoreKeyRequest
import com.zoonk.api.models.RestoreKeySessionRequest
import com.zoonk.api.models.RestoreKeySessionResponse

class LiveSessionApi(
    private val api: ApiClients,
) : SessionApi {
    override suspend fun currentUser(token: String): MeResponse = perform { api.bearer(token).account.getCurrentUser() }

    override suspend fun apple(
        request: com.zoonk.api.models.AppleSessionRequest,
        guest: AuthenticatedSession?,
    ): String = perform { api.clients(guest).sessions.createAppleSession(request) }.token

    override suspend fun revoke(token: String) = perform { api.bearer(token).sessions.deleteCurrentSession() }

    override suspend fun challenge(): String = perform { api.clients(null).sessions.createAppAttestChallenge() }.challenge

    override suspend fun registerRestoreKey(
        session: AuthenticatedSession,
        registrationResponseJson: String,
    ) = perform { api.clients(session).sessions.createRestoreKey(RestoreKeyRequest(registrationResponseJson)) }

    override suspend fun restoreKeySession(authenticationResponseJson: String): RestoreKeySessionResponse =
        perform { api.clients(null).sessions.createRestoreKeySession(RestoreKeySessionRequest(authenticationResponseJson)) }
}
