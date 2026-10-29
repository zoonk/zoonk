package com.zoonk.android.feature.player

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionSource
import com.zoonk.android.data.generationEvents
import com.zoonk.android.data.perform
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.Generation
import com.zoonk.api.models.GenerationWaitInput
import com.zoonk.api.models.LessonGeneration
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.ReadyAlternative
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.job
import kotlinx.coroutines.launch

@Immutable
sealed interface LessonWriting {
    /** Nothing writes it yet: it waits for "Start this lesson". */
    data object NotStarted : LessonWriting

    data object Starting : LessonWriting

    /** A run writes it, followed in [LessonWritingViewModel.run]. */
    data object Writing : LessonWriting

    /** Asking to write it failed; it shows as a run that didn't start. */
    data object Failed : LessonWriting

    data object Ready : LessonWriting

    /** Every draft was held back by its checks; plans go on without it. */
    data object SetAside : LessonWriting

    data class Refused(
        val refusal: LessonRefusal,
    ) : LessonWriting
}

interface LessonWritingApi {
    fun events(
        generationId: String,
        session: AuthenticatedSession,
    ): Flow<GenerationEvent>

    suspend fun status(
        generationId: String,
        session: AuthenticatedSession,
    ): Generation.Status

    suspend fun recordWait(
        session: AuthenticatedSession,
        milliseconds: Long,
    )
}

class LiveLessonWritingApi(
    private val api: ApiClients,
) : LessonWritingApi {
    override fun events(
        generationId: String,
        session: AuthenticatedSession,
    ): Flow<GenerationEvent> = api.generationEvents(generationId, session)

    override suspend fun status(
        generationId: String,
        session: AuthenticatedSession,
    ): Generation.Status = perform { api.clients(session).workflows.getGeneration(generationId) }.status

    override suspend fun recordWait(
        session: AuthenticatedSession,
        milliseconds: Long,
    ) {
        perform {
            api.clients(session).contentGeneration.createGenerationWait(
                GenerationWaitInput(
                    contentKind = GenerationWaitInput.ContentKind.LESSON,
                    milliseconds = milliseconds,
                    platform = GenerationWaitInput.Platform.ANDROID,
                ),
            )
        }
    }
}

/**
 * A lesson not written yet, for the learner who opened it: writing it runs AI, so it starts only
 * from their tap, then its run is followed until the lesson is ready. Another session reads it again.
 */
class LessonWritingViewModel(
    private val lessonId: String,
    private val store: LessonPlayerStore,
    private val writingApi: LessonWritingApi,
    private val cache: AppCache,
    private val sessions: SessionSource,
    private val now: () -> Long = System::currentTimeMillis,
) : ViewModel() {
    private val mutableWriting = MutableStateFlow<LessonWriting?>(null)
    private val mutableAlternative = MutableStateFlow<ReadyAlternative?>(null)
    private var owner: AuthenticatedSession? = null
    private var work = openScope()
    private var startedAt: Long? = null
    private var waitRecorded = false

    private val follower =
        GenerationFollower(
            kind = GenerationKind.Lesson,
            scope = viewModelScope,
            source =
                object : GenerationSource {
                    override fun events(id: String): Flow<GenerationEvent> =
                        flow {
                            val session = owner ?: return@flow
                            emitAll(writingApi.events(id, session))
                        }

                    override suspend fun status(id: String): Generation.Status =
                        writingApi.status(id, owner ?: throw ApiException(ApiError.Unauthorized))
                },
            restart = ::writeAgain,
        )

    /** Null while the lesson's state is read. */
    val writing: StateFlow<LessonWriting?> = mutableWriting.asStateFlow()

    val run: StateFlow<GenerationRun> = follower.run

    /** A lesson or a review ready now, to do while waiting or instead. */
    val alternative: StateFlow<ReadyAlternative?> = mutableAlternative.asStateFlow()

    /** Reads whether a run already writes it; reading never starts one. */
    fun open() {
        val session = sessions.current

        if (session == owner && (
                mutableWriting.value != null ||
                    work.coroutineContext.job.children
                        .any()
            )
        ) {
            return
        }

        work.cancel()
        work = openScope()
        follower.stop()
        owner = session
        startedAt = null
        waitRecorded = false
        mutableWriting.value = null
        mutableAlternative.value = null

        if (session == null) return

        launchWork {
            val readiness =
                try {
                    store.api.readiness(session, lessonId)
                } catch (e: ApiException) {
                    null
                }
            mutableAlternative.value = readiness?.alternative
            val generationId = readiness?.generationId

            when {
                readiness?.status == LessonReadiness.Status.READY -> mutableWriting.value = LessonWriting.Ready
                readiness?.status == LessonReadiness.Status.GENERATING && generationId != null -> follow(generationId)
                else -> mutableWriting.value = LessonWriting.NotStarted
            }
        }
    }

    /** Only from the learner's tap: "Start this lesson", or "Try again" after it couldn't start or a slow-down. */
    fun start() {
        val writing = mutableWriting.value
        val canStart =
            writing == LessonWriting.NotStarted ||
                writing == LessonWriting.Failed ||
                ((writing as? LessonWriting.Refused)?.refusal as? LessonRefusal.Limited)?.limit is Limit.SlowDown

        if (!canStart) return

        mutableWriting.value = LessonWriting.Starting
        launchWork {
            when (val outcome = write()) {
                is WriteOutcome.Started -> writingStarted(outcome.generation)
                is WriteOutcome.Refused -> mutableWriting.value = outcome.writing
                WriteOutcome.Failed -> mutableWriting.value = LessonWriting.Failed
                null -> Unit
            }
        }
    }

    /** "Try again" or "Reconnect" on a run that stopped. */
    fun retry() = follower.retry()

    /** Once, when the lesson opens: how long the learner waited. */
    fun recordWait() {
        val began = startedAt ?: return

        if (waitRecorded) return

        waitRecorded = true
        val session = owner
        launchWork {
            cache.mutate { current -> if (current == session) writingApi.recordWait(current, now() - began) }
        }
    }

    private fun writingStarted(generation: LessonGeneration) {
        val generationId = generation.generationId
        when {
            generation.status == LessonGeneration.Status.READY -> mutableWriting.value = LessonWriting.Ready
            generationId != null -> follow(generationId)
            else -> mutableWriting.value = LessonWriting.Failed
        }
    }

    private fun follow(generationId: String) {
        startedAt = startedAt ?: now()
        mutableWriting.value = LessonWriting.Writing
        follower.follow(generationId)
    }

    /** A run that stopped writes again; a refusal leaves the wait for what refused it. */
    private suspend fun writeAgain(): String? =
        when (val outcome = write()) {
            is WriteOutcome.Started -> {
                if (outcome.generation.status == LessonGeneration.Status.READY) {
                    null
                } else {
                    outcome.generation.generationId ?: throw ApiException(ApiError.Unavailable)
                }
            }

            is WriteOutcome.Refused -> {
                mutableWriting.value = outcome.writing
                null
            }

            WriteOutcome.Failed, null -> {
                throw ApiException(ApiError.Unavailable)
            }
        }

    /** Null when the session that opened the lesson isn't current anymore. */
    private suspend fun write(): WriteOutcome? {
        val session = owner
        val result =
            cache.mutate { current ->
                if (current != session) return@mutate null
                try {
                    WriteOutcome.Started(store.api.write(current, lessonId))
                } catch (e: ApiException) {
                    if (e.code == SET_ASIDE) {
                        WriteOutcome.Refused(LessonWriting.SetAside)
                    } else {
                        e.toLessonRefusal()?.let { WriteOutcome.Refused(LessonWriting.Refused(it)) } ?: throw e
                    }
                }
            }

        return when (result) {
            is MutationResult.Done -> result.value
            is MutationResult.Failed -> WriteOutcome.Failed
            MutationResult.Obsolete -> null
        }
    }

    /** The work for one session, cancelled when another opens the lesson. */
    private fun openScope() = CoroutineScope(viewModelScope.coroutineContext + SupervisorJob(viewModelScope.coroutineContext.job))

    private fun launchWork(block: suspend () -> Unit) = work.launch { block() }

    private sealed interface WriteOutcome {
        data class Started(
            val generation: LessonGeneration,
        ) : WriteOutcome

        data class Refused(
            val writing: LessonWriting,
        ) : WriteOutcome

        data object Failed : WriteOutcome
    }

    private companion object {
        const val SET_ASIDE = "LESSON_SET_ASIDE"
    }
}
