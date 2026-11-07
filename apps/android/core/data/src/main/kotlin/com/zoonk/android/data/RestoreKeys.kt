package com.zoonk.android.data

import android.content.Context
import androidx.credentials.CreateRestoreCredentialRequest
import androidx.credentials.CreateRestoreCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetRestoreCredentialOption
import androidx.credentials.RestoreCredential
import androidx.credentials.exceptions.CreateCredentialProviderConfigurationException
import androidx.credentials.exceptions.CreateCredentialUnsupportedException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject

/** Credential Manager's restore key: one per app on a device, which Google moves to the learner's next phone. */
interface RestoreKeys {
    /** Null when this device has no key or can't hold one; throws when Credential Manager may answer later. */
    suspend fun sign(requestJson: String): String?

    /** Null when this device can't hold a key; throws `E2eeUnavailableException` when [isCloudBackupEnabled] can't be met. */
    suspend fun create(
        requestJson: String,
        isCloudBackupEnabled: Boolean,
    ): String?

    object None : RestoreKeys {
        override suspend fun sign(requestJson: String): String? = null

        override suspend fun create(
            requestJson: String,
            isCloudBackupEnabled: Boolean,
        ): String? = null
    }
}

class DeviceRestoreKeys(
    private val context: Context,
) : RestoreKeys {
    private val manager by lazy { CredentialManager.create(context) }

    override suspend fun sign(requestJson: String): String? =
        try {
            val request = GetCredentialRequest(listOf(GetRestoreCredentialOption(requestJson)))
            (manager.getCredential(context, request).credential as RestoreCredential).authenticationResponseJson
        } catch (e: NoCredentialException) {
            null
        } catch (e: GetCredentialProviderConfigurationException) {
            null
        } catch (e: GetCredentialUnsupportedException) {
            null
        }

    override suspend fun create(
        requestJson: String,
        isCloudBackupEnabled: Boolean,
    ): String? =
        try {
            val request = CreateRestoreCredentialRequest(requestJson, isCloudBackupEnabled)
            (manager.createCredential(context, request) as CreateRestoreCredentialResponse).responseJson
        } catch (e: CreateCredentialProviderConfigurationException) {
            null
        } catch (e: CreateCredentialUnsupportedException) {
            null
        }
}

/** The API verifies restore keys for this relying party, whichever build made them. */
private const val RELYING_PARTY = "zoonk.com"

/** [challenge] and [userId] are unpadded base64url; the user is random, so the key names nobody. */
internal fun restoreKeyCreation(
    challenge: String,
    userId: String,
): String =
    buildJsonObject {
        put("challenge", challenge)
        putJsonObject("rp") {
            put("id", RELYING_PARTY)
            put("name", "Zoonk")
        }
        putJsonObject("user") {
            put("id", userId)
            put("name", "Zoonk")
            put("displayName", "Zoonk")
        }
        putJsonArray("pubKeyCredParams") {
            for (algorithm in listOf(-7, -257)) {
                addJsonObject {
                    put("type", "public-key")
                    put("alg", algorithm)
                }
            }
        }
        put("attestation", "none")
        putJsonObject("authenticatorSelection") {
            put("requireResidentKey", true)
            put("residentKey", "required")
            put("userVerification", "required")
        }
    }.toString()

internal fun restoreKeyRequest(challenge: String): String =
    buildJsonObject {
        put("challenge", challenge)
        putJsonArray("allowCredentials") {}
        put("rpId", RELYING_PARTY)
    }.toString()
