package com.zoonk.android.data

import com.zoonk.api.models.AppleSessionRequest
import com.zoonk.api.models.AppleSessionRequestUser
import com.zoonk.api.models.AppleSessionRequestUserName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.HttpUrl.Companion.toHttpUrl
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

@Serializable
data class PendingAppleSignIn(
    val state: String,
    val rawNonce: String,
    val startedFrom: AuthenticatedSession?,
    val isGuest: Boolean,
    val startedAt: Long,
)

data class AppleCallback(
    val state: String,
    val code: String? = null,
    val idToken: String? = null,
    val user: String? = null,
    val error: String? = null,
) {
    internal fun request(rawNonce: String): AppleSessionRequest? {
        if (code.isNullOrBlank() || idToken.isNullOrBlank()) return null
        return try {
            val profile = user?.let { Json.parseToJsonElement(it).jsonObject }
            val name = profile?.get("name")?.jsonObject
            AppleSessionRequest(
                authorizationCode = code,
                idToken = idToken,
                nonce = rawNonce,
                client = AppleSessionRequest.Client.WEB,
                user =
                    profile?.let {
                        AppleSessionRequestUser(
                            email = it["email"]?.jsonPrimitive?.content,
                            name =
                                name?.let {
                                    AppleSessionRequestUserName(
                                        it["firstName"]?.jsonPrimitive?.content,
                                        it["lastName"]?.jsonPrimitive?.content,
                                    )
                                },
                        )
                    },
            )
        } catch (_: IllegalArgumentException) {
            null
        }
    }
}

internal fun appleSecret(): String =
    Base64.getUrlEncoder().withoutPadding().encodeToString(
        ByteArray(32).also {
            SecureRandom().nextBytes(it)
        },
    )

internal fun appleAuthorizeUrl(
    clientId: String,
    reflectorUrl: String,
    pending: PendingAppleSignIn,
): String =
    "https://appleid.apple.com/auth/authorize"
        .toHttpUrl()
        .newBuilder()
        .addQueryParameter("client_id", clientId)
        .addQueryParameter("redirect_uri", reflectorUrl)
        .addQueryParameter("response_type", "code id_token")
        .addQueryParameter("response_mode", "form_post")
        .addQueryParameter("scope", "name email")
        .addQueryParameter("state", pending.state)
        .addQueryParameter(
            "nonce",
            MessageDigest.getInstance("SHA-256").digest(pending.rawNonce.toByteArray()).joinToString("") {
                "%02x".format(it)
            },
        ).build()
        .toString()
