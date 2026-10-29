package com.zoonk.android.feature.onboarding

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Replacement
import com.zoonk.android.data.SessionSource
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CreateUploadRequest
import com.zoonk.api.models.CreateUploadRequestOneOf
import com.zoonk.api.models.CreateUploadRequestOneOf1
import com.zoonk.api.models.CreateUploadRequestOneOf2
import com.zoonk.api.models.Generation
import com.zoonk.api.models.GoalCreateInput
import com.zoonk.api.models.MaterialQuestionAnswer
import com.zoonk.api.models.MaterialQuestionInput
import com.zoonk.api.models.OnboardingDraft
import com.zoonk.api.models.OnboardingDraftEdit
import com.zoonk.api.models.PlanLinkStartInput
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import java.net.URI
import java.net.URISyntaxException
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

/**
 * Onboarding's reads and writes, shared by the start, setup and course screens. A visitor's first
 * write starts a guest session, as main's anonymous sign-in does.
 */
class OnboardingStore(
    private val api: OnboardingApi,
    private val cache: AppCache,
    private val sessions: SessionSource,
    private val startGuest: suspend () -> Boolean,
) {
    /** Only this flow's writes change a draft, and each answers with the whole new draft. */
    val drafts =
        cache.keyed<String, OnboardingDraft>(Audience.SignedIn) { session, id ->
            session?.let { api.draft(it, id) }
        }

    val allowance =
        cache.resource(Audience.SignedIn, setOf(DataDomain.Allowance, DataDomain.Goals)) { session ->
            session?.let { api.allowance(it) }
        }

    /** Drafts this process sent from a tap: a draft opened later waits for the learner's own tap. */
    private val sent = mutableSetOf<String>()

    fun wasSentHere(draftId: String) = draftId in sent

    fun forgetSent(draftId: String) {
        sent -= draftId
    }

    val generations: GenerationSource =
        object : GenerationSource {
            override fun events(id: String): Flow<GenerationEvent> =
                flow {
                    val session = sessions.current ?: return@flow
                    emitAll(api.generationEvents(session, id))
                }

            override suspend fun status(id: String): Generation.Status =
                api.generationStatus(sessions.current ?: throw ApiException(ApiError.Unauthorized), id)
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
     * The main goal's id. From a shared plan ([planId]) the goal follows that plan, as main's
     * `/start?plan=` does; a learner who owns the plan gets their own goal back.
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
