package com.zoonk.android.feature.account

import com.zoonk.android.data.ApiClients
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

    /** A null field leaves the saved one; a saved name may predate the name's length limit. */
    suspend fun updateProfile(
        session: AuthenticatedSession,
        name: String?,
        username: String?,
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

class LiveAccountApi(
    private val api: ApiClients,
) : AccountApi {
    override suspend fun sendEmailCode(email: String) {
        perform { api.clients(null).sessions.createEmailSignInCode(EmailSignInCodeRequest(email)) }
    }

    override suspend fun emailSession(
        email: String,
        code: String,
        current: AuthenticatedSession?,
    ): String = perform { api.clients(current).sessions.createEmailCodeSession(EmailCodeSessionRequest(code, email)) }.token

    override suspend fun guest(): String = perform { api.clients(null).sessions.createGuestSession() }.token

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
        name: String?,
        username: String?,
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
}
