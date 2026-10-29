package com.zoonk.android.feature.onboarding

import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Replacement
import com.zoonk.android.data.SessionSource
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.audio.toGradeOutcome
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CreateUploadRequest
import com.zoonk.api.models.CreateUploadRequestOneOf
import com.zoonk.api.models.CreateUploadRequestOneOf1
import com.zoonk.api.models.CreateUploadRequestOneOf2
import com.zoonk.api.models.Goal
import com.zoonk.api.models.GoalCreateInput
import com.zoonk.api.models.GoalGenerationRun
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.LanguageLevelTestAnswerInput
import com.zoonk.api.models.LanguageLevelTestSpokenResult
import com.zoonk.api.models.MaterialQuestionAnswer
import com.zoonk.api.models.MaterialQuestionInput
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.Onboarding
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingDraft
import com.zoonk.api.models.OnboardingDraftEdit
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementAnswer
import com.zoonk.api.models.PlacementAnswerInput
import com.zoonk.api.models.PlacementAnswerResult
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanLinkStartInput
import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeAdviceInput
import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.PlanTimeToCoverInput
import com.zoonk.api.models.Syllabus
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import java.net.URI
import java.net.URISyntaxException
import java.util.TimeZone
import java.util.UUID

/** What a learner's plan or the server's pace refused; any other failure is [WriteOutcome.Failed]. */
sealed interface Refusal {
    data class Limit(
        val limit: UsageLimit,
    ) : Refusal

    /** A guest once the day's AI budget all guests share is spent, or an action that needs an account. */
    data object SignUpRequired : Refusal

    data object SlowDown : Refusal

    data object Unsupported : Refusal
}

sealed interface WriteOutcome<out T> {
    data class Done<T>(
        val value: T,
    ) : WriteOutcome<T>

    data class Refused(
        val refusal: Refusal,
    ) : WriteOutcome<Nothing>

    data object Failed : WriteOutcome<Nothing>

    /** Another session is current now: change nothing on screen. */
    data object Obsolete : WriteOutcome<Nothing>
}

@Serializable
data class AttachedSource(
    val id: String,
    val title: String,
)

/** A visitor's first write starts a guest session, as an anonymous sign-in does. */
class OnboardingStore(
    private val api: OnboardingApi,
    private val cache: AppCache,
    private val sessions: SessionSource,
    private val startGuest: suspend () -> Boolean,
) {
    /** Each fix answers with the whole new draft; confirming it gives it a goal, so goal changes read it again. */
    val drafts =
        cache.keyed<String, OnboardingDraft>(Audience.SignedIn, setOf(DataDomain.Goals)) { session, id ->
            session?.let { api.draft(it, id) }
        }

    val allowance =
        cache.resource(Audience.SignedIn, setOf(DataDomain.Allowance, DataDomain.Goals)) { session ->
            session?.let { api.allowance(it) }
        }

    /** A goal's setup; each answer replies with the whole new setup. */
    val onboardings =
        cache.keyed<String, Onboarding>(Audience.SignedIn, setOf(DataDomain.Goals, DataDomain.LearningProfile, DataDomain.LearnerModel)) {
            session,
            goalId,
            ->
            session?.let { api.onboarding(it, goalId) }
        }

    /** Drafts this process sent from a tap: a draft opened later waits for the learner's own tap. */
    private val sent = mutableSetOf<String>()

    fun wasSentHere(draftId: String) = draftId in sent

    fun forgetSent(draftId: String) {
        sent -= draftId
    }

    /** Reads as whoever is signed in at each read: a visitor's first send signs in a guest while its run is followed. */
    val generations: GenerationSource =
        object : GenerationSource {
            override fun events(id: String) = api.generations(sessions.current).events(id)

            override suspend fun status(id: String) = api.generations(sessions.current).status(id)
        }

    suspend fun sendGoal(
        goal: String,
        language: String,
    ): WriteOutcome<OnboardingDraft> {
        if (sessions.current == null && !startGuest()) return WriteOutcome.Failed
        return write(setOf(DataDomain.Allowance), replacing = ::replacingDraft) { api.understand(it, goal, language) }
            .also { if (it is WriteOutcome.Done) sent += it.value.id.toString() }
    }

    suspend fun readAgain(draftId: String) = write(setOf(DataDomain.Allowance), replacing = ::replacingDraft) { api.readAgain(it, draftId) }

    suspend fun revise(
        draftId: String,
        edit: OnboardingDraftEdit,
    ) = write(replacing = ::replacingDraft) { api.revise(it, draftId, edit) }

    /**
     * The main goal's id. From a shared plan ([planId]) the goal follows that plan; a learner who
     * owns the plan gets their own goal back.
     */
    suspend fun createGoals(
        input: GoalCreateInput,
        planId: String? = null,
    ): WriteOutcome<String> =
        write(setOf(DataDomain.Goals, DataDomain.LearningProfile, DataDomain.Allowance)) { session ->
            if (planId == null) {
                api
                    .createGoals(session, input)
                    .goals
                    .first()
                    .id
                    .toString()
            } else {
                val main = input.goals.first()
                val start =
                    PlanLinkStartInput(
                        dailyMinutes = input.dailyMinutes,
                        studyDays = input.studyDays,
                        studyTime = input.studyTime,
                        timeZone = input.timeZone,
                        targetDate = main.targetDate,
                        title = main.title,
                    )
                api.createFromPlanLink(session, planId, start).id.toString()
            }
        }

    /** A language goal whose reason names a certificate moves to that exam: the reply is the new goal's setup. */
    suspend fun answer(
        goalId: String,
        input: OnboardingAnswerInput,
    ): WriteOutcome<Onboarding> =
        write(
            invalidating = setOf(DataDomain.Goals, DataDomain.LearningProfile, DataDomain.LearnerModel),
            replacing = { listOf(onboardings[it.goal.id.toString()].replacing(it)) },
        ) { api.answer(it, goalId, input) }

    val generationRuns =
        cache.keyed<String, GoalGenerationRun>(Audience.SignedIn, setOf(DataDomain.Goals)) { session, goalId ->
            session?.let { api.goalGenerationRun(it, goalId) }
        }

    /** What a daily time and week would cover: the server plans the goal for it without saving anything. */
    val timeAdvice =
        cache.keyed<AdviceQuery, PlanTimeAdvice>(Audience.SignedIn, setOf(DataDomain.Goals, DataDomain.LearnerModel)) { session, query ->
            session?.let { api.timeAdvice(it, query.goal.id.toString(), query.input) }
        }

    /** Read only from the learner's tap: the server plans the goal at each daily time. */
    val timesToCover =
        cache.keyed<CoverQuery, PlanTimeToCover>(Audience.SignedIn, setOf(DataDomain.Goals, DataDomain.LearnerModel)) { session, query ->
            session?.let { api.timeToCover(it, query.goal.id.toString(), query.input) }
        }

    suspend fun writeGoal(goalId: String) = write { api.writeGoal(it, goalId) }

    /** Archives what this onboarding made, so the learner starts over from their words. */
    suspend fun startOver(goalIds: List<String>) =
        write(setOf(DataDomain.Goals, DataDomain.LearningProfile, DataDomain.LearnerModel)) { session ->
            coroutineScope { goalIds.map { async { api.archive(session, it) } }.awaitAll() }
            Unit
        }

    suspend fun joinWaitlist(
        instrument: String,
        language: String,
    ) = write(setOf(DataDomain.InstrumentWaitlist)) { api.joinWaitlist(it, instrument, language) }

    suspend fun attachText(
        text: String,
        language: String,
    ) = attach(
        CreateUploadRequest.CreateUploadRequestOneOf2Value(
            CreateUploadRequestOneOf2(language = language, kind = CreateUploadRequestOneOf2.Kind.TEXT, text = text),
        ),
    )

    suspend fun attachLink(
        url: String,
        language: String,
    ): WriteOutcome<AttachedSource> {
        val uri =
            try {
                URI(url).takeIf { it.scheme == "http" || it.scheme == "https" }
            } catch (e: URISyntaxException) {
                null
            } ?: return WriteOutcome.Refused(Refusal.Unsupported)
        return attach(
            CreateUploadRequest.CreateUploadRequestOneOf1Value(
                CreateUploadRequestOneOf1(language = language, kind = CreateUploadRequestOneOf1.Kind.LINK, url = uri),
            ),
        )
    }

    /** A name can't nest folders or climb out with "..", and its own id keeps two files of the same name apart. */
    suspend fun attachFile(
        file: PickedFile,
        language: String,
    ): WriteOutcome<AttachedSource> =
        write(setOf(DataDomain.Allowance)) { session ->
            val name = file.name.replace('/', '-').replace(Regex("\\.{2,}"), ".")
            val pathname = "sources/${session.accountId}/${UUID.randomUUID()}-$name"
            api.uploadFile(session, pathname, file)
            api
                .attach(
                    session,
                    CreateUploadRequest.CreateUploadRequestOneOfValue(
                        CreateUploadRequestOneOf(language = language, kind = CreateUploadRequestOneOf.Kind.FILE, pathname = pathname),
                    ),
                ).let { AttachedSource(it.id.toString(), it.title) }
        }

    suspend fun askMaterial(
        question: String,
        sourceIds: List<String>,
        language: String,
    ): WriteOutcome<MaterialQuestionAnswer> =
        write(setOf(DataDomain.Allowance)) {
            api.askMaterial(it, MaterialQuestionInput(language, question, sourceIds.map(UUID::fromString)))
        }

    private suspend fun attach(request: CreateUploadRequest) =
        write(setOf(DataDomain.Allowance)) { session ->
            api.attach(session, request).let { AttachedSource(it.id.toString(), it.title) }
        }

    private fun replacingDraft(draft: OnboardingDraft) = listOf(drafts[draft.id.toString()].replacing(draft))

    private suspend fun <T> write(
        invalidating: Set<DataDomain> = emptySet(),
        replacing: (T) -> List<Replacement> = { emptyList() },
        write: suspend (AuthenticatedSession) -> T,
    ): WriteOutcome<T> {
        val result =
            cache.mutate<WriteOutcome<T>>(
                invalidating = invalidating,
                replacing = { outcome -> (outcome as? WriteOutcome.Done)?.let { replacing(it.value) }.orEmpty() },
            ) { session ->
                try {
                    WriteOutcome.Done(write(session))
                } catch (e: ApiException) {
                    WriteOutcome.Refused(e.refusal() ?: throw e)
                }
            }
        return when (result) {
            is MutationResult.Done -> result.value
            is MutationResult.Failed -> WriteOutcome.Failed
            MutationResult.Obsolete -> WriteOutcome.Obsolete
        }
    }

    val placements =
        cache.keyed<String, Placement>(Audience.SignedIn, setOf(DataDomain.Goals, DataDomain.LearnerModel)) { session, goalId ->
            session?.let { api.placement(it, goalId) }
        }

    val placementMocks =
        cache.keyed<String, MockOptions>(Audience.SignedIn, setOf(DataDomain.Goals, DataDomain.UserSubscription)) { session, goalId ->
            session?.let {
                try {
                    api.mockOptions(it, goalId)
                } catch (e: ApiException) {
                    if (e.code == "NOT_AN_EXAM") null else throw e
                }
            }
        }

    val plans =
        cache.keyed<String, Plan>(Audience.SignedIn, setOf(DataDomain.Goals, DataDomain.LearnerModel)) { session, goalId ->
            session?.let { api.plan(it, goalId) }
        }

    val syllabi =
        cache.keyed<String, Syllabus>(
            Audience.SignedIn,
            setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress),
        ) { session, goalId -> session?.let { api.syllabus(it, goalId) } }

    suspend fun answerPlacement(
        goalId: String,
        itemId: String,
        answer: PlacementAnswer,
        durationMs: Long,
    ): WriteOutcome<PlacementAnswerResult> =
        write(
            setOf(DataDomain.LearnerModel),
            replacing = { listOf(placements[goalId].replacing(it.placement)) },
        ) { session ->
            val input =
                PlacementAnswerInput(
                    answer = answer,
                    durationMs = durationMs,
                    itemId = UUID.fromString(itemId),
                    timeZone = TimeZone.getDefault().id,
                )
            api.answerPlacement(session, goalId, input)
        }

    /** The API starts writing the lessons the plan now opens with, so nothing else prepares them. */
    suspend fun finishPlacement(
        goalId: String,
        fromScratch: Boolean,
    ) = write(setOf(DataDomain.Goals, DataDomain.LearnerModel)) { api.finishPlacement(it, goalId, fromScratch) }

    /** The goal's mock offer is read again, so a stopped mock no longer shows as running. */
    suspend fun stopPlacementMock(
        goalId: String,
        mockId: String,
    ) = write(setOf(DataDomain.LearnerModel)) { api.finishMock(it, mockId) }
        .also { if (it is WriteOutcome.Done) placementMocks[goalId].invalidate() }

    /** A language goal's level test; each answer replies with its next step. */
    val levelTests =
        cache.keyed<String, LanguageLevelTest>(Audience.SignedIn, setOf(DataDomain.Goals)) { session, goalId ->
            session?.let { api.levelTest(it, goalId) }
        }

    suspend fun prepareLevelTest(goalId: String) = write { api.prepareLevelTest(it, goalId) }

    suspend fun answerLevelTest(
        goalId: String,
        questionId: String,
        answerIndex: Long?,
        durationMs: Long,
    ) = write(replacing = { listOf(levelTests[goalId].replacing(it)) }) {
        api.answerLevelTest(it, goalId, LanguageLevelTestAnswerInput(questionId, answerIndex, durationMs))
    }

    /** The recorder's grading write; its reply is the test's next step. */
    suspend fun speakLevelTest(
        goalId: String,
        recording: VoiceRecording,
    ): GradeOutcome<LanguageLevelTestSpokenResult> =
        cache
            .mutate(setOf(DataDomain.Allowance), replacing = { listOf(levelTests[goalId].replacing(it.test)) }) {
                api.speakLevelTest(it, goalId, recording)
            }.toGradeOutcome()

    /** Saves the test's levels as the plan's start; a test whose questions were never written has none to save. */
    suspend fun finishLevelTest(goalId: String) =
        write(setOf(DataDomain.Goals, DataDomain.UserProgress)) { session ->
            try {
                api.finishLevelTest(session, goalId)
            } catch (e: ApiException) {
                if (e.code != "LEVEL_TEST_PREPARING") throw e
            }
        }
}

/** [period] is `day`, `month` or `total`; [resource] what ran out (`goal`, `activeGoals`, `upload`); [tier] `guest`, `free` or `plus`. */
@Serializable
data class UsageLimit(
    val period: String,
    val resource: String,
    val tier: String,
)

@Serializable
private class LimitDetails(
    val limit: UsageLimit,
)

/** Usage limits nest the limit under `details.limit`; goal limits send it as `details`; any other 429 asks to slow down. */
internal fun ApiException.refusal(): Refusal? =
    when (code) {
        "SIGN_UP_REQUIRED", "ACCOUNT_REQUIRED" -> Refusal.SignUpRequired
        "SLOW_DOWN", "RATE_LIMIT_EXCEEDED" -> Refusal.SlowDown
        "UNPROCESSABLE_ENTITY" -> Refusal.Unsupported
        "USAGE_LIMIT_REACHED" -> details?.decode<LimitDetails>()?.limit?.let(Refusal::Limit)
        "GOAL_LIMIT_REACHED" -> details?.decode<UsageLimit>()?.let(Refusal::Limit)
        else -> Refusal.SlowDown.takeIf { status == TOO_MANY_REQUESTS }
    }

private const val TOO_MANY_REQUESTS = 429

private inline fun <reified T> JsonElement.decode(): T? =
    try {
        ApiJson.decodeFromJsonElement<T>(jsonObject)
    } catch (e: SerializationException) {
        null
    } catch (e: IllegalArgumentException) {
        null
    }

/** Keyed by the whole [goal], so an answer that changed it (a new date, level or purpose) reads again. */
data class AdviceQuery(
    val goal: Goal,
    val input: PlanTimeAdviceInput,
)

/** [build] counts the plan's rebuilds, so a time found for an earlier build is never shown again. */
data class CoverQuery(
    val goal: Goal,
    val input: PlanTimeToCoverInput,
    val build: Int,
)
