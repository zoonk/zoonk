package com.zoonk.android.feature.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.feature.account.AccountDeletion
import com.zoonk.android.feature.account.AccountFailure
import com.zoonk.android.feature.account.AccountStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.OutputStream

enum class DeletionStep { None, Confirm, Code, AppleNote, Done }

/** The profile's download and its account deletion, for the account [session] shows. */
class ProfileViewModel(
    private val account: AccountStore,
    private val session: AuthenticatedSession,
    private val email: String,
) : ViewModel() {
    var isExporting by mutableStateOf(false)
        private set
    var exportFailed by mutableStateOf(false)
        private set

    var deletionStep by mutableStateOf(DeletionStep.None)
        private set
    var isDeleting by mutableStateOf(false)
        private set
    var deletionFailure by mutableStateOf<AccountFailure?>(null)
        private set
    var code by mutableStateOf("")
        private set

    /** [open] gives the stream of the file the learner picked, or null when it can't be opened. */
    fun export(open: () -> OutputStream?) {
        if (isExporting) return
        isExporting = true
        exportFailed = false
        viewModelScope.launch {
            try {
                val json = account.exportData()
                exportFailed = json == null || !withContext(Dispatchers.IO) { write(open, json) }
            } finally {
                isExporting = false
            }
        }
    }

    fun askToDelete() {
        deletionFailure = null
        deletionStep = DeletionStep.Confirm
    }

    fun dismissDeletion() {
        if (isDeleting) return
        deletionStep = DeletionStep.None
        deletionFailure = null
        code = ""
    }

    fun onCodeChange(value: String) {
        code = value.filter(Char::isDigit).take(CODE_LENGTH)
        if (deletionFailure == AccountFailure.WrongCode) deletionFailure = null
    }

    fun delete() {
        if (isDeleting) return
        val usesCode = deletionStep == DeletionStep.Code
        if (usesCode && code.length != CODE_LENGTH) {
            deletionFailure = AccountFailure.WrongCode
            return
        }
        isDeleting = true
        deletionFailure = null
        viewModelScope.launch {
            try {
                when (val result = account.deleteAccount(session, email, code.takeIf { usesCode })) {
                    is AccountDeletion.Deleted -> {
                        if (result.appleAuthorizationRevoked == false) deletionStep = DeletionStep.AppleNote else finish()
                    }

                    AccountDeletion.NeedsCode -> {
                        deletionStep = DeletionStep.Code
                        deletionFailure = account.sendDeletionCode(session, email)
                    }

                    is AccountDeletion.Failed -> {
                        deletionFailure = result.failure
                    }

                    AccountDeletion.Obsolete -> {
                        deletionStep = DeletionStep.None
                    }
                }
            } finally {
                isDeleting = false
            }
        }
    }

    fun sendNewCode() {
        if (isDeleting) return
        isDeleting = true
        viewModelScope.launch {
            try {
                code = ""
                deletionFailure = account.sendDeletionCode(session, email)
            } finally {
                isDeleting = false
            }
        }
    }

    /** After the Apple note, or at once without one: the session belonged to the deleted account. */
    fun finish() {
        viewModelScope.launch {
            account.forgetDeletedAccount(session)
            deletionStep = DeletionStep.Done
        }
    }

    private fun write(
        open: () -> OutputStream?,
        json: String,
    ): Boolean =
        try {
            open()?.use { it.write(json.toByteArray()) } != null
        } catch (e: java.io.IOException) {
            false
        } catch (e: SecurityException) {
            false
        }

    private companion object {
        const val CODE_LENGTH = 6
    }
}
