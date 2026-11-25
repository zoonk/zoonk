package com.zoonk.android.feature.account

import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.clearText
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.SavedStateHandleSaveableApi
import androidx.lifecycle.viewmodel.compose.saveable
import com.zoonk.android.data.AppleCallback
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.Visit
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import java.io.IOException
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
    val emailField = handle.saveable(key = "emailField", saver = TextFieldState.Saver) { TextFieldState() }
    val email get() = emailField.text.toString()
    var codeSentTo by handle.saveable { mutableStateOf<String?>(null) }
        private set
    val codeField = handle.saveable(key = "codeField", saver = TextFieldState.Saver) { TextFieldState() }
    val code get() = codeField.text.toString()
    private var rejectedCode by handle.saveable { mutableStateOf<String?>(null) }
    val isCodeRejected get() = code == rejectedCode
    var work by mutableStateOf<SignInWork?>(null)
        private set
    private var error by mutableStateOf<AccountFailure?>(null)
    private var failedEmail by mutableStateOf("")
    private var failedCode by mutableStateOf("")
    var failure: AccountFailure?
        get() = if (isCodeRejected) AccountFailure.WrongCode else error.takeIf { email == failedEmail && code == failedCode }
        private set(value) {
            failedEmail = email
            failedCode = code
            error = value
        }
    var resend by mutableStateOf<ResendStatus?>(null)
        private set

    /** Apple's answer came back but no longer matched a sign-in this app started. */
    var appleExpired by mutableStateOf(false)
        private set

    /** An expired or locked code can't be tried again; only a new one helps. */
    val needsNewCode get() = failure == AccountFailure.CodeExpired || failure == AccountFailure.CodeLocked

    private var watchingCode: Job? = null
    val codeVisit =
        Visit {
            watchingCode?.cancel()
            watchingCode = null
            codeField.clearText()
            rejectedCode = null
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
                codeField.clearText()
                resend = null
            }
        }
    }

    fun changeEmail() {
        if (work != null) return
        codeSentTo = null
        codeField.clearText()
        rejectedCode = null
        failure = null
        resend = null
    }

    /** A full code is checked at once, as main's code boxes submit when filled. */
    fun observeCode() {
        if (watchingCode != null) return
        val started = codeVisit.number
        watchingCode =
            viewModelScope.launch(start = CoroutineStart.UNDISPATCHED) {
                snapshotFlow { code }.drop(1).collect { typed ->
                    if (started == codeVisit.number && typed.length == CODE_LENGTH) checkCode()
                }
            }
    }

    fun checkCode() {
        val email = codeSentTo ?: return
        if (work != null || needsNewCode || isCodeRejected) return
        if (code.length != CODE_LENGTH) {
            failure = AccountFailure.WrongCode
            return
        }
        val started = codeVisit.number
        val checked = code
        run(SignInWork.CheckCode) {
            val result = account.signInWithEmailCode(email, checked)
            if (started != codeVisit.number) return@run
            show(result)
            if (result is SignInResult.Failed && failure == AccountFailure.WrongCode) rejectedCode = checked
        }
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
                codeField.clearText()
                rejectedCode = null
                failure = null
            }
        }
    }

    /** The session Google's sheet opened over: its answer signs in only while that's still current. */
    private var googleStartedFrom: AuthenticatedSession? = null

    fun startGoogle() {
        googleStartedFrom = sessions.current
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
                if (sessions.current != googleStartedFrom) {
                    work = null
                    return
                }
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
            work = null
            throw e
        } catch (e: IllegalStateException) {
            // Restoring or unavailable: no session to start from yet.
            work = null
            null
        } catch (e: IOException) {
            work = null
            failure = AccountFailure.SignIn
            null
        }
    }

    fun failApple() {
        work = null
        failure = AccountFailure.SignIn
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
                val result =
                    try {
                        sessions.completeAppleSignIn(callback)
                    } catch (e: IOException) {
                        failure = AccountFailure.SignIn
                        return@launch
                    }
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
