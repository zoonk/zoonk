package com.zoonk.android.feature.settings

import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.account.AccountDeletion
import com.zoonk.android.feature.account.AccountFailure
import com.zoonk.android.feature.account.AccountStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.OutputStream

enum class DeletionStep { None, Confirm, Code, AppleNote, Deleted }

/**
 * Privacy's "Your data": the download and deleting the account, for the account [session] shows. [open] gives the
 * stream of a file the learner picked, from the application's content resolver, or null when it can't be opened.
 */
class YourDataViewModel(
    private val account: AccountStore,
    private val session: AuthenticatedSession,
    private val email: String,
    private val open: (Uri) -> OutputStream?,
) : ViewModel() {
    /** This visit to Privacy: a download that fails says so only on it. */
    val visit = Visit()

    private val exportFailure = visit.outcome<Unit>()

    var isExporting by mutableStateOf(false)
        private set

    /** The download didn't save, on this visit. */
    val exportFailed get() = exportFailure.value != null

    var deletionStep by mutableStateOf(DeletionStep.None)
        private set
    var isDeleting by mutableStateOf(false)
        private set
    var deletionFailure by mutableStateOf<AccountFailure?>(null)
        private set
    var code by mutableStateOf("")
        private set

    /** Writes the download to the file the learner picked at [to]; it's written even after the page goes. */
    fun export(to: Uri) {
        if (isExporting) return
        isExporting = true
        exportFailure.clear()
        val started = visit.number
        viewModelScope.launch {
            try {
                val json = account.exportData()
                if (json == null || !withContext(Dispatchers.IO) { write(to, json) }) exportFailure.send(started, Unit)
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
                        deletionStep = if (result.appleAuthorizationRevoked == false) DeletionStep.AppleNote else DeletionStep.Deleted
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

    /** After the Apple note. */
    fun finish() {
        deletionStep = DeletionStep.Deleted
    }

    private fun write(
        to: Uri,
        json: String,
    ): Boolean =
        try {
            open(to)?.use { it.write(json.toByteArray()) } != null
        } catch (e: java.io.IOException) {
            false
        } catch (e: SecurityException) {
            false
        }

    private companion object {
        const val CODE_LENGTH = 6
    }
}
