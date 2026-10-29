package com.zoonk.android.feature.account

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException

sealed interface GoogleIdToken {
    data class Received(
        val idToken: String,
    ) : GoogleIdToken

    data object Canceled : GoogleIdToken

    data object Failed : GoogleIdToken
}

/**
 * Credential Manager's "Sign in with Google" sheet for the API's Web client ([serverClientId]).
 * [activityContext] must be an activity's: the sheet shows over it.
 */
suspend fun requestGoogleIdToken(
    activityContext: Context,
    serverClientId: String,
): GoogleIdToken {
    val request =
        GetCredentialRequest
            .Builder()
            .addCredentialOption(GetSignInWithGoogleOption.Builder(serverClientId).build())
            .build()
    return try {
        val credential = CredentialManager.create(activityContext).getCredential(activityContext, request).credential
        if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            GoogleIdToken.Received(GoogleIdTokenCredential.createFrom(credential.data).idToken)
        } else {
            GoogleIdToken.Failed
        }
    } catch (e: GetCredentialCancellationException) {
        GoogleIdToken.Canceled
    } catch (e: NoCredentialException) {
        GoogleIdToken.Failed
    } catch (e: GetCredentialException) {
        GoogleIdToken.Failed
    } catch (e: GoogleIdTokenParsingException) {
        GoogleIdToken.Failed
    }
}
