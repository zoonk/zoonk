package com.zoonk.android.data

import com.zoonk.android.feature.account.BotProofRequest
import com.zoonk.android.feature.account.IntegrityTokens
import com.zoonk.android.feature.account.proof
import com.zoonk.api.models.MeResponse
import com.zoonk.api.models.RestoreKeyRequest
import com.zoonk.api.models.RestoreKeySessionRequest
import com.zoonk.api.models.RestoreKeySessionResponse
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class LiveSessionApi(
    private val api: ApiClients,
    private val integrity: IntegrityTokens?,
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
    ) {
        val credentialId =
            Json
                .parseToJsonElement(registrationResponseJson)
                .jsonObject
                .getValue("id")
                .jsonPrimitive.content
        val proof = integrity?.proof(api, BotProofRequest.RestoreKey(credentialId))
        perform {
            api.clients(session).sessions.createRestoreKey(
                RestoreKeyRequest(registrationResponseJson),
                xPlayIntegrityChallenge = proof?.challenge,
                xPlayIntegrityToken = proof?.token,
            )
        }
    }

    override suspend fun restoreKeySession(authenticationResponseJson: String): RestoreKeySessionResponse =
        perform { api.clients(null).sessions.createRestoreKeySession(RestoreKeySessionRequest(authenticationResponseJson)) }
}
