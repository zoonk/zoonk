package com.zoonk.android.feature.plan

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.data.value
import com.zoonk.api.models.GoalProgress
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.OnboardingStep
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanWatch
import com.zoonk.api.models.Syllabus
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import java.util.UUID
import kotlin.time.Clock
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Instant

/** [readAt] is when it was read, a little early, to ask the server whether it changed since. */
data class PlanRead(
    val plan: Plan,
    val readAt: Instant,
)

interface PlanApi {
    suspend fun plan(
        session: AuthenticatedSession,
        goalId: UUID,
    ): Plan

    suspend fun planChanged(
        session: AuthenticatedSession,
        goalId: UUID,
        since: Instant,
    ): Boolean

    suspend fun syllabus(
        session: AuthenticatedSession,
        goalId: UUID,
    ): Syllabus

    suspend fun progress(
        session: AuthenticatedSession,
        goalId: UUID,
    ): GoalProgress

    /** Whether resuming the paused goal changes its plan. */
    suspend fun resumeChangesPlan(
        session: AuthenticatedSession,
        goalId: UUID,
    ): Boolean

    /** Steps of the goal's setup the learner hasn't answered yet; `plan` alone means it's being built. */
    suspend fun setupSteps(
        session: AuthenticatedSession,
        goalId: UUID,
    ): List<OnboardingStep>

    /** The run building the plan; null until it saves its id, a few seconds after it starts. */
    suspend fun buildingRunId(
        session: AuthenticatedSession,
        goalId: UUID,
    ): String?

    /** Builds the plan again: only from the learner's tap, since it runs models. */
    suspend fun rebuild(
        session: AuthenticatedSession,
        goalId: UUID,
    ): String

    /** A goal over Free's limit answers 429. */
    suspend fun setStatus(
        session: AuthenticatedSession,
        goalId: UUID,
        status: GoalUpdateInput.Status,
    )
}

class LivePlanApi(
    private val api: ApiClients,
) : PlanApi {
    override suspend fun plan(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).plans.getGoalPlan(goalId) }

    override suspend fun planChanged(
        session: AuthenticatedSession,
        goalId: UUID,
        since: Instant,
    ) = perform { api.clients(session).plans.getPlanChangedSince(goalId, since, PlanWatch.PLAN) }.changed

    override suspend fun syllabus(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).learner.getGoalSyllabus(goalId) }

    override suspend fun progress(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).learner.getGoalProgress(goalId) }

    override suspend fun resumeChangesPlan(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).plans.previewGoalResume(goalId) }

    override suspend fun setupSteps(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).onboarding.getOnboarding(goalId) }.steps

    override suspend fun buildingRunId(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = try {
        perform { api.clients(session).contentGeneration.getGoalGeneration(goalId) }.generationId
    } catch (e: ApiException) {
        if (e.error == ApiError.NotFound) null else throw e
    }

    override suspend fun rebuild(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).contentGeneration.createGoalGeneration(goalId) }.generationId

    override suspend fun setStatus(
        session: AuthenticatedSession,
        goalId: UUID,
        status: GoalUpdateInput.Status,
    ) {
        perform { api.clients(session).goals.updateGoal(goalId, GoalUpdateInput(status = status)) }
    }
}

/** The Plan tab's reads, by goal; the subject pages read [syllabus] too. */
class PlanStore(
    private val api: PlanApi,
    private val cache: AppCache,
    private val now: () -> Instant = Clock.System::now,
    private val timeZone: () -> TimeZone = TimeZone::currentSystemDefault,
) {
    val plan: KeyedResources<UUID, PlanRead> =
        cache.keyed(Audience.SignedIn, PLAN_DOMAINS, maxAge = PLAN_CHECK_AGE) { session, goalId ->
            session?.let { read(it, goalId) }
        }

    val syllabus: KeyedResources<UUID, Syllabus> =
        cache.keyed(Audience.SignedIn, READ_DOMAINS) { session, goalId -> session?.let { api.syllabus(it, goalId) } }

    val progress: KeyedResources<UUID, GoalProgress> =
        cache.keyed(Audience.SignedIn, READ_DOMAINS) { session, goalId -> session?.let { api.progress(it, goalId) } }

    val resumeChangesPlan: KeyedResources<UUID, Boolean> =
        cache.keyed(Audience.SignedIn, setOf(DataDomain.Goals)) { session, goalId -> session?.let { api.resumeChangesPlan(it, goalId) } }

    val setupSteps: KeyedResources<UUID, List<OnboardingStep>> =
        cache.keyed(Audience.SignedIn, setOf(DataDomain.Goals, DataDomain.LearningProfile)) { session, goalId ->
            session?.let { api.setupSteps(it, goalId) }
        }

    suspend fun buildingRunId(
        session: AuthenticatedSession,
        goalId: UUID,
    ): String? = api.buildingRunId(session, goalId)

    /** Throws when it couldn't start, as `GenerationFollower`'s restart does. */
    suspend fun rebuild(goalId: UUID): String =
        when (val result = cache.mutate(invalidating = setOf(DataDomain.Goals)) { api.rebuild(it, goalId) }) {
            is MutationResult.Done -> result.value
            is MutationResult.Failed -> throw ApiException(result.error, result.code, result.status, result.details)
            MutationResult.Obsolete -> throw ApiException(ApiError.Unauthorized)
        }

    /** Main's `updateGoal` revalidates the learning profile too. */
    suspend fun setStatus(
        goalId: UUID,
        status: GoalUpdateInput.Status,
    ): MutationResult<Unit> = cache.mutate(invalidating = WRITE_DOMAINS + DataDomain.LearningProfile) { api.setStatus(it, goalId, status) }

    /**
     * The server plans again on every read, so the one shown is kept while nothing changed since it
     * was read. A new day changes it without a write, so it's read again then too.
     */
    private suspend fun read(
        session: AuthenticatedSession,
        goalId: UUID,
    ): PlanRead {
        val shown = plan[goalId].state.value.value
        if (shown != null && day(shown.readAt) == day(now()) && !api.planChanged(session, goalId, shown.readAt)) {
            return shown
        }
        val readAt = now() - CLOCK_MARGIN
        return PlanRead(api.plan(session, goalId), readAt)
    }

    private fun day(instant: Instant) = instant.toLocalDateTime(timeZone()).date

    companion object {
        val PLAN_DOMAINS = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSubscription)
        val READ_DOMAINS = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress)

        /** Plan writes revalidate these, as core's `revalidatePlanTags` does. */
        val WRITE_DOMAINS = setOf(DataDomain.Goals, DataDomain.LearnerModel)

        private val PLAN_CHECK_AGE = 30.seconds

        /** Device clocks run a little apart from the server's: asking from a minute earlier never misses a change. */
        private val CLOCK_MARGIN = 1.minutes
    }
}
