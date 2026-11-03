package com.zoonk.android.feature.account

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.account
import com.zoonk.api.models.AccountDataExport
import com.zoonk.api.models.MeResponse

class FakeAccountApi : AccountApi {
    val codesSent = mutableListOf<String>()
    val signInBearers = mutableListOf<String?>()
    var codeFailure: ApiException? = null
    var takenUsernames = setOf<String>()
    var saveFailure: ApiException? = null
    val saved = mutableListOf<Pair<String, String?>>()
    val deletionCodesSent = mutableListOf<String>()
    val deletions = mutableListOf<String?>()
    var deletionFailures = mutableListOf<ApiException>()
    var appleAuthorizationRevoked: Boolean? = null

    override suspend fun sendEmailCode(email: String) {
        codesSent += email
    }

    override suspend fun emailSession(
        email: String,
        code: String,
        current: AuthenticatedSession?,
    ): String {
        codeFailure?.let { throw it }
        signInBearers += current?.bearerToken
        return "token-b"
    }

    override suspend fun guest(): String = "token-guest"

    override suspend fun google(
        idToken: String,
        current: AuthenticatedSession?,
    ): String {
        signInBearers += current?.bearerToken
        return "token-b"
    }

    override suspend fun usernameSuggestion(session: AuthenticatedSession): String? = "ana_learner"

    override suspend fun isUsernameAvailable(username: String): Boolean = username !in takenUsernames

    override suspend fun updateProfile(
        session: AuthenticatedSession,
        name: String,
        username: String?,
    ): MeResponse {
        saveFailure?.let { throw it }
        saved += name to username
        return account(session.accountId).let { it.copy(user = it.user.copy(name = name, username = username ?: it.user.username)) }
    }

    override suspend fun exportData(session: AuthenticatedSession): AccountDataExport = throw ApiException(ApiError.Unavailable)

    override suspend fun sendDeletionCode(
        session: AuthenticatedSession,
        email: String,
    ) {
        deletionCodesSent += email
    }

    override suspend fun deleteAccount(
        session: AuthenticatedSession,
        emailCode: String?,
        email: String,
    ): Boolean? {
        deletionFailures.removeFirstOrNull()?.let { throw it }
        deletions += emailCode
        return appleAuthorizationRevoked
    }
}
