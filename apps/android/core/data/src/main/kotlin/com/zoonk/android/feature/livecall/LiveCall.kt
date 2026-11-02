package com.zoonk.android.feature.livecall

import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.ExamSpeakingTaskCuesInner
import com.zoonk.api.models.LanguageConversationSetup.EndsAtLimit
import com.zoonk.api.models.LanguageConversationTurn
import com.zoonk.api.models.LanguageConversationTurn.Speaker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException
import kotlin.math.roundToLong
import kotlin.time.ComparableTimeMark
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeSource

/** What the call follows: [examCues] is non-null for an exam task, whose one goal is the task itself, graded when the call ends. */
data class LiveCallScript(
    val openingLine: String,
    val objectives: List<String>,
    val met: List<String>,
    val minutes: Long,
    val examCues: List<ExamSpeakingTaskCuesInner>? = null,
)

enum class LiveCallPhase { Idle, Connecting, Live, Ended, Failed }

enum class LiveCallFailure { CallInProgress, CallsPaused, Connect, Dropped, Ended, Limit, PlusRequired }

data class LiveCallState(
    val phase: LiveCallPhase = LiveCallPhase.Idle,
    val failure: LiveCallFailure? = null,
    val limit: Limit.Reached? = null,
    val turns: List<TranscriptTurn> = emptyList(),
    val metLabels: List<String> = emptyList(),
    val muted: Boolean = false,
    val micBlocked: Boolean = false,
    val reconnecting: Boolean = false,
    val characterTalking: Boolean = false,
    val elapsedSeconds: Long = 0,
    val limitSeconds: Long = 0,
    /** The plan's call time running out while the character wraps up: today's or this month's. */
    val limitNear: EndsAtLimit? = null,
) {
    val isOpen get() = phase == LiveCallPhase.Connecting || phase == LiveCallPhase.Live
}

/** What a finished call saves, whether or not its hangup was confirmed: completing hangs it up too. */
data class LiveCallSummary(
    val connectionId: UUID,
    val spokenSeconds: Long,
    val turns: List<LanguageConversationTurn>,
)

/**
 * Mirrors main's `useLiveCall`. The microphone is asked for before [start], so the permission
 * prompt never takes time from the call. Ending it silences it at once; the server then hangs it up
 * and confirms before the peer goes and before anything is saved. [scope] is the app's, so a call
 * left mid-request still hangs up; [leave] stops everything else it runs.
 */
class LiveCall(
    private val script: LiveCallScript,
    private val client: LiveCallClient,
    private val transports: LiveCallTransports,
    private val scope: CoroutineScope,
    private val timeSource: TimeSource.WithComparableMarks = TimeSource.Monotonic,
) {
    private val mutableState = MutableStateFlow(LiveCallState(metLabels = script.met, limitSeconds = script.minutes * 60))
    val state: StateFlow<LiveCallState> = mutableState.asStateFlow()

    private val phase get() = mutableState.value.phase
    private var transport: LiveCallTransport? = null
    private var connectionId: UUID? = null
    private var attempt = 0
    private var closeConfirmed = false
    private var endedAtDeadline = false
    private var ending: Deferred<Boolean>? = null
    private var endsAt: ComparableTimeMark? = null
    private var endsAtLimit: EndsAtLimit? = null
    private var liveSince: ComparableTimeMark? = null
    private val waitingReplies = mutableListOf<String>()
    private val timers = mutableListOf<Job>()
    private var openingRetry: Job? = null
    private var settle: Job? = null
    private var talking: Job? = null
    private var lastLearnerAt = timeSource.markNow()
    private var nudged = false
    private var wrappedUp = false
    private var cuesSent = 0
    private var learnerSpoke = false
    private var checking = false
    private var checkAgain = false

    /** Without [microphone] the call runs on typed replies. Starting again cancels a start still on its way. */
    fun start(
        microphone: Boolean,
        takeover: Boolean = false,
    ) {
        attempt += 1
        val mine = attempt
        mutableState.update { it.copy(phase = LiveCallPhase.Connecting, failure = null, limit = null, micBlocked = !microphone) }
        scope.launch { connect(mine, microphone, takeover) }
    }

    /** A dropped call ends this way too, so what was said still gets its feedback. */
    fun hangUp() {
        val current = mutableState.value
        val dropped = current.phase == LiveCallPhase.Failed && current.failure == LiveCallFailure.Dropped
        if (!current.isOpen && !dropped) return
        // A start still on its way never connects now: a reservation that comes back is ended at once.
        if (current.phase == LiveCallPhase.Connecting) attempt += 1
        silence()
        mutableState.update { it.copy(phase = LiveCallPhase.Ended) }
    }

    /** A call still going shows as dropped, and the server hangs it up. */
    fun leave() {
        attempt += 1
        when (phase) {
            LiveCallPhase.Connecting -> fail(LiveCallFailure.Connect)
            LiveCallPhase.Live -> fail(LiveCallFailure.Dropped)
            else -> scope.launch { release() }
        }
    }

    /** While the call connects, a typed reply waits. */
    fun sendText(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || !mutableState.value.isOpen) return
        mutableState.update { it.copy(turns = it.turns.addingTypedReply(trimmed)) }
        learnerTurn()
        if (phase == LiveCallPhase.Live) {
            transport?.send(LiveClientCommand.Instructions(LiveCallCue.typedReply(trimmed)))
        } else {
            waitingReplies += trimmed
        }
    }

    fun toggleMute() {
        val current = mutableState.value
        if (current.phase != LiveCallPhase.Live || current.micBlocked) return
        mutableState.update { it.copy(muted = !it.muted) }
        transport?.send(LiveClientCommand.Mute(!current.muted))
    }

    /** Null only for a call that never got a connection. */
    suspend fun finish(): LiveCallSummary? {
        val id = connectionId ?: return null
        release()
        val turns = mutableState.value.turns
        return LiveCallSummary(id, turns.spokenSeconds, turns.conversationTurns)
    }

    /**
     * True once the server confirmed the hangup. The connection's ID stays, so asking again after a
     * failure sends a new request, and nothing is saved until the server confirms.
     */
    suspend fun release(): Boolean {
        silence()
        transport?.close()
        transport = null
        val id = connectionId
        if (id == null || closeConfirmed) return true
        ending?.let { return it.await() }
        val task =
            scope.async(start = CoroutineStart.LAZY) {
                val atDeadline = client.end(id)
                if (atDeadline != null) {
                    closeConfirmed = true
                    endedAtDeadline = atDeadline
                }
                atDeadline != null
            }
        ending = task
        task.invokeOnCompletion { if (ending === task) ending = null }
        return task.await()
    }

    private suspend fun connect(
        mine: Int,
        microphone: Boolean,
        takeover: Boolean,
    ) {
        val reservation = reserve(takeover) { attempt == mine }
        if (reservation == null || attempt != mine) return
        val setup =
            (reservation as? CallReservation.Ready)?.setup ?: run {
                fail(failure(reservation), (reservation as? CallReservation.Limited)?.limit)
                return
            }
        // The time the server said was left, from now: the device's clock can be off.
        endsAt = timeSource.markNow() + setup.seconds.seconds
        endsAtLimit = setup.endsAtLimit

        val created = transports.create(microphone, onEvent = { handle(it, mine) }, onLost = { lost(mine) })
        transport = created
        timers +=
            scope.launch {
                delay(CONNECT_TIMEOUT)
                if (attempt == mine && phase == LiveCallPhase.Connecting) fail(LiveCallFailure.Connect)
            }

        try {
            val offer = created.makeOffer()
            if (attempt != mine) return
            val answer = client.redeem(setup.connectionId, offer)
            if (attempt != mine) return
            created.accept(answer)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (attempt == mine && phase == LiveCallPhase.Connecting) fail(LiveCallFailure.Connect)
        }
    }

    private suspend fun reserve(
        takeover: Boolean,
        isCurrent: () -> Boolean,
    ): CallReservation? {
        val first = client.connect(takeover)
        // This call's last connection is still closing: ask once more.
        val answer =
            if (first == CallReservation.PreviousConnectionClosing && isCurrent()) {
                mutableState.update { it.copy(reconnecting = true) }
                client.connect(takeover)
            } else {
                first
            }
        val ready = answer as? CallReservation.Ready ?: return answer

        // A start cancelled meanwhile never connects: its reservation is ended at once.
        if (!isCurrent()) {
            scope.launch { client.end(ready.setup.connectionId) }
            return null
        }
        connectionId = ready.setup.connectionId
        closeConfirmed = false
        endedAtDeadline = false
        return answer
    }

    private fun failure(reservation: CallReservation) =
        when (reservation) {
            CallReservation.CallInProgress -> LiveCallFailure.CallInProgress
            CallReservation.CallsPaused -> LiveCallFailure.CallsPaused
            CallReservation.Ended -> LiveCallFailure.Ended
            is CallReservation.Limited -> LiveCallFailure.Limit
            CallReservation.PlusRequired -> LiveCallFailure.PlusRequired
            is CallReservation.Ready, CallReservation.Failed, CallReservation.PreviousConnectionClosing -> LiveCallFailure.Connect
        }

    private fun handle(
        event: LiveServerEvent,
        run: Int,
    ) {
        if (run != attempt) return

        // Before the call is live, only its start, or the server closing it early, means anything.
        if (phase == LiveCallPhase.Connecting) {
            when (event) {
                LiveServerEvent.Started -> goLive()
                LiveServerEvent.Closed -> fail(LiveCallFailure.Connect)
                else -> Unit
            }
            return
        }
        if (phase != LiveCallPhase.Live) return

        when (event) {
            LiveServerEvent.Started -> {}

            LiveServerEvent.Closed -> {
                hangUp()
            }

            is LiveServerEvent.Transcript -> {
                mutableState.update { it.copy(turns = it.turns.adding(event)) }
                if (event.speaker == Speaker.LEARNER) {
                    learnerTurn()
                } else {
                    openingRetry?.cancel()
                    characterTurn()
                }
            }

            is LiveServerEvent.Delegation -> {
                transport?.send(LiveClientCommand.Thinking(LiveCallCue.NO_BACKEND, event.id))
            }
        }
    }

    private fun goLive() {
        val now = timeSource.markNow()
        liveSince = now
        lastLearnerAt = now
        val limitSeconds = endsAt?.let { ((it - now).inWholeMilliseconds / 1000.0).roundToLong().coerceAtLeast(0) }
        mutableState.update {
            it.copy(phase = LiveCallPhase.Live, reconnecting = false, limitSeconds = limitSeconds ?: it.limitSeconds)
        }

        val opening = LiveClientCommand.Instructions(LiveCallCue.opening(script.openingLine))
        transport?.send(opening)
        openingRetry =
            scope.launch {
                delay(OPENING_RETRY)
                if (phase == LiveCallPhase.Live) transport?.send(opening)
            }

        waitingReplies.forEach { transport?.send(LiveClientCommand.Instructions(LiveCallCue.typedReply(it))) }
        waitingReplies.clear()
        startClock()
    }

    private fun startClock() {
        val cues = script.examCues.orEmpty()
        val start = liveSince ?: return
        val deadline = endsAt ?: return
        timers +=
            scope.launch {
                while (phase == LiveCallPhase.Live) {
                    delay(TICK)
                    if (phase != LiveCallPhase.Live) return@launch
                    val now = timeSource.markNow()
                    val elapsed = now - start
                    val quiet = now - lastLearnerAt
                    mutableState.update { it.copy(elapsedSeconds = elapsed.inWholeSeconds) }

                    if (cuesSent < cues.size && !wrappedUp && elapsed >= cues[cuesSent].atSeconds.seconds) {
                        transport?.send(LiveClientCommand.Instructions(cues[cuesSent].say))
                        cuesSent += 1
                    }
                    if (!wrappedUp && now >= deadline - WRAP_UP) {
                        wrappedUp = true
                        mutableState.update { it.copy(limitNear = endsAtLimit) }
                        transport?.send(LiveClientCommand.Instructions(LiveCallCue.WRAP_UP))
                    }
                    if (!nudged && !wrappedUp && quiet >= SILENCE_NUDGE) {
                        nudged = true
                        transport?.send(LiveClientCommand.Instructions(LiveCallCue.SILENCE))
                    }
                    if (now >= deadline || quiet >= SILENCE_END) hangUp()
                }
            }
    }

    /** Every word the learner says or types keeps the call from ending on its silence timeout. */
    private fun learnerTurn() {
        lastLearnerAt = timeSource.markNow()
        nudged = false
        learnerSpoke = true
        settle?.cancel()
    }

    private fun characterTurn() {
        mutableState.update { it.copy(characterTalking = true) }
        talking?.cancel()
        talking =
            scope.launch {
                delay(TALKING)
                mutableState.update { it.copy(characterTalking = false) }
            }

        if (!learnerSpoke || script.examCues != null) return
        settle?.cancel()
        settle =
            scope.launch {
                delay(REPLY_SETTLED)
                learnerSpoke = false
                // Its own job: a learner speaking meanwhile delays the next check, never cancels this one.
                scope.launch { checkObjectives() }
            }
    }

    /** One check at a time; a turn that ends meanwhile is checked right after it. */
    private suspend fun checkObjectives() {
        if (checking) {
            checkAgain = true
            return
        }
        checking = true
        try {
            do {
                checkAgain = false
                val found = client.checkObjectives(mutableState.value.turns.conversationTurns)
                if (found != null && found.size > mutableState.value.metLabels.size) {
                    mutableState.update { it.copy(metLabels = found) }
                    val open = script.objectives.filterNot(found::contains)
                    transport?.send(LiveClientCommand.Thinking(LiveCallCue.objectivesProgress(found, open)))
                }
            } while (checkAgain)
        } finally {
            checking = false
        }
    }

    /**
     * The connection went away without GPT-Live saying the session closed: our server hanging it up
     * at its deadline closes the channel that way, and that call ended normally; anything else lost it.
     */
    private fun lost(run: Int) {
        if (run != attempt || !mutableState.value.isOpen) return
        val wasLive = phase == LiveCallPhase.Live
        scope.launch {
            val closed = release()
            if (run != attempt || !mutableState.value.isOpen) return@launch
            if (closed && endedAtDeadline) hangUp() else fail(if (wasLive) LiveCallFailure.Dropped else LiveCallFailure.Connect)
        }
    }

    private fun fail(
        failure: LiveCallFailure,
        limit: Limit.Reached? = null,
    ) {
        mutableState.update { it.copy(phase = LiveCallPhase.Failed, failure = failure, limit = limit, reconnecting = false) }
        scope.launch { release() }
    }

    private fun silence() {
        timers.forEach(Job::cancel)
        timers.clear()
        openingRetry?.cancel()
        settle?.cancel()
        talking?.cancel()
        mutableState.update { it.copy(characterTalking = false) }
        transport?.silence()
    }

    companion object {
        /** A session that hasn't started after this isn't going to. */
        val CONNECT_TIMEOUT = 15.seconds

        /** The character starts wrapping up this long before the call's time is over. */
        val WRAP_UP = 20.seconds

        /** The learner quiet this long: the character asks if they're there. */
        val SILENCE_NUDGE = 20.seconds

        /** Still quiet this long after their last word, the call ends: it's paid by the second. */
        val SILENCE_END = 45.seconds

        /** GPT-Live usually opens within a second; still silent after this, it's told again once. */
        val OPENING_RETRY = 5.seconds

        /** The character's answer has settled once its transcript stays quiet this long. */
        val REPLY_SETTLED = 1500.milliseconds

        private val TALKING = 1200.milliseconds
        private val TICK = 500.milliseconds
    }
}
