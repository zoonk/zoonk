package com.zoonk.android.data

import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.ClearCredentialStateRequest.Companion.TYPE_CLEAR_CREDENTIAL_STATE
import androidx.credentials.ClearCredentialStateRequest.Companion.TYPE_CLEAR_RESTORE_CREDENTIAL
import androidx.credentials.CredentialManager
import androidx.credentials.exceptions.ClearCredentialException

/**
 * On sign-out, so the next Google sign-in asks which account to use and this device's restore key
 * can't sign a new phone in. The default request leaves the restore key, so it takes its own.
 */
suspend fun clearCredentialState(context: Context) {
    val manager = CredentialManager.create(context)
    for (type in listOf(TYPE_CLEAR_CREDENTIAL_STATE, TYPE_CLEAR_RESTORE_CREDENTIAL)) {
        try {
            manager.clearCredentialState(ClearCredentialStateRequest(type))
        } catch (e: ClearCredentialException) {
            // No provider on this device (no Play services), so there's no state to clear.
        }
    }
}
