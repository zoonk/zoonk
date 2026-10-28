package com.zoonk.android.data

import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.exceptions.ClearCredentialException

/** Clears Credential Manager's state on sign-out, so the next Google sign-in asks which account to use. */
suspend fun clearCredentialState(context: Context) {
    try {
        CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
    } catch (e: ClearCredentialException) {
        // No provider on this device (no Play services): there's no state to clear.
    }
}
