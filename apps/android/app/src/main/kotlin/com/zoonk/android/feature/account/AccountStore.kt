package com.zoonk.android.feature.account

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.toApiError
import com.zoonk.api.ApiJson
import com.zoonk.api.models.AccountDataExport
import com.zoonk.api.models.MeUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlin.coroutines.cancellation.CancellationException

/** Signing in, starting as a guest and setting up the profile, through [SessionStore]. */
class AccountStore(
    private val api: AccountApi,
    private val sessions: SessionStore,
    private val cache: AppCache,
) {
    /** For the first write a visitor makes (a goal, a course, a lesson): it then belongs to a guest. */
    suspend fun startAsGuest(): SignInResult = sessions.signIn(asGuest = true) { api.guest() }

    /** Null when the code went out. */
    suspend fun sendEmailCode(email: String): AccountFailure? =
        try {
            api.sendEmailCode(email)
            null
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            accountFailure(e.toApiError(), (e as? ApiException)?.code)
        }

    suspend fun signInWithEmailCode(
        email: String,
        code: String,
    ): SignInResult = sessions.signIn { current -> api.emailSession(email, code, current) }

    suspend fun signInWithGoogle(idToken: String): SignInResult = sessions.signIn { current -> api.google(idToken, current) }

    suspend fun usernameSuggestion(): String? =
        try {
            sessions.current?.let { api.usernameSuggestion(it) }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            null
        }

    /** Null when it couldn't be checked: saving decides. */
    suspend fun isUsernameAvailable(username: String): Boolean? =
        try {
            api.isUsernameAvailable(username)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            null
        }

    /** Null when saved, or when another session took over meanwhile. */
    suspend fun saveProfile(
        name: String,
        username: String,
    ): AccountFailure? {
        val result =
            cache.mutate(invalidating = setOf(DataDomain.UserSession)) { session ->
                try {
                    session to api.updateProfile(session, name, username)
                } catch (e: ApiException) {
                    if (e.code != "CONFLICT") throw e
                    null
                }
            }
        return when (result) {
            is MutationResult.Done -> {
                val (session, account) = result.value ?: return AccountFailure.UsernameTaken
                sessions.showAccount(session, account)
                null
            }

            is MutationResult.Failed -> {
                if (result.error == ApiError.Network) AccountFailure.Network else AccountFailure.Save
            }

            MutationResult.Obsolete -> {
                null
            }
        }
    }

    /** The learner's data as pretty JSON, nulls kept: everything Zoonk keeps about them. Null when it couldn't be read. */
    suspend fun exportData(): String? {
        val session = sessions.current ?: return null
        return try {
            val data = api.exportData(session)
            withContext(Dispatchers.Default) { ExportJson.encodeToString(AccountDataExport.serializer(), data) }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (e.toApiError() == ApiError.Unauthorized) sessions.expire(session)
            null
        }
    }

    /**
     * Deletes the account the learner sees ([session]). A session too old to delete it answers
     * [AccountDeletion.NeedsCode]: a code to the account's email then proves it's them.
     */
    suspend fun deleteAccount(
        session: AuthenticatedSession,
        email: String,
        code: String? = null,
    ): AccountDeletion {
        if (sessions.current != session) return AccountDeletion.Obsolete
        return try {
            AccountDeletion.Deleted(api.deleteAccount(session, code, email))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            val error = e.toApiError()
            val errorCode = (e as? ApiException)?.code
            when {
                sessions.current != session -> {
                    AccountDeletion.Obsolete
                }

                errorCode == "FORBIDDEN" && code == null -> {
                    AccountDeletion.NeedsCode
                }

                errorCode == "ACCOUNT_DELETION_INVALID_OTP" -> {
                    AccountDeletion.Failed(AccountFailure.WrongCode)
                }

                errorCode == "ACCOUNT_DELETION_OTP_EXPIRED" -> {
                    AccountDeletion.Failed(AccountFailure.CodeExpired)
                }

                errorCode == "ACCOUNT_DELETION_OTP_LOCKED" -> {
                    AccountDeletion.Failed(AccountFailure.CodeLocked)
                }

                error == ApiError.Unauthorized && errorCode == "UNAUTHORIZED" -> {
                    sessions.expire(session)
                    AccountDeletion.Obsolete
                }

                error == ApiError.Network -> {
                    AccountDeletion.Failed(AccountFailure.Network)
                }

                else -> {
                    AccountDeletion.Failed(AccountFailure.Delete)
                }
            }
        }
    }

    /** Null when the code went out. */
    suspend fun sendDeletionCode(
        session: AuthenticatedSession,
        email: String,
    ): AccountFailure? =
        try {
            api.sendDeletionCode(session, email)
            null
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            accountFailure(e.toApiError(), (e as? ApiException)?.code)
        }

    /** After deletion: the session belonged to an account that no longer exists. */
    suspend fun forgetDeletedAccount(session: AuthenticatedSession) = sessions.forgetDeletedAccount(session)
}

sealed interface AccountDeletion {
    /** [appleAuthorizationRevoked] is null without a linked Apple account. */
    data class Deleted(
        val appleAuthorizationRevoked: Boolean?,
    ) : AccountDeletion

    data object NeedsCode : AccountDeletion

    data class Failed(
        val failure: AccountFailure,
    ) : AccountDeletion

    /** Another session took over meanwhile: nothing to show. */
    data object Obsolete : AccountDeletion
}

private val ExportJson =
    Json(from = ApiJson) {
        prettyPrint = true
        explicitNulls = true
    }

/** Main's profile setup asks a new account for a name and a username before anything else. */
val MeUser.needsProfileSetup: Boolean
    get() = name.isBlank() || username == null

enum class AccountFailure {
    InvalidEmail,
    DisposableEmail,
    BotDetected,
    Network,
    RateLimited,
    WrongCode,
    CodeExpired,
    CodeLocked,
    UsernameTaken,
    Save,
    SignIn,
    Delete,
}

fun accountFailure(
    error: ApiError,
    code: String?,
): AccountFailure =
    when {
        error == ApiError.Network -> AccountFailure.Network
        code == "VALIDATION_ERROR" -> AccountFailure.InvalidEmail
        code == "DISPOSABLE_EMAIL_NOT_ALLOWED" -> AccountFailure.DisposableEmail
        code == "BOT_DETECTED" -> AccountFailure.BotDetected
        code == "RATE_LIMIT_EXCEEDED" -> AccountFailure.RateLimited
        code == "EMAIL_SIGN_IN_CODE_INVALID" -> AccountFailure.WrongCode
        code == "EMAIL_SIGN_IN_CODE_EXPIRED" -> AccountFailure.CodeExpired
        code == "EMAIL_SIGN_IN_CODE_LOCKED" -> AccountFailure.CodeLocked
        code == "CONFLICT" -> AccountFailure.UsernameTaken
        else -> AccountFailure.SignIn
    }
