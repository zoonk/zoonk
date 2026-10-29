package com.zoonk.android.feature.account

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.SavedStateHandleSaveableApi
import androidx.lifecycle.viewmodel.compose.saveable
import com.zoonk.android.data.AppleCallback
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.SignInResult
import kotlinx.coroutines.launch
import kotlin.coroutines.cancellation.CancellationException

enum class SignInWork { Google, Apple, SendCode, CheckCode, Resend }

enum class ResendStatus { Sent, RateLimited, Failed }

/** Main's central login: Google, Apple, then an email code; a guest signing in keeps its progress. */
@OptIn(SavedStateHandleSaveableApi::class)
class SignInViewModel(
    private val account: AccountStore,
    private val sessions: SessionStore,
    handle: SavedStateHandle,
) : ViewModel() {
    var email by handle.saveable { mutableStateOf("") }
        private set
    var codeSentTo by handle.saveable { mutableStateOf<String?>(null) }
        private set
    var code by handle.saveable { mutableStateOf("") }
        private set
    var work by mutableStateOf<SignInWork?>(null)
        private set
    var failure by mutableStateOf<AccountFailure?>(null)
        private set
    var resend by mutableStateOf<ResendStatus?>(null)
        private set

    /** Apple's answer came back but no longer matched a sign-in this app started. */
    var appleExpired by mutableStateOf(false)
        private set

    /** An expired or locked code can't be tried again; only a new one helps. */
    val needsNewCode get() = failure == AccountFailure.CodeExpired || failure == AccountFailure.CodeLocked

    fun onEmailChange(value: String) {
        email = value
        failure = null
    }

    fun sendCode() {
        val normalized = email.trim().lowercase()
        if (work != null) return
        if (!isEmailLike(normalized)) {
            failure = AccountFailure.InvalidEmail
            return
        }
        run(SignInWork.SendCode) {
            failure = account.sendEmailCode(normalized)
            if (failure == null) {
                codeSentTo = normalized
                code = ""
                resend = null
            }
        }
    }

    fun changeEmail() {
        if (work != null) return
        codeSentTo = null
        code = ""
        failure = null
        resend = null
    }

    /** A full code is checked at once, as main's code boxes submit when filled. */
    fun onCodeChange(value: String) {
        if (needsNewCode) return
        code = value.filter(Char::isDigit).take(CODE_LENGTH)
        if (failure == AccountFailure.WrongCode) failure = null
        if (code.length == CODE_LENGTH) checkCode()
    }

    fun checkCode() {
        val email = codeSentTo ?: return
        if (work != null || needsNewCode) return
        if (code.length != CODE_LENGTH) {
            failure = AccountFailure.WrongCode
            return
        }
        run(SignInWork.CheckCode) { show(account.signInWithEmailCode(email, code)) }
    }

    fun resendCode() {
        val email = codeSentTo ?: return
        if (work != null) return
        run(SignInWork.Resend) {
            resend =
                when (account.sendEmailCode(email)) {
                    null -> ResendStatus.Sent
                    AccountFailure.RateLimited -> ResendStatus.RateLimited
                    else -> ResendStatus.Failed
                }
            if (resend == ResendStatus.Sent) {
                code = ""
                failure = null
            }
        }
    }

    fun startGoogle() {
        work = SignInWork.Google
        failure = null
        appleExpired = false
    }

    fun finishGoogle(token: GoogleIdToken) {
        when (token) {
            GoogleIdToken.Canceled -> {
                work = null
            }

            GoogleIdToken.Failed -> {
                work = null
                failure = AccountFailure.SignIn
            }

            is GoogleIdToken.Received -> {
                viewModelScope.launch {
                    try {
                        show(account.signInWithGoogle(token.idToken))
                    } finally {
                        work = null
                    }
                }
            }
        }
    }

    /** The authorize page to open, or null when this session can't start one now. */
    suspend fun startApple(): String? {
        work = SignInWork.Apple
        failure = null
        appleExpired = false
        return try {
            sessions.startAppleSignIn()
        } catch (e: CancellationException) {
            throw e
        } catch (e: IllegalStateException) {
            work = null
            null
        }
    }

    /**
     * Back from Apple. The page closing without an answer clears nothing: a browser without Auth
     * Tab returns its answer through the App Link meanwhile, and clearing the pending sign-in would
     * race it.
     */
    fun finishApple(callback: AppleCallback?) {
        if (callback == null) {
            work = null
            return
        }
        viewModelScope.launch {
            try {
                val result = sessions.completeAppleSignIn(callback)
                when {
                    callback.error == APPLE_USER_CANCELED -> {}

                    callback.error != null -> {
                        failure = AccountFailure.SignIn
                    }

                    result == SignInResult.Obsolete -> {
                        appleExpired = true
                    }

                    else -> {
                        show(result)
                    }
                }
            } finally {
                work = null
            }
        }
    }

    private fun show(result: SignInResult) {
        if (result is SignInResult.Failed) failure = accountFailure(result.error, result.code)
    }

    private fun run(
        kind: SignInWork,
        block: suspend () -> Unit,
    ) {
        work = kind
        viewModelScope.launch {
            try {
                block()
            } finally {
                work = null
            }
        }
    }

    companion object {
        const val CODE_LENGTH = 6
        private const val APPLE_USER_CANCELED = "user_cancelled_authorize"
    }
}

/** A light check, as Apple's: the server has the last word. */
internal fun isEmailLike(email: String): Boolean {
    val parts = email.split("@")
    return parts.size == 2 && parts[0].isNotEmpty() && '.' in parts[1] && email.none(Char::isWhitespace)
}
