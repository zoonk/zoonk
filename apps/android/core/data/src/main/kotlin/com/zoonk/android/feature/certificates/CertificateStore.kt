package com.zoonk.android.feature.certificates

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.data.value
import com.zoonk.api.models.CertificateProgress
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
    ): List<OwnedCertificate>

    suspend fun goals(session: AuthenticatedSession): List<CertificateProgress>
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
    ) = perform { api.clients(session).certificates.claimCourseCertificate(goalId) }.certificates

    override suspend fun goals(session: AuthenticatedSession) =
        perform { api.clients(session).certificates.listCertificateProgress() }.upNext
}

/** The certificate's studied share of its full lesson coverage, read from core. */
data class CertificateUpNext(
    val goal: CertificateProgress,
    val progress: Double?,
)

fun certificateUpNext(goals: List<CertificateProgress>): List<CertificateUpNext> = goals.map { CertificateUpNext(it, it.progress) }

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

    /** The certificate coverage core measured for the empty page's Up next. */
    val goals =
        cache.resource<List<CertificateProgress>>(
            Audience.SignedIn,
            setOf(DataDomain.Goals, DataDomain.UserProgress),
            isEmpty = List<CertificateProgress>::isEmpty,
        ) { session -> session?.let { api.goals(it) } }

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

    /**
     * So its award moment shows once: completion results stop returning it. Like main's, it refreshes
     * nothing: only results show the mark, and [isClosed] skips it there.
     */
    suspend fun markShown(code: String): Boolean {
        closed += code
        return cache.mutate { session -> api.markShown(session, code) } is MutationResult.Done
    }

    /** Every certificate of the plan's finished units, the ones it writes now included; the goal map then shows them. */
    suspend fun claim(goalId: UUID): MutationResult<List<OwnedCertificate>> =
        cache.mutate(invalidating = setOf(DataDomain.Certificates, DataDomain.Goals)) { session -> api.claim(session, goalId) }
}
