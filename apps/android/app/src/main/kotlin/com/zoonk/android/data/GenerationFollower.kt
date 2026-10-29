package com.zoonk.android.data

import com.zoonk.api.models.Generation
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.cancellation.CancellationException
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

enum class GenerationFailure {
    /** The updates stopped, though the run may still be working. */
    Connection,
    Generation,
    NotStarted,
}

/** Server milliseconds of a step's first report of each state. */
data class StepTimes(
    val started: Long? = null,
    val completed: Long? = null,
)

data class GenerationRun(
    val status: Status = Status.Waiting,
    val failure: GenerationFailure? = null,
    val steps: Map<String, StepState> = emptyMap(),
    val stepTimes: Map<String, StepTimes> = emptyMap(),
    /** This device's clock minus the server's, from the freshest event received. */
    val clockOffsetMillis: Long? = null,
) {
    enum class Status { Waiting, Following, Ready, Failed }
}

interface GenerationSource {
    fun events(id: String): Flow<GenerationEvent>

    suspend fun status(id: String): Generation.Status
}

/**
 * Follows one run for a screen, as main's `useWorkflowRun` does: it waits for the run's id, follows
 * its events (moving to a run it joined), reads its status when the stream ends, and never gives up
 * silently. Starting a run again is [retry]'s, from the learner's tap.
 */
class GenerationFollower(
    private val kind: GenerationKind,
    private val scope: CoroutineScope,
    private val source: GenerationSource,
    /** Asks for the run's id while it isn't known: a run saves it a few seconds after it starts. */
    private val readGenerationId: (suspend () -> String?)? = null,
    /** Starts the work again; null when there's nothing left to write. Throws when it couldn't start. */
    private val restart: (suspend () -> String?)? = null,
    private val now: () -> Long = System::currentTimeMillis,
) {
    private val state = MutableStateFlow(GenerationRun())
    val run: StateFlow<GenerationRun> = state.asStateFlow()

    /** Without it, a run that stopped or never started has no Try again: there's nothing to start. */
    val canRestart: Boolean = restart != null

    private var job: Job? = null
    private var followed: String? = null
    private val replaced = mutableSetOf<String>()

    fun follow(generationId: String?) {
        followed = generationId?.takeUnless { it in replaced }
        state.value = GenerationRun()
        start()
    }

    fun retry() {
        when (state.value.failure ?: return) {
            GenerationFailure.Connection -> {
                state.update { it.copy(status = GenerationRun.Status.Waiting, failure = null) }
                start()
            }

            GenerationFailure.Generation, GenerationFailure.NotStarted -> {
                val restart = restart ?: return
                followed?.let(replaced::add)
                followed = null
                state.value = GenerationRun()
                job?.cancel()
                job =
                    scope.launch {
                        val id =
                            try {
                                restart()
                            } catch (e: CancellationException) {
                                throw e
                            } catch (e: Exception) {
                                fail(GenerationFailure.NotStarted)
                                return@launch
                            }
                        if (id == null) {
                            state.update { it.copy(status = GenerationRun.Status.Ready) }
                        } else {
                            followed = id
                            followLoop()
                        }
                    }
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
    }

    private fun start() {
        job?.cancel()
        job = scope.launch { followLoop() }
    }

    private suspend fun followLoop() {
        var id = followed ?: awaitId() ?: return
        while (true) {
            followed = id
            state.update { it.copy(status = GenerationRun.Status.Following) }
            when (val ending = stream(id)) {
                Ending.Ready -> {
                    return state.update { it.copy(status = GenerationRun.Status.Ready) }
                }

                Ending.Stopped -> {
                    return fail(GenerationFailure.Generation)
                }

                Ending.Lost -> {
                    return fail(GenerationFailure.Connection)
                }

                is Ending.Joined -> {
                    id = ending.id
                }

                Ending.Closed -> {
                    when (readStatus(id)) {
                        Generation.Status.COMPLETED -> return state.update { it.copy(status = GenerationRun.Status.Ready) }
                        Generation.Status.FAILED, Generation.Status.CANCELLED -> return fail(GenerationFailure.Generation)
                        null -> return fail(GenerationFailure.Connection)
                        Generation.Status.PENDING, Generation.Status.RUNNING -> delay(REOPEN_DELAY)
                    }
                }
            }
        }
    }

    private suspend fun awaitId(): String? {
        state.update { it.copy(status = GenerationRun.Status.Waiting) }
        val id = withTimeoutOrNull(NOT_STARTED_AFTER) { pollId() }
        if (id == null) fail(GenerationFailure.NotStarted)
        return id
    }

    private suspend fun pollId(): String {
        while (true) {
            val read = readGenerationId?.let { runCatchingApi { it() } }
            if (read != null && read !in replaced) return read
            delay(ID_POLL)
        }
    }

    /** A crash can leave a stream open, so the run's status is checked while it's followed. */
    private suspend fun stream(id: String): Ending =
        coroutineScope {
            val ending = CompletableDeferred<Ending>()
            val events =
                launch {
                    try {
                        source.events(id).collect { event ->
                            apply(event)?.let { ending.complete(it) }
                        }
                        ending.complete(Ending.Closed)
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        ending.complete(Ending.Lost)
                    }
                }
            val check =
                launch {
                    while (true) {
                        delay(STATUS_CHECK)
                        val status = readStatus(id)
                        if (status == Generation.Status.FAILED || status == Generation.Status.CANCELLED) {
                            ending.complete(Ending.Stopped)
                        }
                    }
                }
            ending.await().also {
                events.cancel()
                check.cancel()
            }
        }

    private fun apply(event: GenerationEvent): Ending? {
        val place = kind.steps[event.step]
        if (event.status == "error" || event.step == "workflowError") return Ending.Stopped
        if (place == StepPlace.Join) return event.entityId?.takeUnless { it == followed }?.let(Ending::Joined)
        val step = if (event.status == "completed") StepState.Completed else StepState.Started

        state.update { run ->
            val times = run.stepTimes[event.step] ?: StepTimes()
            val at = event.at
            val newTimes =
                when {
                    at == null -> times
                    step == StepState.Started && times.started == null -> times.copy(started = at)
                    step == StepState.Completed && times.completed == null -> times.copy(completed = at)
                    else -> times
                }
            run.copy(
                steps = run.steps + (event.step to if (run.steps[event.step] == StepState.Completed) StepState.Completed else step),
                stepTimes = run.stepTimes + (event.step to newTimes),
                clockOffsetMillis = at?.let { offset(it, run.clockOffsetMillis) } ?: run.clockOffsetMillis,
            )
        }
        return Ending.Ready.takeIf { kind.isDone(state.value.steps) }
    }

    /** A replayed event arrives long after its time, so the smallest gap is the closest to the clocks' difference. */
    private fun offset(
        at: Long,
        previous: Long?,
    ): Long {
        val gap = now() - at
        return previous?.coerceAtMost(gap) ?: gap
    }

    private suspend fun readStatus(id: String): Generation.Status? = runCatchingApi { source.status(id) }

    private fun fail(failure: GenerationFailure) {
        state.update { it.copy(status = GenerationRun.Status.Failed, failure = failure) }
    }

    private sealed interface Ending {
        data object Ready : Ending

        data object Stopped : Ending

        data object Lost : Ending

        /** The stream ended without the run saying how: its status says. */
        data object Closed : Ending

        data class Joined(
            val id: String,
        ) : Ending
    }

    private companion object {
        val ID_POLL = 2.seconds
        val NOT_STARTED_AFTER = 45.seconds

        /** A stream can close while its run still works, as when a function times out. */
        val REOPEN_DELAY = 1500.milliseconds
        val STATUS_CHECK = 120.seconds
    }
}

private suspend fun <T> runCatchingApi(read: suspend () -> T): T? =
    try {
        read()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        null
    }
