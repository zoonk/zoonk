package com.zoonk.android.feature.account

import android.content.Context
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager.PrepareIntegrityTokenRequest
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityToken
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenProvider
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.tasks.await
import java.security.MessageDigest
import java.util.Base64
import kotlin.coroutines.cancellation.CancellationException

/** A Play Integrity token for a request hash; null when Play can't make one. */
fun interface IntegrityTokens {
    suspend fun token(requestHash: String): String?
}

/**
 * Play Integrity standard requests. Preparing the provider takes seconds, so it starts with the
 * app; Google invalidates a provider over time, so a failed token prepares a new one and asks again.
 */
class PlayIntegrity(
    context: Context,
    private val cloudProjectNumber: Long,
    private val scope: CoroutineScope,
) : IntegrityTokens {
    private val manager = IntegrityManagerFactory.createStandard(context)

    @Volatile
    private var provider = prepare()

    override suspend fun token(requestHash: String): String? =
        request(provider, requestHash) ?: request(prepare().also { provider = it }, requestHash)

    private fun prepare(): Deferred<StandardIntegrityTokenProvider> =
        scope.async {
            manager
                .prepareIntegrityToken(PrepareIntegrityTokenRequest.builder().setCloudProjectNumber(cloudProjectNumber).build())
                .await()
        }

    private suspend fun request(
        provider: Deferred<StandardIntegrityTokenProvider>,
        requestHash: String,
    ): String? =
        try {
            provider
                .await()
                .request(StandardIntegrityTokenRequest.builder().setRequestHash(requestHash).build())
                .await()
                .let(StandardIntegrityToken::token)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            null
        }
}

/** The request a token covers: SHA-256 of App Attest's client data, as the API rebuilds it from the body. */
fun BotProofRequest.requestHash(challenge: String): String {
    val binding =
        when (this) {
            BotProofRequest.Guest -> listOf("guest")
            is BotProofRequest.EmailCode -> listOf("email-code", email)
            is BotProofRequest.EmailSession -> listOf("email-session", email, code)
        }
    val clientData = (listOf("zoonk-app-attest:1", challenge) + binding).joinToString("\n")
    val digest = MessageDigest.getInstance("SHA-256").digest(clientData.toByteArray(Charsets.UTF_8))
    return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
}
