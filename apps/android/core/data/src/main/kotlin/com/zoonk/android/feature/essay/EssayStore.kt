package com.zoonk.android.feature.essay

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.DraftHandle
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.feature.writing.WritingTaskName
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CreateWritingBlockRequest
import com.zoonk.api.models.Essay
import com.zoonk.api.models.EssaySubmissionInput
import com.zoonk.api.models.SaveWritingDraft
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.StudySessionTimeZone
import com.zoonk.api.models.WritingAttempt
import com.zoonk.api.models.WritingDraft
import com.zoonk.api.models.WritingResultOutput
import com.zoonk.api.models.WritingStart
import com.zoonk.api.models.WritingStartInput
import com.zoonk.api.models.WritingStartOneOf1
import com.zoonk.api.models.WritingStartOneOf2Task
import kotlinx.datetime.LocalDate
import kotlinx.serialization.SerializationException
import retrofit2.Response
import java.util.UUID

/** A writing start's answer: the grading admitted, the question still being written, or the day's extra grades used. */
sealed interface WritingStartAnswer {
    data class Ready(
        val admissionId: UUID,
    ) : WritingStartAnswer

    /** [drill]: the run writes a short exercise, not a whole answer's question. */
    data class Writing(
        val generationId: String,
        val drill: Boolean = false,
    ) : WritingStartAnswer

    /** [task] is what's left for tomorrow, when the refusal names it. */
    data class LimitReached(
        val returnsOn: LocalDate,
        val task: RefusedTask? = null,
    ) : WritingStartAnswer

    /** A guest whose question would cost a model call: signing up funds it. */
    data object SignUpRequired : WritingStartAnswer

    /** The notice no longer asks this task; nothing was admitted. */
    data object Removed : WritingStartAnswer
}

/** The written task a refused start leaves for tomorrow. */
data class RefusedTask(
    val description: String,
    val minutes: Int,
    val lines: Int? = null,
    val drill: Boolean = false,
    /** Which question of the written test it is, when the server says. */
    val name: WritingTaskName? = null,
)

/** A draft save: kept, refused because another device saved first (with the draft it saved), or the block is closed. */
sealed interface DraftSave {
    data class Saved(
        val draft: WritingDraft,
    ) : DraftSave

    data class Conflict(
        val draft: WritingDraft,
    ) : DraftSave

    data object Closed : DraftSave
}

interface EssayApi {
    suspend fun essay(
        session: AuthenticatedSession,
        blockId: UUID,
        timeZone: String,
    ): Essay

    /** A rewrite names the graded answer it starts from; anything else replays the block's start. */
    suspend fun start(
        session: AuthenticatedSession,
        blockId: UUID,
        previousAttemptId: UUID?,
    ): WritingStartAnswer

    suspend fun saveDraft(
        session: AuthenticatedSession,
        blockId: UUID,
        draft: SaveWritingDraft,
    ): DraftSave

    suspend fun submit(
        session: AuthenticatedSession,
        blockId: UUID,
        input: EssaySubmissionInput,
    ): WritingResultOutput

    suspend fun finish(
        session: AuthenticatedSession,
        sessionId: UUID,
        blockId: UUID,
        timeZone: String,
    ): StudyBlockCompletion

    suspend fun attempt(
        session: AuthenticatedSession,
        attemptId: UUID,
    ): WritingAttempt

    /** The learner's own extra writing block, the same unfinished one on a repeat. */
    suspend fun createBlock(
        session: AuthenticatedSession,
        goalId: UUID,
        taskKey: String?,
    ): UUID
}

class LiveEssayApi(
    private val api: ApiClients,
) : EssayApi {
    override suspend fun essay(
        session: AuthenticatedSession,
        blockId: UUID,
        timeZone: String,
    ) = perform { api.clients(session).exams.getEssay(blockId, timeZone) }

    /** The 429's body is a start of its own shape, with the day the grades come back. */
    override suspend fun start(
        session: AuthenticatedSession,
        blockId: UUID,
        previousAttemptId: UUID?,
    ): WritingStartAnswer {
        var refusal: WritingStart? = null
        val start =
            try {
                perform {
                    api.clients(session).exams.startWriting(blockId, WritingStartInput(previousAttemptId)).also {
                        if (it.code() == TOO_MANY_REQUESTS) refusal = it.refusalBody<WritingStart>()
                    }
                }
            } catch (e: ApiException) {
                refusal?.takeIf { e.status == TOO_MANY_REQUESTS } ?: throw e
            }
        return start.toAnswer()
    }

    /** A 409 carries the draft another device saved, or no draft when the block is closed. */
    override suspend fun saveDraft(
        session: AuthenticatedSession,
        blockId: UUID,
        draft: SaveWritingDraft,
    ): DraftSave {
        var current: WritingDraft? = null
        return try {
            DraftSave.Saved(
                perform {
                    api.clients(session).exams.saveWritingDraft(blockId, draft).also {
                        if (it.code() == CONFLICT) current = it.refusalBody<WritingDraft>()
                    }
                },
            )
        } catch (e: ApiException) {
            if (e.status != CONFLICT) throw e
            current?.let(DraftSave::Conflict) ?: DraftSave.Closed
        }
    }

    /** Grading takes up to half a minute, past the regular read timeout. */
    override suspend fun submit(
        session: AuthenticatedSession,
        blockId: UUID,
        input: EssaySubmissionInput,
    ) = perform { api.streamingClients(session).exams.submitEssay(blockId, input) }

    override suspend fun finish(
        session: AuthenticatedSession,
        sessionId: UUID,
        blockId: UUID,
        timeZone: String,
    ) = perform {
        api.streamingClients(session).studySessions.createStudyBlockCompletion(sessionId, blockId, StudySessionTimeZone(timeZone))
    }

    override suspend fun attempt(
        session: AuthenticatedSession,
        attemptId: UUID,
    ) = perform { api.clients(session).exams.getWritingAttempt(attemptId) }

    override suspend fun createBlock(
        session: AuthenticatedSession,
        goalId: UUID,
        taskKey: String?,
    ): UUID = perform { api.clients(session).exams.createWritingBlock(goalId, CreateWritingBlockRequest(taskKey)) }.blockId

    private companion object {
        const val CONFLICT = 409
        const val TOO_MANY_REQUESTS = 429
    }
}

private inline fun <reified T> Response<*>.refusalBody(): T? =
    try {
        errorBody()?.string()?.let { ApiJson.decodeFromString<T>(it) }
    } catch (e: SerializationException) {
        null
    } catch (e: IllegalArgumentException) {
        null
    }

private fun WritingStartOneOf2Task.name(): WritingTaskName? {
    val number = number ?: return null
    val total = total ?: return null
    return WritingTaskName(lines?.toInt(), number.toInt(), total.toInt(), distinctLines == true)
}

private fun WritingStart.toAnswer(): WritingStartAnswer =
    when (this) {
        is WritingStart.WritingStartOneOfValue -> {
            WritingStartAnswer.Ready(value.admissionId)
        }

        is WritingStart.WritingStartOneOf1Value -> {
            WritingStartAnswer.Writing(value.runId, drill = value.unit == WritingStartOneOf1.Unit.DRILL)
        }

        is WritingStart.WritingStartOneOf2Value -> {
            WritingStartAnswer.LimitReached(
                value.returnsOn,
                value.task?.let {
                    RefusedTask(
                        it.description,
                        it.minutes.toInt(),
                        it.lines?.toInt(),
                        drill = it.unit == WritingStartOneOf2Task.Unit.DRILL,
                        name = it.name(),
                    )
                },
            )
        }
    }

/**
 * Where a start leads, carried by the essay's route as main carries it in the address: nothing
 * once it's admitted, the run writing the question, or what stands before it.
 */
fun WritingStartAnswer.routeValue(): String? =
    when (this) {
        is WritingStartAnswer.Ready -> null
        is WritingStartAnswer.Writing -> generationId
        is WritingStartAnswer.LimitReached -> WRITING_LIMIT
        WritingStartAnswer.SignUpRequired -> WRITING_SIGN_UP
        WritingStartAnswer.Removed -> WRITING_REMOVED
    }

/** What an essay's route says stood before its question, as [routeValue] wrote it. */
sealed interface WritingBefore {
    data class Writing(
        val generationId: String,
    ) : WritingBefore

    data object LimitReached : WritingBefore

    data object Failed : WritingBefore

    /** A guest whose question would cost a model call: an account funds it, so trying again can't. */
    data object SignUpRequired : WritingBefore

    data object Removed : WritingBefore

    companion object {
        fun of(value: String?): WritingBefore? =
            when (value) {
                null, "" -> null
                WRITING_LIMIT -> LimitReached
                WRITING_FAILED -> Failed
                WRITING_SIGN_UP -> SignUpRequired
                WRITING_REMOVED -> Removed
                else -> Writing(value)
            }
    }
}

private const val WRITING_LIMIT = "limit"
private const val WRITING_FAILED = "failed"
private const val WRITING_REMOVED = "removed"
private const val WRITING_SIGN_UP = "signUp"

suspend fun EssayApi.startAnswer(
    session: AuthenticatedSession,
    blockId: UUID,
    previousAttemptId: UUID? = null,
): WritingStartAnswer =
    try {
        start(session, blockId, previousAttemptId)
    } catch (e: ApiException) {
        when {
            e.code == SIGN_UP_REQUIRED -> WritingStartAnswer.SignUpRequired
            e.status == CONFLICT -> WritingStartAnswer.Removed
            else -> throw e
        }
    }

/**
 * Opening a written block is its start, as on main: the essay opens past it, on what stands before
 * its question, or on its Try again when the start couldn't answer.
 */
suspend fun EssayApi.startRoute(
    session: AuthenticatedSession,
    blockId: UUID,
): AppRoute.Essay {
    val answer =
        try {
            startAnswer(session, blockId)
        } catch (e: ApiException) {
            if (e.error == ApiError.Network) throw e
            null
        }
    val task = (answer as? WritingStartAnswer.LimitReached)?.task
    return AppRoute.Essay(
        blockId.toString(),
        writing = if (answer == null) WRITING_FAILED else answer.routeValue(),
        taskDescription = task?.description,
        taskMinutes = task?.minutes,
        taskLines = task?.lines,
        taskNumber = task?.name?.number,
        taskTotal = task?.name?.total,
        taskDistinctLines = task?.name?.distinctLines == true,
        drill = (answer as? WritingStartAnswer.Writing)?.drill ?: task?.drill ?: false,
    )
}

private const val SIGN_UP_REQUIRED = "SIGN_UP_REQUIRED"
private const val CONFLICT = 409

class EssayStore(
    private val api: EssayApi,
    private val cache: AppCache,
    private val drafts: DraftStore,
    private val timeZone: () -> String,
) {
    val essays =
        cache.keyed<UUID, Essay>(Audience.SignedIn, READ_DOMAINS) { session, blockId ->
            session?.let { api.essay(it, blockId, timeZone()) }
        }

    /** A past answer, opened from the written part's page. */
    val attempts =
        cache.keyed<UUID, WritingAttempt>(Audience.SignedIn, READ_DOMAINS) { session, attemptId ->
            session?.let { api.attempt(it, attemptId) }
        }

    /** The learner's tap: it admits the grading or answers with the run writing the question. */
    suspend fun start(
        blockId: UUID,
        previousAttemptId: UUID? = null,
    ): MutationResult<WritingStartAnswer> =
        cache
            .mutate { session ->
                api.startAnswer(session, blockId, previousAttemptId)
            }.also { if (it is MutationResult.Done) dayChanged(blockId) }

    suspend fun saveDraft(
        blockId: UUID,
        draft: SaveWritingDraft,
    ): MutationResult<DraftSave> {
        val essay = essays[blockId]
        val before = (essay.state.value as? LoadState.Loaded)?.value
        return cache
            .mutate(
                replacing = { result ->
                    val saved =
                        when (result) {
                            is DraftSave.Saved -> result.draft
                            is DraftSave.Conflict -> result.draft
                            DraftSave.Closed -> return@mutate emptyList()
                        }
                    val current = (essay.state.value as? LoadState.Loaded)?.value ?: return@mutate emptyList()
                    val currentDraft = current.draft
                    val changedAdmission = current.admissionId != saved.admissionId && current.admissionId != before?.admissionId
                    val newerDraft = currentDraft?.admissionId == saved.admissionId && currentDraft.revision >= saved.revision
                    if (current.status != Essay.Status.ACTIVE || changedAdmission || current.drafts != before?.drafts || newerDraft) {
                        emptyList()
                    } else {
                        listOf(essay.replacing(current.copy(admissionId = saved.admissionId, draft = saved)))
                    }
                },
            ) { session -> api.saveDraft(session, blockId, draft) }
            .also { if (it is MutationResult.Done) dayChanged(blockId) }
    }

    /**
     * A start or a saved draft changes the block's row on Today ("Your draft is saved"), so the day
     * reads again when shown. The save response updates the essay cache before the device copy is cleared.
     */
    private fun dayChanged(blockId: UUID) = cache.invalidate(setOf(DataDomain.UserSession), except = setOf(essays[blockId]))

    /**
     * Sending the same admission again replays its grade. The essay is read again afterwards, so the
     * graded draft it lists carries the attempt a rewrite starts from.
     */
    suspend fun submit(
        blockId: UUID,
        admissionId: UUID,
        text: String,
        durationMs: Long,
    ): MutationResult<WritingResultOutput> =
        cache
            .mutate { session -> api.submit(session, blockId, EssaySubmissionInput(admissionId, durationMs, text, timeZone())) }
            .also {
                if (it is MutationResult.Done) {
                    val essay = essays[blockId]
                    essay.invalidate()
                    essay.refresh()
                }
            }

    suspend fun finish(
        sessionId: UUID,
        blockId: UUID,
    ): MutationResult<StudyBlockCompletion> =
        cache.mutate(invalidating = FINISHED) { session -> api.finish(session, sessionId, blockId, timeZone()) }

    /** "Write" on a page: the learner's own block, then its start, as the tap's one request chain. */
    suspend fun writeNow(
        goalId: UUID,
        taskKey: String? = null,
    ): MutationResult<AppRoute.Essay> =
        cache.mutate(invalidating = OPENED) { session ->
            api.startRoute(session, api.createBlock(session, goalId, taskKey))
        }

    /** What this device typed, kept through process death until the server has it. */
    fun keptText(
        session: AuthenticatedSession,
        blockId: UUID,
    ): DraftHandle<KeptWriting> = drafts.open(session, "writing:$blockId", KeptWriting.serializer())

    private companion object {
        val READ_DOMAINS = setOf(DataDomain.UserSession)
        val OPENED = setOf(DataDomain.Goals, DataDomain.UserSession)
        val FINISHED = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSession)
    }
}
