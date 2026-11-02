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
import com.zoonk.api.models.ExamResultInput
import com.zoonk.api.models.ExamView
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
            ExamResultInput(
                maxScore = report.maxScore,
                passed = report.passed,
                scale = report.scale?.let { ExamResultInput.Scale.valueOf(it.name) },
                score = report.score,
            ),
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
        /** A finished speaking task's call changes the exam's speaking paper, under the learner's progress. */
        val EXAM_DOMAINS =
            setOf(
                DataDomain.Goals,
                DataDomain.LearnerModel,
                DataDomain.LearningProfile,
                DataDomain.UserProgress,
                DataDomain.UserSubscription,
            )
    }
}
