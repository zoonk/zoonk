package com.zoonk.android.feature.player

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.LessonReadinessFollower
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionSource
import com.zoonk.android.data.perform
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.GenerationWaitInput
import com.zoonk.api.models.LessonGeneration
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.ReadyAlternative
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.job
import kotlinx.coroutines.launch

/**
 * A lesson not written yet, for the learner who opened it: writing it runs AI, so it starts only
 * from their tap, then its run is followed until the lesson is ready. Another session reads it again.
 */
class LessonWritingViewModel(
    private val lessonId: String,
    private val store: LessonPlayerStore,
    private val generations: (AuthenticatedSession?) -> GenerationSource,
    private val cache: AppCache,
    private val sessions: SessionSource,
) : ViewModel() {
    private val mutableWriting = MutableStateFlow<LessonWriting?>(null)
    private val mutableAlternative = MutableStateFlow<ReadyAlternative?>(null)
    private val mutableWarmUpId = MutableStateFlow<String?>(null)
    private val mutableKind = MutableStateFlow(GenerationKind.Lesson)
    private var owner: AuthenticatedSession? = null
    private var work = openScope()

    private val follower =
        GenerationFollower(
            kind = GenerationKind.Lesson,
            scope = viewModelScope,
            source =
                object : GenerationSource {
                    override fun events(id: String) = generations(owner).events(id)

                    override suspend fun status(id: String) = generations(owner).status(id)
                },
            restart = ::writeAgain,
        )

    private val readiness = LessonReadinessFollower(follower)

    /** Counts the learner's taps and sessions, so a read that started before one doesn't undo it. */
    private var asks = 0

    /** Null while the lesson's state is read. */
    val writing: StateFlow<LessonWriting?> = mutableWriting.asStateFlow()

    val run: StateFlow<GenerationRun> = follower.run

    /** A lesson or a review ready now, to do while waiting or instead. */
    val alternative: StateFlow<ReadyAlternative?> = mutableAlternative.asStateFlow()

    /** The goal's deck of guesses, only while its first lesson is written. */
    val warmUpId: StateFlow<String?> = mutableWarmUpId.asStateFlow()

    /** Which steps the run reports, as the lesson's readiness says. */
    val kind: StateFlow<GenerationKind> = mutableKind.asStateFlow()

    /** Starts over for the signed-in session; [followReadiness] reads whether a run already writes it. */
    fun open() {
        val session = sessions.current
        if (session == owner) return

        work.cancel()
        work = openScope()
        follower.stop()
        owner = session
        asks++
        mutableWriting.value = null
        mutableAlternative.value = null
        mutableWarmUpId.value = null
    }

    /**
     * While the screen shows: reads the lesson's readiness, and keeps reading it while the lesson is
     * written or failed, so the lesson, a stopped run and another device's retry show as the server
     * says. Reading never starts a run.
     */
    suspend fun followReadiness() {
        if (owner == null) return
        var asked = asks

        readiness.follow(
            read = {
                mutableWriting.first { it == null || it == LessonWriting.Writing || it == LessonWriting.Failed }
                asked = asks
                cache.mutate { store.api.readiness(it, lessonId) }.also {
                    // A first read that fails offers the start, which asks again.
                    if (it is MutationResult.Failed && mutableWriting.value == null) mutableWriting.value = LessonWriting.NotStarted
                }
            },
        ) { answer ->
            // A tap's answer that came in during the read is newer than it.
            if (asked == asks) show(answer)
            asked != asks || (answer.status != LessonReadiness.Status.READY && !answer.setAside)
        }
    }

    private fun show(readiness: LessonReadiness) {
        mutableAlternative.value = readiness.alternative
        mutableWarmUpId.value = readiness.warmUpId?.toString()
        mutableKind.value = if (readiness.kind == LessonReadiness.Kind.CHALLENGE) GenerationKind.Challenge else GenerationKind.Lesson
        mutableWriting.value =
            when {
                readiness.status == LessonReadiness.Status.READY -> LessonWriting.Ready
                readiness.status == LessonReadiness.Status.GENERATING && readiness.generationId != null -> LessonWriting.Writing
                readiness.setAside -> LessonWriting.SetAside
                readiness.status == LessonReadiness.Status.FAILED -> LessonWriting.Failed
                else -> LessonWriting.NotStarted
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
        asks++
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

    private fun writingStarted(generation: LessonGeneration) {
        val generationId = generation.generationId
        when {
            generation.status == LessonGeneration.Status.READY -> mutableWriting.value = LessonWriting.Ready
            generationId != null -> follow(generationId)
            else -> mutableWriting.value = LessonWriting.Failed
        }
    }

    private fun follow(generationId: String) {
        mutableWriting.value = LessonWriting.Writing
        readiness.followRun(generationId)
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
                    WriteOutcome.Refused(e.toNotWritten() ?: throw e)
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
}
