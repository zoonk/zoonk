package com.zoonk.android.feature.account

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.perform
import com.zoonk.api.models.AccountDataExport
import com.zoonk.api.models.EmailCodeSessionRequest
import com.zoonk.api.models.EmailSignInCodeRequest
import com.zoonk.api.models.GoogleSessionRequest
import com.zoonk.api.models.MeResponse
import com.zoonk.api.models.MeUpdate
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject

/** The calls that sign in, set up and edit the account. Sign-in calls send [current]'s bearer so a guest's progress moves. */
interface AccountApi {
    suspend fun sendEmailCode(email: String)

    suspend fun emailSession(
        email: String,
        code: String,
        current: AuthenticatedSession?,
    ): String

    suspend fun guest(): String

    suspend fun google(
        idToken: String,
        current: AuthenticatedSession?,
    ): String

    suspend fun usernameSuggestion(session: AuthenticatedSession): String?

    suspend fun isUsernameAvailable(username: String): Boolean

    suspend fun updateProfile(
        session: AuthenticatedSession,
        name: String,
        username: String,
    ): MeResponse

    suspend fun exportData(session: AuthenticatedSession): AccountDataExport

    /** A code to the account's own email, proving it's the learner when the session is too old to delete the account. */
    suspend fun sendDeletionCode(
        session: AuthenticatedSession,
        email: String,
    )

    /** Whether Apple's authorization was revoked; null without a linked Apple account. */
    suspend fun deleteAccount(
        session: AuthenticatedSession,
        emailCode: String?,
        email: String,
    ): Boolean?
}

/** The request a bot-checked call proves, as App Attest's client data names it. */
sealed interface BotProofRequest {
    data object Guest : BotProofRequest

    data class EmailCode(
        val email: String,
    ) : BotProofRequest

    data class EmailSession(
        val email: String,
        val code: String,
    ) : BotProofRequest
}

/** A Play Integrity token and the single-use challenge its request hash covers. */
private data class PlayIntegrityProof(
    val token: String,
    val challenge: String,
)

class LiveAccountApi(
    private val api: ApiClients,
    private val integrity: IntegrityTokens?,
) : AccountApi {
    override suspend fun sendEmailCode(email: String) {
        val proof = proof(BotProofRequest.EmailCode(email))
        perform {
            api.clients(null).sessions.createEmailSignInCode(
                EmailSignInCodeRequest(email),
                xPlayIntegrityChallenge = proof?.challenge,
                xPlayIntegrityToken = proof?.token,
            )
        }
    }

    override suspend fun emailSession(
        email: String,
        code: String,
        current: AuthenticatedSession?,
    ): String {
        val proof = proof(BotProofRequest.EmailSession(email, code))
        return perform {
            api.clients(current).sessions.createEmailCodeSession(
                EmailCodeSessionRequest(code, email),
                xPlayIntegrityChallenge = proof?.challenge,
                xPlayIntegrityToken = proof?.token,
            )
        }.token
    }

    override suspend fun guest(): String {
        val proof = proof(BotProofRequest.Guest)
        return perform {
            api.clients(null).sessions.createGuestSession(xPlayIntegrityChallenge = proof?.challenge, xPlayIntegrityToken = proof?.token)
        }.token
    }

    override suspend fun google(
        idToken: String,
        current: AuthenticatedSession?,
    ): String = perform { api.clients(current).sessions.createGoogleSession(GoogleSessionRequest(idToken)) }.token

    override suspend fun usernameSuggestion(session: AuthenticatedSession): String? =
        perform { api.clients(session).account.getCurrentUserUsernameSuggestion() }.username

    override suspend fun isUsernameAvailable(username: String): Boolean =
        perform { api.clients(null).users.getUsernameAvailability(username) }.isAvailable

    override suspend fun updateProfile(
        session: AuthenticatedSession,
        name: String,
        username: String,
    ): MeResponse = perform { api.clients(session).account.updateCurrentUser(MeUpdate(name = name, username = username)) }

    override suspend fun exportData(session: AuthenticatedSession): AccountDataExport =
        perform { api.clients(session).account.exportCurrentUserData() }

    override suspend fun sendDeletionCode(
        session: AuthenticatedSession,
        email: String,
    ) = perform { api.clients(session).sessions.createEmailSignInCode(EmailSignInCodeRequest(email)) }

    override suspend fun deleteAccount(
        session: AuthenticatedSession,
        emailCode: String?,
        email: String,
    ): Boolean? {
        val body =
            buildJsonObject {
                if (emailCode != null) {
                    putJsonObject("emailCredentials") {
                        put("email", email)
                        put("otp", emailCode)
                    }
                }
            }
        return perform { api.clients(session).account.deleteCurrentUser(body) }.appleAuthorizationRevoked
    }

    /** Without a proof the request goes anyway, and the server decides as it does for iOS. */
    private suspend fun proof(request: BotProofRequest): PlayIntegrityProof? {
        val integrity = integrity ?: return null
        val challenge =
            try {
                perform { api.clients(null).sessions.createAppAttestChallenge() }.challenge
            } catch (e: ApiException) {
                return null
            }
        return integrity.token(request.requestHash(challenge))?.let { PlayIntegrityProof(it, challenge) }
    }
}
