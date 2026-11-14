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
import com.zoonk.android.data.Written
import com.zoonk.android.data.perform
import com.zoonk.android.data.performWritten
import com.zoonk.android.data.value
import com.zoonk.api.models.ExamChoiceInput
import com.zoonk.api.models.Goal
import com.zoonk.api.models.GoalContentCountry
import com.zoonk.api.models.GoalProgress
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanBasesAdvice
import com.zoonk.api.models.PlanCertificates
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
import com.zoonk.api.models.PlanChangeInput
import com.zoonk.api.models.PlanChangePreview
import com.zoonk.api.models.PlanChangeResult
import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.PlanTimeToCoverInput
import com.zoonk.api.models.PlanToolChoiceInput
import com.zoonk.api.models.PlanWatch
import com.zoonk.api.models.SkillOutline
import com.zoonk.api.models.SkillOutlineGeneration
import com.zoonk.api.models.StudyNext
import com.zoonk.api.models.Syllabus
import kotlinx.coroutines.flow.first
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
        status: LearnerSummaryGoal.Status,
    )

    /** Answers the name saved. */
    suspend fun rename(
        session: AuthenticatedSession,
        goalId: UUID,
        displayName: String,
    ): String

    /** A language goal's country, or null for none: only the buddy and practice calls change, never the plan. Answers the goal saved, with its flag for that country. */
    suspend fun setRegion(
        session: AuthenticatedSession,
        goalId: UUID,
        region: String?,
    ): Goal

    /**
     * A learn goal's content country, or null for its language's own. A country-dependent goal owes a
     * rebuild for it, which keeps the plan until the new one saves. Answers the goal saved.
     */
    suspend fun setContentCountry(
        session: AuthenticatedSession,
        goalId: UUID,
        country: String?,
    ): Goal

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

    /** [quote] is the one the learner saw: an accept applies only while it's still the change's. */
    suspend fun decide(
        session: AuthenticatedSession,
        goalId: UUID,
        changeId: UUID,
        status: PlanChangeDecisionInput.Status,
        quote: String?,
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
        subjects: List<String>,
    ): PlanChangeResult

    /** A setup lesson nobody has needed yet answers with the run writing it; nothing is applied then. */
    suspend fun chooseTools(
        session: AuthenticatedSession,
        goalId: UUID,
        answer: ToolAnswer,
    ): Written<PlanChangeResult>

    /** Plans the goal with every prerequisite in depth, so only when the learner asks. Saves nothing. */
    suspend fun basesAdvice(
        session: AuthenticatedSession,
        goalId: UUID,
    ): PlanBasesAdvice

    suspend fun outline(
        session: AuthenticatedSession,
        goalId: UUID,
        skillId: UUID,
    ): SkillOutline

    suspend fun writeOutline(
        session: AuthenticatedSession,
        goalId: UUID,
        skillId: UUID,
    ): SkillOutlineGeneration

    suspend fun end(
        session: AuthenticatedSession,
        goalId: UUID,
    ): GoalEnd

    /** Completes the goal and starts its course's next level as the active goal, with its research and writing. */
    suspend fun continueAtNextLevel(
        session: AuthenticatedSession,
        goalId: UUID,
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
        status: LearnerSummaryGoal.Status,
    ) {
        perform { api.clients(session).goals.updateGoal(goalId, buildJsonObject { put("status", status.value) }) }
    }

    override suspend fun rename(
        session: AuthenticatedSession,
        goalId: UUID,
        displayName: String,
    ) = perform { api.clients(session).goals.updateGoal(goalId, buildJsonObject { put("displayName", displayName) }) }.goal.displayName

    override suspend fun setRegion(
        session: AuthenticatedSession,
        goalId: UUID,
        region: String?,
    ) = perform { api.clients(session).goals.updateGoal(goalId, buildJsonObject { put("targetRegion", region) }) }.goal

    override suspend fun setContentCountry(
        session: AuthenticatedSession,
        goalId: UUID,
        country: String?,
    ) = perform { api.clients(session).goals.updateGoal(goalId, buildJsonObject { put("contentCountry", country) }) }.goal

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
        quote: String?,
    ) = perform {
        api.clients(session).plans.decidePlanChange(
            goalId,
            changeId,
            PlanChangeDecisionInput(quote = quote, status = status, timeZone = deviceTimeZone()),
        )
    }

    override suspend fun timeToCover(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).plans.findPlanTimeToCover(goalId, PlanTimeToCoverInput()) }

    override suspend fun chooseExamOption(
        session: AuthenticatedSession,
        goalId: UUID,
        group: String,
        subjects: List<String>,
    ) = perform { api.clients(session).plans.createPlanExamChoice(goalId, ExamChoiceInput(group, subjects, deviceTimeZone())) }

    override suspend fun chooseTools(
        session: AuthenticatedSession,
        goalId: UUID,
        answer: ToolAnswer,
    ) = performWritten {
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

    override suspend fun outline(
        session: AuthenticatedSession,
        goalId: UUID,
        skillId: UUID,
    ) = perform { api.clients(session).learner.getSkillOutline(goalId, skillId) }

    override suspend fun writeOutline(
        session: AuthenticatedSession,
        goalId: UUID,
        skillId: UUID,
    ) = perform { api.clients(session).learner.createSkillOutlineGeneration(goalId, skillId) }

    override suspend fun end(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).learner.getGoalMap(goalId) }.let { map -> GoalEnd(map.next, map.certificates) }

    override suspend fun continueAtNextLevel(
        session: AuthenticatedSession,
        goalId: UUID,
    ) {
        perform { api.clients(session).goals.continueGoalAtNextLevel(goalId) }
    }

    private fun changeInput(operations: List<PlanOp>) = PlanChangeInput(operations.mapNotNull { it.toOperation() }, deviceTimeZone())

    private fun deviceTimeZone() = ZoneId.systemDefault().id
}

/** From the goal map: what to study next once the plan is finished, and the certificates its finished units earned or still owe. */
data class GoalEnd(
    val next: StudyNext?,
    val certificates: PlanCertificates?,
)

/** The Plan tab's reads, by goal; the subject pages read [syllabus] too. */
class PlanStore(
    private val api: PlanApi,
    private val cache: AppCache,
    private val summary: Resource<LearnerSummary>,
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

    /** Read once the plan has ended (`plan.end`), and for an exam, whose course can finish before its exam-day mocks. */
    val end: KeyedResources<UUID, GoalEnd> =
        cache.keyed(Audience.SignedIn, READ_DOMAINS + DataDomain.Certificates) { session, goalId -> session?.let { api.end(it, goalId) } }

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
        status: LearnerSummaryGoal.Status,
    ): MutationResult<Unit> = cache.mutate(invalidating = WRITE_DOMAINS + DataDomain.LearningProfile) { api.setStatus(it, goalId, status) }

    suspend fun rename(
        goalId: UUID,
        displayName: String,
    ): MutationResult<Unit> =
        saveGoal(goalId, WRITE_DOMAINS + DataDomain.LearningProfile, { api.rename(it, goalId, displayName) }) { copy(displayName = it) }

    /** From the Plan's picker or the buddy's card; the plan stays as it is. */
    suspend fun setRegion(
        goalId: UUID,
        region: String?,
    ): MutationResult<Unit> =
        saveGoal(
            goalId,
            setOf(DataDomain.Goals, DataDomain.LearningProfile),
            { api.setRegion(it, goalId, region) },
        ) { copy(targetRegion = it.targetRegion, languageFlag = it.languageFlag) }

    /** From the Plan's picker or the buddy's card; the plan shown stays until its rebuild saves the new one. */
    suspend fun setContentCountry(
        goalId: UUID,
        country: String?,
    ): MutationResult<Unit> =
        saveGoal(
            goalId,
            setOf(DataDomain.Goals, DataDomain.LearningProfile),
            { api.setContentCountry(it, goalId, country) },
        ) {
            copy(
                contentCountry = it.contentCountry,
                countryDependent = it.countryDependent,
                examplesCountry = it.examplesCountry,
                suggested = it.suggested,
            )
        }

    /** Prepares the plan for the goal's country again after that failed: only from the learner's tap, since it runs models. */
    suspend fun retryCountryRebuild(goalId: UUID): MutationResult<Unit> =
        saveGoal(goalId, setOf(DataDomain.Goals), { api.rebuild(it, goalId) }) {
            copy(contentCountry = contentCountry?.copy(rebuild = GoalContentCountry.Rebuild.PREPARING))
        }

    /** The summary shows what the server saved even when reading it again fails, so a pick never looks undone. */
    private suspend fun <T> saveGoal(
        goalId: UUID,
        invalidating: Set<DataDomain>,
        write: suspend (AuthenticatedSession) -> T,
        saved: LearnerSummaryGoal.(T) -> LearnerSummaryGoal,
    ): MutationResult<Unit> =
        when (val result = cache.mutate(invalidating, write = write)) {
            is MutationResult.Done -> {
                summary.update { shown -> shown.copy(goals = shown.goals.map { if (it.id == goalId) it.saved(result.value) else it }) }
                MutationResult.Done(Unit)
            }

            is MutationResult.Failed -> {
                result
            }

            MutationResult.Obsolete -> {
                MutationResult.Obsolete
            }
        }

    /** A learner's edit, from their tap. */
    suspend fun change(
        goalId: UUID,
        operations: List<PlanOp>,
    ): MutationResult<PlanChangeResult> = write(goalId) { api.change(it, goalId, operations) }

    suspend fun undo(
        goalId: UUID,
        changeId: UUID,
    ): MutationResult<PlanChange> = write(goalId) { api.decide(it, goalId, changeId, PlanChangeDecisionInput.Status.UNDONE, quote = null) }

    /**
     * Answers the [change] the learner sees with its quote, and returns the change as it now stands: an
     * accept whose numbers moved since comes back still proposed, with today's numbers and quote.
     */
    suspend fun decideChange(
        goalId: UUID,
        change: PlanChange,
        status: PlanChangeDecisionInput.Status,
    ): MutationResult<PlanChange> = write(goalId) { api.decide(it, goalId, change.id, status, change.quote) }

    suspend fun chooseExamOption(
        goalId: UUID,
        group: String,
        subjects: List<String>,
    ): MutationResult<PlanChangeResult> = write(goalId) { api.chooseExamOption(it, goalId, group, subjects) }

    suspend fun chooseTools(
        goalId: UUID,
        answer: ToolAnswer,
    ): MutationResult<Written<PlanChangeResult>> = write(goalId) { api.chooseTools(it, goalId, answer) }

    suspend fun basesAdvice(goalId: UUID): MutationResult<PlanBasesAdvice> = cache.mutate { api.basesAdvice(it, goalId) }

    /** From the learner's tap only: it starts research and writing. The new goal becomes the active one, as main's `createGoals` revalidates. */
    suspend fun continueAtNextLevel(goalId: UUID): MutationResult<Unit> =
        cache.mutate(invalidating = setOf(DataDomain.Goals, DataDomain.LearningProfile)) { api.continueAtNextLevel(it, goalId) }

    /** What an edit would do: it saves nothing, so nothing is read again. */
    suspend fun preview(
        goalId: UUID,
        operations: List<PlanOp>,
    ): MutationResult<PlanChangePreview> = cache.mutate { api.preview(it, goalId, operations) }

    /** Plans the goal at each daily time, so only from the learner's tap. It saves nothing, so nothing is read again. */
    suspend fun timeToCover(goalId: UUID): MutationResult<PlanTimeToCover> = cache.mutate { api.timeToCover(it, goalId) }

    /** A far topic's lesson plan as it stands: read when its sheet opens and while it's written, never written. */
    suspend fun outline(
        goalId: UUID,
        skillId: UUID,
    ): MutationResult<SkillOutline> = cache.mutate { api.outline(it, goalId, skillId) }

    /** Writes a far topic's lesson plan with a model, so only from the learner's tap. */
    suspend fun writeOutline(
        goalId: UUID,
        skillId: UUID,
    ): MutationResult<SkillOutlineGeneration> =
        cache.mutate(invalidating = setOf(DataDomain.Allowance)) {
            api.writeOutline(it, goalId, skillId)
        }

    /** A far topic's lessons were written: the plan and the syllabus read again to show them. */
    fun outlineLanded() = cache.invalidate(setOf(DataDomain.Goals))

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
        internal val CLOCK_MARGIN = 1.minutes
    }
}
