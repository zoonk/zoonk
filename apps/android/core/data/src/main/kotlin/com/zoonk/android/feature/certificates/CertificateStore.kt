package com.zoonk.android.feature.certificates

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.data.value
import com.zoonk.api.models.Goal
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

    suspend fun goals(session: AuthenticatedSession): List<Goal>
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

    override suspend fun goals(session: AuthenticatedSession) = perform { api.clients(session).goals.listGoals() }.goals
}

data class CertificateUpNext(
    val goal: Goal,
    val progress: Double,
)

fun certificateUpNext(goals: List<Goal>): List<CertificateUpNext> =
    goals
        .filter { it.status == Goal.Status.ACTIVE }
        .mapNotNull { goal ->
            when (goal.kind) {
                Goal.Kind.LEARN, Goal.Kind.EXAM, Goal.Kind.LANGUAGE -> {
                    goal.plan
                        ?.takeIf { it.lessonsTotal > 0 }
                        ?.let { CertificateUpNext(goal, it.lessonsDone.toDouble() / it.lessonsTotal) }
                }

                Goal.Kind.EXPLAIN -> {
                    null
                }
            }
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

    /** The goals and their plans' lesson counts, which only the empty page's "Up next" reads, as main's does. */
    val goals =
        cache.resource<List<Goal>>(
            Audience.SignedIn,
            setOf(DataDomain.Goals, DataDomain.UserProgress),
            isEmpty = List<Goal>::isEmpty,
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
