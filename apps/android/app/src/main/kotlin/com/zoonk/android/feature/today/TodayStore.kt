package com.zoonk.android.feature.today

import androidx.compose.runtime.Immutable
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.value
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.DayView
import com.zoonk.android.feature.session.toDayView
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguageToday
import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.MistakeListAvailability
import com.zoonk.api.models.SuggestedGoal
import com.zoonk.api.models.Today
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.serialization.Contextual
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import java.util.UUID
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Instant

/** What `GET /today` says about the learner's day, its "no" answers included. */
sealed interface TodayRead {
    @Immutable
    data class Day(
        val today: Today,
        val day: DayView,
    ) : TodayRead

    /** Only quick explanations, or nothing: a course from before goals may be offered first. */
    data class NoGoal(
        val suggestedGoal: SuggestedGoal?,
    ) : TodayRead

    /** The plan is still being built after onboarding. */
    data class Preparing(
        val goalId: UUID,
        val title: String,
    ) : TodayRead

    /** Paused, finished or archived. */
    data object GoalNotActive : TodayRead
}

interface TodayApi {
    /** The day in the device's [timeZone], which the goal follows. */
    suspend fun today(
        session: AuthenticatedSession,
        timeZone: String,
    ): Today

    /** Whether Today's day for [goalId] changed since [since], cheaply, so a poll reads the day again only then. */
    suspend fun todayChanged(
        session: AuthenticatedSession,
        goalId: UUID,
        since: Instant,
    ): Boolean

    /** Everything the learner has learned, in points; null before any. */
    suspend fun brainPower(session: AuthenticatedSession): Long?

    /** Mistakes ready to practice now and those back tomorrow. */
    suspend fun mistakes(
        session: AuthenticatedSession,
        goalId: UUID,
    ): MistakeListAvailability

    /** A language goal's level and its exam-style speaking. */
    suspend fun language(
        session: AuthenticatedSession,
        goalId: UUID,
    ): LanguageToday

    /** Whether resuming a paused goal moves the paused days' lessons to today. */
    suspend fun resumePreview(
        session: AuthenticatedSession,
        goalId: UUID,
    ): Boolean

    /** Throws `GOAL_LIMIT_REACHED` when the learner's plan follows no more goals. */
    suspend fun resume(
        session: AuthenticatedSession,
        goalId: UUID,
    )

    /** Accepting a plan change or a schedule idea applies it; dismissing an applied one undoes it. */
    suspend fun answerInsight(
        session: AuthenticatedSession,
        insightId: UUID,
        accepted: Boolean,
    )

    /** Starts writing the day's lessons nobody is outlining yet; the next read says they're coming. */
    suspend fun prepareLessons(
        session: AuthenticatedSession,
        goalId: UUID,
    )

    /** The answer as saved: answered elsewhere first, it may differ. */
    suspend fun answerSuggestedGoal(
        session: AuthenticatedSession,
        suggestionId: UUID,
        accepted: Boolean,
    ): SuggestedGoal
}

class TodayStore(
    private val api: TodayApi,
    private val cache: AppCache,
    scope: CoroutineScope,
    private val timeZone: () -> String,
    private val now: () -> Long = System::currentTimeMillis,
) {
    val today: Resource<TodayRead> =
        cache.resource(Audience.SignedIn, DOMAINS) { session ->
            session?.let { readToday(it) }
        }

    private var readAt: Instant? = null
    private var reads = 0
    private var polledReads = 0
    private var polling = false

    private suspend fun readToday(session: AuthenticatedSession): TodayRead {
        // Taken before the first suspension, so a read an invalidation starts meanwhile reads in full.
        val conditional = polling.also { polling = false }
        val shown = today.state.value.value as? TodayRead.Day
        val since = readAt
        if (conditional && shown != null && since != null && !api.todayChanged(session, shown.today.goal.id, since)) return shown
        val startedAt = Instant.fromEpochMilliseconds(now()) - PlanStore.CLOCK_MARGIN
        return read(api, session, timeZone()).also {
            readAt = startedAt
            reads++
        }
    }

    /** Read where the missions' reward explains Brain Power. */
    val brainPower: Resource<Long> =
        cache.resource(Audience.SignedIn, setOf(DataDomain.UserProgress)) { session -> session?.let { api.brainPower(it) } }

    val mistakes =
        cache.keyed<UUID, MistakeListAvailability>(Audience.SignedIn, setOf(DataDomain.UserProgress)) { session, goalId ->
            session?.let { api.mistakes(it, goalId) }
        }

    val language =
        cache.keyed<UUID, LanguageToday>(Audience.SignedIn, LANGUAGE_DOMAINS) { session, goalId ->
            session?.let { api.language(it, goalId) }
        }

    val resumePreview =
        cache.keyed<UUID, Boolean>(Audience.SignedIn, setOf(DataDomain.Goals)) { session, goalId ->
            session?.let { api.resumePreview(it, goalId) }
        }

    /**
     * While lessons are written: asks whether the day changed since it was read, and reads it again
     * only then, since the server plans again on every read. True when the day was read again since
     * the last poll, by this poll or by anything else.
     */
    suspend fun refreshIfChanged(): Boolean {
        polling = true
        try {
            today.refresh()
        } finally {
            polling = false
        }
        return (reads != polledReads).also { polledReads = reads }
    }

    /** Whether Today shows [goalId]'s day, or no goal's day at all (nothing stale is on screen). */
    fun shows(goalId: UUID): Boolean = (today.state.value.value as? TodayRead.Day)?.let { it.today.goal.id == goalId } ?: true

    /** False when the learner's plan follows no more goals. */
    suspend fun resume(goalId: UUID): MutationResult<Boolean> =
        cache.mutate(invalidating = setOf(DataDomain.Goals, DataDomain.UserSession)) { session ->
            try {
                api.resume(session, goalId)
                true
            } catch (e: ApiException) {
                if (e.code == "GOAL_LIMIT_REACHED") false else throw e
            }
        }

    suspend fun prepareLessons(goalId: UUID): MutationResult<Unit> = cache.mutate(invalidating = DOMAINS) { api.prepareLessons(it, goalId) }

    suspend fun answer(
        suggestion: SuggestedGoal,
        accepted: Boolean,
    ): MutationResult<SuggestedGoal> =
        cache.mutate(invalidating = setOf(DataDomain.Goals)) { api.answerSuggestedGoal(it, suggestion.id, accepted) }

    suspend fun answerInsight(
        insight: MemoryInsight,
        accepted: Boolean,
    ): MutationResult<Unit> =
        cache.mutate(invalidating = setOf(DataDomain.Memory, DataDomain.Goals, DataDomain.UserSession)) {
            api.answerInsight(it, insight.id, accepted)
        }

    init {
        // The day gives way at its end (midnight, or later for a session carried past it) without a write.
        scope.launch {
            today.state
                .map { (it.value as? TodayRead.Day)?.day?.dayEndsAt }
                .distinctUntilChanged()
                .collectLatest { endsAt ->
                    endsAt ?: return@collectLatest
                    delay((endsAt - now()).coerceAtLeast(0).milliseconds)
                    today.invalidate()
                }
        }
    }

    companion object {
        /** What the day is built from: the goal and plan, the buddy's insights, progress, the day's session and the tier. */
        val DOMAINS =
            setOf(
                DataDomain.Goals,
                DataDomain.LearningProfile,
                DataDomain.Memory,
                DataDomain.UserProgress,
                DataDomain.UserSession,
                DataDomain.UserSubscription,
            )

        /** The level moves with progress; the tier marks speaking Plus. */
        private val LANGUAGE_DOMAINS =
            setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSubscription)
    }
}

internal suspend fun read(
    api: TodayApi,
    session: AuthenticatedSession,
    timeZone: String,
): TodayRead =
    try {
        api.today(session, timeZone).let { TodayRead.Day(it, it.session.toDayView()) }
    } catch (e: ApiException) {
        when (e.code) {
            "NO_ACTIVE_GOAL" -> {
                TodayRead.NoGoal(e.details.decode<NoGoalDetails>()?.suggestedGoal)
            }

            "GOAL_NOT_ACTIVE" -> {
                TodayRead.GoalNotActive
            }

            "PLAN_NOT_READY" -> {
                e.details
                    .decode<PreparingDetails>()
                    ?.goal
                    ?.let { TodayRead.Preparing(it.id, it.title) } ?: throw e
            }

            else -> {
                throw e
            }
        }
    }

private inline fun <reified T> JsonElement?.decode(): T? =
    (this as? JsonObject)?.let {
        try {
            ApiJson.decodeFromJsonElement<T>(it)
        } catch (e: IllegalArgumentException) {
            null
        }
    }

@Serializable
private data class NoGoalDetails(
    val suggestedGoal: SuggestedGoal? = null,
)

@Serializable
private data class PreparingDetails(
    val goal: PreparingGoal? = null,
)

@Serializable
private data class PreparingGoal(
    @Contextual val id: UUID,
    val title: String,
)
