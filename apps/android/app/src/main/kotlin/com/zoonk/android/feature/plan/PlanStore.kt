package com.zoonk.android.feature.plan

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.perform
import com.zoonk.android.data.value
import com.zoonk.api.models.ExamChoiceInput
import com.zoonk.api.models.GoalProgress
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.OnboardingStep
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanBasesAdvice
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
import com.zoonk.api.models.PlanChangePreview
import com.zoonk.api.models.PlanChangeResult
import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.PlanTimeToCoverInput
import com.zoonk.api.models.PlanToolChoiceInput
import com.zoonk.api.models.PlanWatch
import com.zoonk.api.models.Syllabus
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.ZoneId
import java.util.UUID
import kotlin.time.Clock
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Instant

/**
 * [readAt] is when it was read, a little early, to ask the server whether it changed since; [writes]
 * how many of the learner's plan writes had saved when it started.
 */
data class PlanRead(
    val plan: Plan,
    val readAt: Instant,
    val writes: Int = 0,
)

/** [Stale]: reading the plan again failed. [Dropped]: the plan isn't shown anymore, as when the session ended. */
enum class PlanShown { Current, Stale, Dropped }

/**
 * [steps] are the setup's questions the learner hasn't answered (`plan` alone: it's being built).
 * A course start's default plan reads as ready before them, so main shows setup for it while any
 * are left, a buddy aside (core's `isCourseSetupLeft`).
 */
data class GoalSetup(
    val steps: List<OnboardingStep>,
    val courseStart: Boolean,
) {
    val questionsLeft: Boolean get() = steps.any { it != OnboardingStep.PLAN }
    val courseSetupLeft: Boolean get() = courseStart && steps.any { it != OnboardingStep.PLAN && it != OnboardingStep.BUDDY }
}

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

    suspend fun setup(
        session: AuthenticatedSession,
        goalId: UUID,
    ): GoalSetup

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

    suspend fun change(
        session: AuthenticatedSession,
        goalId: UUID,
        operations: List<PlanOp>,
    ): PlanChangeResult

    /** Saves nothing. */
    suspend fun preview(
        session: AuthenticatedSession,
        goalId: UUID,
        operations: List<PlanOp>,
    ): PlanChangePreview

    suspend fun decide(
        session: AuthenticatedSession,
        goalId: UUID,
        changeId: UUID,
        status: PlanChangeDecisionInput.Status,
    ): PlanChange

    /** Plans the goal at each daily time; saves nothing. */
    suspend fun timeToCover(
        session: AuthenticatedSession,
        goalId: UUID,
    ): PlanTimeToCover

    suspend fun chooseExamOption(
        session: AuthenticatedSession,
        goalId: UUID,
        group: String,
        subject: String,
    ): PlanChangeResult

    /** Setting a tool up can write its setup lesson with a model first. */
    suspend fun chooseTools(
        session: AuthenticatedSession,
        goalId: UUID,
        answer: ToolAnswer,
    ): PlanChangeResult

    /** Plans the goal with every prerequisite in depth, so only when the learner asks. Saves nothing. */
    suspend fun basesAdvice(
        session: AuthenticatedSession,
        goalId: UUID,
    ): PlanBasesAdvice
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

    override suspend fun setup(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).onboarding.getOnboarding(goalId) }.let { GoalSetup(it.steps, "courseStart" in it.goal.details) }

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

    override suspend fun change(
        session: AuthenticatedSession,
        goalId: UUID,
        operations: List<PlanOp>,
    ) = perform { api.clients(session).plans.createPlanChange(goalId, changeInput(operations)) }

    override suspend fun preview(
        session: AuthenticatedSession,
        goalId: UUID,
        operations: List<PlanOp>,
    ) = perform { api.clients(session).plans.previewPlanChange(goalId, changeInput(operations)) }

    override suspend fun decide(
        session: AuthenticatedSession,
        goalId: UUID,
        changeId: UUID,
        status: PlanChangeDecisionInput.Status,
    ) = perform { api.clients(session).plans.decidePlanChange(goalId, changeId, PlanChangeDecisionInput(status, deviceTimeZone())) }

    override suspend fun timeToCover(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).plans.findPlanTimeToCover(goalId, PlanTimeToCoverInput()) }

    override suspend fun chooseExamOption(
        session: AuthenticatedSession,
        goalId: UUID,
        group: String,
        subject: String,
    ) = perform { api.clients(session).plans.createPlanExamChoice(goalId, ExamChoiceInput(group, subject, deviceTimeZone())) }

    override suspend fun chooseTools(
        session: AuthenticatedSession,
        goalId: UUID,
        answer: ToolAnswer,
    ) = perform {
        api.clients(session).plans.createPlanToolChoice(
            goalId,
            PlanToolChoiceInput(
                choice = PlanToolChoiceInput.Choice.valueOf(answer.choice.name),
                tools = answer.tools,
                system = answer.system?.let { PlanToolChoiceInput.System.valueOf(it.name) },
                timeZone = deviceTimeZone(),
            ),
        )
    }

    override suspend fun basesAdvice(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).plans.createPlanBasesAdvice(goalId) }

    private fun changeInput(operations: List<PlanOp>) =
        buildJsonObject {
            put("operations", JsonArray(operations.mapNotNull { it.toJson() }))
            put("timeZone", deviceTimeZone())
        }

    private fun deviceTimeZone() = ZoneId.systemDefault().id
}

/** The Plan tab's reads, by goal; the subject pages read [syllabus] too. */
class PlanStore(
    private val api: PlanApi,
    private val cache: AppCache,
    private val now: () -> Instant = Clock.System::now,
) {
    val plan: KeyedResources<UUID, PlanRead> =
        cache.keyed(Audience.SignedIn, PLAN_DOMAINS) { session, goalId ->
            session?.let { read(it, goalId) }
        }

    val syllabus: KeyedResources<UUID, Syllabus> =
        cache.keyed(Audience.SignedIn, READ_DOMAINS) { session, goalId -> session?.let { api.syllabus(it, goalId) } }

    val progress: KeyedResources<UUID, GoalProgress> =
        cache.keyed(Audience.SignedIn, READ_DOMAINS) { session, goalId -> session?.let { api.progress(it, goalId) } }

    val resumeChangesPlan: KeyedResources<UUID, Boolean> =
        cache.keyed(Audience.SignedIn, setOf(DataDomain.Goals)) { session, goalId -> session?.let { api.resumeChangesPlan(it, goalId) } }

    val setup: KeyedResources<UUID, GoalSetup> =
        cache.keyed(Audience.SignedIn, setOf(DataDomain.Goals, DataDomain.LearningProfile)) { session, goalId ->
            session?.let { api.setup(it, goalId) }
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

    /** A learner's edit, from their tap. */
    suspend fun change(
        goalId: UUID,
        operations: List<PlanOp>,
    ): MutationResult<PlanChangeResult> = write(goalId) { api.change(it, goalId, operations) }

    suspend fun undo(
        goalId: UUID,
        changeId: UUID,
    ): MutationResult<PlanChange> = decideChange(goalId, changeId, PlanChangeDecisionInput.Status.UNDONE)

    /** Applies or declines a change offered to the learner, or undoes an applied one; answers the change as it now stands. */
    suspend fun decideChange(
        goalId: UUID,
        changeId: UUID,
        status: PlanChangeDecisionInput.Status,
    ): MutationResult<PlanChange> = write(goalId) { api.decide(it, goalId, changeId, status) }

    suspend fun chooseExamOption(
        goalId: UUID,
        group: String,
        subject: String,
    ): MutationResult<PlanChangeResult> = write(goalId) { api.chooseExamOption(it, goalId, group, subject) }

    suspend fun chooseTools(
        goalId: UUID,
        answer: ToolAnswer,
    ): MutationResult<PlanChangeResult> = write(goalId) { api.chooseTools(it, goalId, answer) }

    suspend fun basesAdvice(goalId: UUID): MutationResult<PlanBasesAdvice> = cache.mutate { api.basesAdvice(it, goalId) }

    /** What an edit would do: it saves nothing, so nothing is read again. */
    suspend fun preview(
        goalId: UUID,
        operations: List<PlanOp>,
    ): MutationResult<PlanChangePreview> = cache.mutate { api.preview(it, goalId, operations) }

    /** Plans the goal at each daily time, so only from the learner's tap. It saves nothing, so nothing is read again. */
    suspend fun timeToCover(goalId: UUID): MutationResult<PlanTimeToCover> = cache.mutate { api.timeToCover(it, goalId) }

    /** Reads the plan again unless the plan shown has every write saved so far, and says whether it has them now. */
    suspend fun awaitWritesShown(goalId: UUID): PlanShown {
        val written = writes[goalId] ?: 0
        val shown = plan[goalId]
        if (shown.writesShown() < written) {
            shown.refresh()
            // A newer write's invalidation replaces this read with one that has this write too.
            shown.isRefreshing.first { !it }
        }
        return when {
            shown.state.value !is LoadState.Loaded -> PlanShown.Dropped
            shown.writesShown() >= written -> PlanShown.Current
            else -> PlanShown.Stale
        }
    }

    private fun Resource<PlanRead>.writesShown() = state.value.value?.writes ?: 0

    /** Counted before the write's invalidation reads the plan again, so that read counts it. */
    private suspend fun <T> write(
        goalId: UUID,
        write: suspend (AuthenticatedSession) -> T,
    ): MutationResult<T> =
        cache.mutate(invalidating = WRITE_DOMAINS) { session ->
            write(session).also { writes[goalId] = (writes[goalId] ?: 0) + 1 }
        }

    private val writes = mutableMapOf<UUID, Int>()

    /**
     * While lessons are being written: asks whether anything changed since the plan shown was read,
     * and reads it again only then, since the server plans again on every read. Other reads and
     * invalidations always read the plan, as main's page does.
     */
    suspend fun refreshIfChanged(goalId: UUID) {
        polls += goalId
        try {
            plan[goalId].refresh()
        } finally {
            polls -= goalId
        }
    }

    private val polls = mutableSetOf<UUID>()

    private suspend fun read(
        session: AuthenticatedSession,
        goalId: UUID,
    ): PlanRead {
        val shown = plan[goalId].state.value.value
        val written = writes[goalId] ?: 0
        if (polls.remove(goalId) && shown != null && !api.planChanged(session, goalId, shown.readAt)) return shown.copy(writes = written)
        return PlanRead(api.plan(session, goalId), now() - CLOCK_MARGIN, written)
    }

    companion object {
        val PLAN_DOMAINS = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSubscription)
        val READ_DOMAINS = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress)

        /** Plan writes revalidate these, as core's `revalidatePlanTags` does. */
        val WRITE_DOMAINS = setOf(DataDomain.Goals, DataDomain.LearnerModel)

        /** Device clocks run a little apart from the server's: asking from a minute earlier never misses a change. */
        private val CLOCK_MARGIN = 1.minutes
    }
}
