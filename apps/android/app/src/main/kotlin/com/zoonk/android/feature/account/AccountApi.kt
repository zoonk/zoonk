package com.zoonk.android.feature.account

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.perform
import com.zoonk.android.data.withBearer
import com.zoonk.api.ApiServices
import com.zoonk.api.models.AccountDataExport
import com.zoonk.api.models.EmailCodeSessionRequest
import com.zoonk.api.models.EmailSignInCodeRequest
import com.zoonk.api.models.GoogleSessionRequest
import com.zoonk.api.models.MeResponse
import com.zoonk.api.models.MeUpdate
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import okhttp3.OkHttpClient

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

/**
 * Headers proving a bot-checked request comes from the app (Play Integrity, ARCHITECTURE.md
 * section 4). Empty when there's no proof: the request goes without it and the server decides.
 */
fun interface BotProof {
    suspend fun headers(request: BotProofRequest): Map<String, String>
}

/** Until the server accepts Play Integrity; local development skips the bot check. */
object NoBotProof : BotProof {
    override suspend fun headers(request: BotProofRequest): Map<String, String> = emptyMap()
}

class LiveAccountApi(
    private val api: ApiClients,
    private val botProof: BotProof,
) : AccountApi {
    override suspend fun sendEmailCode(email: String) =
        perform {
            proven(BotProofRequest.EmailCode(email), null).sessions.createEmailSignInCode(EmailSignInCodeRequest(email))
        }

    override suspend fun emailSession(
        email: String,
        code: String,
        current: AuthenticatedSession?,
    ): String =
        perform {
            proven(BotProofRequest.EmailSession(email, code), current).sessions.createEmailCodeSession(EmailCodeSessionRequest(code, email))
        }.token

    override suspend fun guest(): String = perform { proven(BotProofRequest.Guest, null).sessions.createGuestSession() }.token

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

    private suspend fun proven(
        request: BotProofRequest,
        current: AuthenticatedSession?,
    ): ApiServices {
        val headers = botProof.headers(request)
        if (headers.isEmpty()) return api.clients(current)
        val http = current?.let { api.http.withBearer(it.bearerToken) } ?: api.http
        return ApiServices(api.baseUrl, http.withHeaders(headers))
    }
}

private fun OkHttpClient.withHeaders(headers: Map<String, String>): OkHttpClient =
    newBuilder()
        .addInterceptor { chain ->
            val request = chain.request().newBuilder()
            headers.forEach { (name, value) -> request.header(name, value) }
            chain.proceed(request.build())
        }.build()
