package com.zoonk.android.feature.player

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionSource
import com.zoonk.android.data.generationEvents
import com.zoonk.android.data.perform
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.api.models.GenerationWaitInput
import com.zoonk.api.models.LessonGeneration
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.ReadyAlternative
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.seconds

enum class PhaseState { Pending, Active, Done }

/** A lesson being written, phase by phase (main's lesson `GenerationWait`: plan, then write). */
@Immutable
data class WritingPhases(
    val plan: PhaseState = PhaseState.Active,
    val write: PhaseState = PhaseState.Pending,
)

@Immutable
sealed interface LessonWriting {
    /** Nothing writes it yet: it waits for "Start this lesson". */
    data object NotStarted : LessonWriting

    data object Starting : LessonWriting

    data class Writing(
        val phases: WritingPhases,
    ) : LessonWriting

    data object Failed : LessonWriting

    /** Every draft was held back by its checks; plans go on without it. */
    data object SetAside : LessonWriting

    data class Refused(
        val refusal: LessonRefusal,
    ) : LessonWriting
}

/** The writing's events, its status read once they end, and the wait reported when it opens. */
interface LessonWritingApi {
    fun events(
        generationId: String,
        session: AuthenticatedSession,
    ): Flow<WritingEvent>

    suspend fun recordWait(
        session: AuthenticatedSession,
        milliseconds: Long,
    )
}

data class WritingEvent(
    val step: String,
    val status: String,
)

class LiveLessonWritingApi(
    private val api: ApiClients,
) : LessonWritingApi {
    override fun events(
        generationId: String,
        session: AuthenticatedSession,
    ): Flow<WritingEvent> = api.generationEvents(generationId, session).map { WritingEvent(it.step, it.status) }

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
 * A lesson not written yet: writing it runs AI, so it starts only from the learner's tap, then
 * follows the run until the lesson is ready and [onReady] reads it again.
 */
class LessonWritingViewModel(
    private val lessonId: String,
    private val store: LessonPlayerStore,
    private val writingApi: LessonWritingApi,
    private val cache: AppCache,
    private val sessions: SessionSource,
    private val onReady: suspend () -> Unit,
    private val now: () -> Long = System::currentTimeMillis,
) : ViewModel() {
    private val mutableWriting = MutableStateFlow<LessonWriting?>(null)
    private val mutableAlternative = MutableStateFlow<ReadyAlternative?>(null)
    private var following: Job? = null
    private var startedAt: Long? = null

    /** Null while the lesson's state is read. */
    val writing: StateFlow<LessonWriting?> = mutableWriting.asStateFlow()

    /** A lesson or a review ready now, to do while waiting or instead. */
    val alternative: StateFlow<ReadyAlternative?> = mutableAlternative.asStateFlow()

    /** Reads whether a run already writes it; reading never starts one. */
    fun open() {
        if (mutableWriting.value != null || following?.isActive == true) return
        following = viewModelScope.launch { follow(generationId = null) }
    }

    /** Only from the learner's tap. */
    fun start() {
        if (mutableWriting.value != LessonWriting.NotStarted && mutableWriting.value != LessonWriting.Failed) return
        mutableWriting.value = LessonWriting.Starting
        following?.cancel()
        following =
            viewModelScope.launch {
                val result =
                    cache.mutate { session ->
                        try {
                            WriteOutcome.Started(store.api.write(session, lessonId))
                        } catch (e: ApiException) {
                            if (e.code == SET_ASIDE) {
                                WriteOutcome.Refused(LessonWriting.SetAside)
                            } else {
                                e.toLessonRefusal()?.let { WriteOutcome.Refused(LessonWriting.Refused(it)) } ?: throw e
                            }
                        }
                    }
                when (val outcome = (result as? MutationResult.Done)?.value) {
                    is WriteOutcome.Started -> writingStarted(outcome.generation)
                    is WriteOutcome.Refused -> mutableWriting.value = outcome.writing
                    null -> if (result is MutationResult.Failed) mutableWriting.value = LessonWriting.Failed
                }
            }
    }

    private suspend fun writingStarted(generation: LessonGeneration) {
        if (generation.status == LessonGeneration.Status.READY) {
            ready()
            return
        }
        follow(generation.generationId)
    }

    /**
     * Follows the run's events while there's a run to follow, and reads its readiness when they end
     * or when there's none, every few seconds until it's ready or stops.
     */
    private suspend fun follow(generationId: String?) {
        var runId = generationId

        while (true) {
            val session = sessions.current ?: return
            runId?.let { id ->
                mutableWriting.value = LessonWriting.Writing(WritingPhases())
                startedAt = startedAt ?: now()
                try {
                    writingApi.events(id, session).collect(::onEvent)
                } catch (e: ApiException) {
                    // The readiness read below says whether the run went on.
                }
            }

            val readiness =
                try {
                    store.api.readiness(session, lessonId)
                } catch (e: ApiException) {
                    null
                }
            mutableAlternative.value = readiness?.alternative ?: mutableAlternative.value

            when (readiness?.status) {
                LessonReadiness.Status.READY -> {
                    ready()
                    return
                }

                LessonReadiness.Status.FAILED -> {
                    mutableWriting.value = LessonWriting.Failed
                    return
                }

                LessonReadiness.Status.NOT_STARTED -> {
                    if (mutableWriting.value !is LessonWriting.Writing) {
                        mutableWriting.value = LessonWriting.NotStarted
                        return
                    }
                }

                LessonReadiness.Status.GENERATING -> {
                    if (mutableWriting.value !is LessonWriting.Writing) mutableWriting.value = LessonWriting.Writing(WritingPhases())
                    startedAt = startedAt ?: now()
                    runId = readiness.generationId
                }

                null -> {
                    if (mutableWriting.value == null) mutableWriting.value = LessonWriting.Failed
                }
            }
            delay(POLL)
        }
    }

    private fun onEvent(event: WritingEvent) {
        mutableWriting.update { writing ->
            val phases = (writing as? LessonWriting.Writing)?.phases ?: WritingPhases()
            val next =
                when (event.step) {
                    "planLesson" -> {
                        if (event.status == "completed") phases.copy(plan = PhaseState.Done, write = PhaseState.Active) else phases
                    }

                    "writeLesson" -> {
                        phases.copy(
                            plan = PhaseState.Done,
                            write = if (event.status == "completed") PhaseState.Done else PhaseState.Active,
                        )
                    }

                    "lessonReady" -> {
                        WritingPhases(plan = PhaseState.Done, write = PhaseState.Done)
                    }

                    else -> {
                        phases
                    }
                }
            LessonWriting.Writing(next)
        }
    }

    private suspend fun ready() {
        val session = sessions.current
        val began = startedAt
        if (session != null && began != null) {
            try {
                writingApi.recordWait(session, now() - began)
            } catch (e: ApiException) {
                // Only a measurement: the lesson opens either way.
            }
        }
        onReady()
    }

    private sealed interface WriteOutcome {
        data class Started(
            val generation: LessonGeneration,
        ) : WriteOutcome

        data class Refused(
            val writing: LessonWriting,
        ) : WriteOutcome
    }

    private companion object {
        val POLL = 3.seconds
        const val SET_ASIDE = "LESSON_SET_ASIDE"
    }
}
