package com.zoonk.android.feature.certificates

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.data.value
import com.zoonk.api.models.OwnedCertificate
import java.util.UUID

interface CertificatesApi {
    suspend fun list(session: AuthenticatedSession): List<OwnedCertificate>

    suspend fun markShown(
        session: AuthenticatedSession,
        code: String,
    )

    suspend fun claim(
        session: AuthenticatedSession,
        goalId: UUID,
    ): OwnedCertificate
}

class LiveCertificatesApi(
    private val api: ApiClients,
) : CertificatesApi {
    override suspend fun list(session: AuthenticatedSession) = perform { api.clients(session).certificates.listCertificates() }.certificates

    override suspend fun markShown(
        session: AuthenticatedSession,
        code: String,
    ) = perform { api.clients(session).certificates.markCertificateShown(code) }

    override suspend fun claim(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).certificates.claimCourseCertificate(goalId) }
}

class CertificateStore(
    private val api: CertificatesApi,
    private val cache: AppCache,
) {
    /** Newest first. A rename redraws every picture, so the session's domain refreshes them too, as main's tags do. */
    val certificates =
        cache.resource<List<OwnedCertificate>>(
            Audience.SignedIn,
            setOf(DataDomain.Certificates, DataDomain.UserSession),
            isEmpty = List<OwnedCertificate>::isEmpty,
        ) { session -> session?.let { api.list(it) } }

    /** A completion that earned [codes] leaves the list stale only while it doesn't hold them yet. */
    fun awarded(codes: Collection<String>) {
        val listed =
            certificates.state.value.value
                .orEmpty()
                .mapTo(HashSet()) { it.code }
        if (!listed.containsAll(codes)) cache.invalidate(setOf(DataDomain.Certificates))
    }

    private val closed = mutableSetOf<String>()

    /** Closed while this app runs: a result read before its views were saved doesn't play the moment again. */
    fun isClosed(code: String) = code in closed

    /** So its award moment shows once: completion results stop returning it. */
    suspend fun markShown(code: String): Boolean {
        closed += code
        return cache.mutate(
            invalidating = setOf(DataDomain.Certificates),
        ) { session -> api.markShown(session, code) } is MutationResult.Done
    }

    /** A finished course's certificate, awarded now or returned when it exists; the goal map then shows it. */
    suspend fun claim(goalId: UUID): MutationResult<OwnedCertificate> =
        cache.mutate(invalidating = setOf(DataDomain.Certificates, DataDomain.Goals)) { session -> api.claim(session, goalId) }
}
