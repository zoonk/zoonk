package com.zoonk.android.feature.exam

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.feature.mock.notAnExamAsNull
import com.zoonk.api.models.ExamResult
import com.zoonk.api.models.ExamView
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.util.UUID

/** What the learner reports after the exam: a score on [scale], whether they passed, or both. */
data class ExamResultReport(
    val score: Double?,
    val scale: ExamResult.Scale?,
    val maxScore: Double?,
    val passed: Boolean?,
)

interface ExamApi {
    /** Null for a goal that isn't an exam. */
    suspend fun exam(
        session: AuthenticatedSession,
        goalId: UUID,
        timeZone: String,
    ): ExamView?

    suspend fun report(
        session: AuthenticatedSession,
        goalId: UUID,
        report: ExamResultReport,
        timeZone: String,
    ): ExamResult
}

class LiveExamApi(
    private val api: ApiClients,
) : ExamApi {
    override suspend fun exam(
        session: AuthenticatedSession,
        goalId: UUID,
        timeZone: String,
    ) = notAnExamAsNull { perform { api.clients(session).exams.getExam(goalId, timeZone) } }

    override suspend fun report(
        session: AuthenticatedSession,
        goalId: UUID,
        report: ExamResultReport,
        timeZone: String,
    ) = perform {
        api.clients(session).exams.reportExamResult(
            goalId,
            buildJsonObject {
                put("maxScore", report.maxScore?.let(::JsonPrimitive) ?: JsonNull)
                put("passed", report.passed?.let(::JsonPrimitive) ?: JsonNull)
                put("scale", report.scale?.value?.let(::JsonPrimitive) ?: JsonNull)
                put("score", report.score?.let(::JsonPrimitive) ?: JsonNull)
            },
            timeZone,
        )
    }
}

/** The exam page's read, by goal. */
class ExamStore(
    private val api: ExamApi,
    private val cache: AppCache,
    private val timeZone: () -> String,
) {
    val exam: KeyedResources<UUID, ExamView> =
        cache.keyed(Audience.SignedIn, EXAM_DOMAINS) { session, goalId -> session?.let { api.exam(it, goalId, timeZone()) } }

    /** Core's `reportExamResult` revalidates the learner model, which the exam's read carries. */
    suspend fun report(
        goalId: UUID,
        report: ExamResultReport,
    ): MutationResult<ExamResult> =
        cache.mutate(invalidating = setOf(DataDomain.LearnerModel)) { api.report(it, goalId, report, timeZone()) }

    companion object {
        val EXAM_DOMAINS = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.LearningProfile, DataDomain.UserSubscription)
    }
}
