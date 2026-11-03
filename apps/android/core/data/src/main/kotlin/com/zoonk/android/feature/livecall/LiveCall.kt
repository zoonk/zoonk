package com.zoonk.android.feature.livecall

import com.zoonk.android.data.EventTracker
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.ExamSpeakingTaskCuesInner
import com.zoonk.api.models.LanguageConversationSetup
import com.zoonk.api.models.LanguageConversationTurn
import com.zoonk.api.models.LanguageConversationTurn.Speaker
import com.zoonk.api.models.LiveCallCue
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

/**
 * What the call is about: [examCues] is non-null for an exam task, whose one goal is the task itself,
 * graded when the call ends. [kind] is the conversation's kind as analytics names it, and
 * [talkSeconds] the whole call's talk time, its minutes.
 */
data class LiveCallTask(
    val kind: String,
    val objectives: List<String>,
    val met: List<String>,
    val talkSeconds: Long,
    val examCues: List<ExamSpeakingTaskCuesInner>? = null,
)

/**
 * What the call's earlier connections left, which calling again continues: its [turns] are shown
 * at once and never take a later connection's words, and [spokenMs] adds each connection's speech
 * once, rounded only for the saved call. [connectionId] is what completion must name, the latest
 * connection the screen saw once one went live: until then there's no call to save.
 */
data class CallSoFar(
    val connectionId: UUID? = null,
    val turns: List<TranscriptTurn> = emptyList(),
    val spokenMs: Double = 0.0,
    val usedHelp: Boolean = false,
    val metLabels: List<String> = emptyList(),
    val examCuesSent: Int = 0,
)

enum class LiveCallPhase { Idle, Connecting, Live, Ended, Failed }

enum class LiveCallFailure { CallInProgress, CallsPaused, Connect, Dropped, Ended, Limit, PlusRequired }

data class LiveCallState(
    val phase: LiveCallPhase = LiveCallPhase.Idle,
    val failure: LiveCallFailure? = null,
    val limit: Limit.Reached? = null,
    val turns: List<TranscriptTurn> = emptyList(),
    val metLabels: List<String> = emptyList(),
    val usedHelp: Boolean = false,
    val muted: Boolean = false,
    val micBlocked: Boolean = false,
    val reconnecting: Boolean = false,
    val characterTalking: Boolean = false,
    val learnerSpeaking: Boolean = false,
    /** Whether the learner has said anything out loud yet. */
    val learnerSpoke: Boolean = false,
    /** The character has said its first words: the learner was told it answers first, so until then the call is still ringing. */
    val answered: Boolean = false,
    /** How far into its talk time the call is, its earlier connections included. */
    val elapsedSeconds: Long = 0,
    val ending: EndingReason? = null,
    val sayingGoodbye: Boolean = false,
    /** Nobody has made a sound for long enough to tell the learner there's no rush. */
    val quietHint: Boolean = false,
) {
    val isOpen get() = phase == LiveCallPhase.Connecting || phase == LiveCallPhase.Live
}

/** What a finished call saves, whether or not its hangup was confirmed: completing hangs it up too. */
data class LiveCallSummary(
    val connectionId: UUID,
    val spokenSeconds: Long,
    val turns: List<LanguageConversationTurn>,
    val usedHelp: Boolean,
)

/**
 * Mirrors main's `useLiveCall`. The microphone is asked for before [start], so the permission
 * prompt never takes time from the call. Ending it silences it at once; the server then hangs it up
 * and confirms before the peer goes and before anything is saved. [scope] is the app's, so a call
 * left mid-request still hangs up; [leave] stops everything else it runs. It continues [soFar] when
 * the server says this connection continues the call, and starts over otherwise. Whatever stops a
 * dropped call's reconnect before it goes live leaves the call dropped, to end and save.
 */
class LiveCall(
    private val task: LiveCallTask,
    private val client: LiveCallClient,
    private val transports: LiveCallTransports,
    private val scope: CoroutineScope,
    private val analytics: EventTracker = EventTracker {},
    private val timeSource: TimeSource.WithComparableMarks = TimeSource.Monotonic,
    soFar: CallSoFar = CallSoFar(),
) {
    private var earlier = soFar
    private var helped = false
    private val mutableState =
        MutableStateFlow(LiveCallState(turns = soFar.turns, metLabels = (task.met + soFar.metLabels).distinct(), usedHelp = soFar.usedHelp))
    val state: StateFlow<LiveCallState> = mutableState.asStateFlow()

    private val phase get() = mutableState.value.phase
    private var transport: LiveCallTransport? = null
    private var connectionId: UUID? = null
    private var attempt = 0
    private var closeConfirmed = false
    private var endedAtDeadline = false
    private var closing: Deferred<Boolean>? = null

    /** The setup's answer arriving: its times count from then, since the device's clock can be off. */
    private var answeredAt: ComparableTimeMark? = null
    private var setup: LanguageConversationSetup? = null
    private var ending: LiveCallEnding? = null
    private var gaps = ReplyGaps()
    private var reported = false
    private val openingEvents = mutableSetOf<String>()
    private val goodbyeEvents = mutableSetOf<String>()
    private val waitingReplies = mutableListOf<String>()
    private val timers = mutableListOf<Job>()
    private var settle: Job? = null
    private var examCuesSent = soFar.examCuesSent

    private var liveAt: Long? = null
    private var talkSecondsLeft = 0L
    private var wentLive = false
    private var reserving: Job? = null

    /** A new call's clock starts when it goes live; a continued one's counts the talk time the server says it already used. */
    private var clockZeroAt: Long? = null
    private var checkTiming = CheckTiming()
    private var checking = false

    /** Without [microphone] the call runs on typed replies. Starting again cancels a start still on its way. */
    fun start(
        microphone: Boolean,
        takeover: Boolean = false,
    ) {
        attempt += 1
        val mine = attempt
        mutableState.update { it.copy(phase = LiveCallPhase.Connecting, failure = null, limit = null, micBlocked = !microphone) }
        val reservation = scope.async { reserve(takeover) { attempt == mine } }
        reserving = reservation
        scope.launch { connect(mine, microphone, reservation.await()) }
    }

    /** Waits for a reservation still on its way, so [soFar] names the call's latest connection. */
    suspend fun settle() {
        reserving?.join()
    }

    /** It continues a dropped call, which it leaves dropped if it doesn't go live. */
    val continuing get() = earlier.connectionId != null

    private val savedConnection get() = if (wentLive || continuing) connectionId ?: earlier.connectionId else null

    val hasCallToSave get() = savedConnection != null

    /** The learner ending the call; a dropped call ends this way too, so what was said still gets its feedback. */
    fun hangUp() = end(CallEnd.LearnerEnded)

    /** A call still going shows as dropped, and the server hangs it up; one still calling was the learner's to cancel. */
    fun leave() {
        attempt += 1
        when (phase) {
            LiveCallPhase.Connecting -> {
                report(CallEnd.LearnerEnded)
                fail(LiveCallFailure.Connect)
            }

            LiveCallPhase.Live -> {
                fail(LiveCallFailure.Dropped)
            }

            else -> {
                scope.launch { release() }
            }
        }
    }

    /** While the call connects, a typed reply waits. */
    fun sendText(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || !mutableState.value.isOpen) return
        mutableState.update { it.copy(turns = it.turns.addingTypedReply(trimmed)) }
        heardForCheck(Speaker.LEARNER, startMs = null)
        val cue = setup?.script?.cues?.typedReply
        if (phase == LiveCallPhase.Live && cue != null) {
            send(typedReply(cue, trimmed))
            now()?.let { ending?.learnerSent(it) }
            advance()
        } else {
            waitingReplies += trimmed
        }
    }

    /** A reply being typed holds the goodbye until it's sent. */
    fun typed() {
        val now = now() ?: return
        ending?.learnerTyped(now)
        advance()
    }

    fun help() {
        helped = true
        mutableState.update { it.copy(usedHelp = true) }
    }

    /** What a call started again on this screen continues; earlier turns lose their timeline, so new words never join them. */
    val soFar: CallSoFar
        get() {
            val current = mutableState.value
            return CallSoFar(
                connectionId = savedConnection,
                turns = current.turns.map { TranscriptTurn(it.speaker, it.text) },
                spokenMs = earlier.spokenMs + current.turns.spokenMs,
                usedHelp = current.usedHelp,
                metLabels = current.metLabels,
                examCuesSent = examCuesSent,
            )
        }

    fun toggleMute() {
        val current = mutableState.value
        if (current.phase != LiveCallPhase.Live || current.micBlocked) return
        mutableState.update { it.copy(muted = !it.muted, learnerSpeaking = false) }
        transport?.send(LiveClientCommand.Mute(!current.muted))
    }

    /** Null when there's no call to save: none of its connections went live. */
    suspend fun finish(): LiveCallSummary? {
        settle()
        release()
        val call = soFar
        val id = call.connectionId ?: return null
        return LiveCallSummary(id, (call.spokenMs / 1000).roundToLong(), call.turns.conversationTurns, call.usedHelp)
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
        closing?.let { return it.await() }
        val task =
            scope.async(start = CoroutineStart.LAZY) {
                val atDeadline = client.end(id)
                if (atDeadline != null) {
                    closeConfirmed = true
                    endedAtDeadline = atDeadline
                }
                atDeadline != null
            }
        closing = task
        task.invokeOnCompletion { if (closing === task) closing = null }
        return task.await()
    }

    private suspend fun connect(
        mine: Int,
        microphone: Boolean,
        reservation: CallReservation?,
    ) {
        if (reservation == null || attempt != mine) return
        val ready =
            reservation as? CallReservation.Ready ?: run {
                fail(failure(reservation), (reservation as? CallReservation.Limited)?.limit)
                return
            }
        setup = ready.setup
        answeredAt = timeSource.markNow()
        if (ready.setup.continuesCall) {
            clockZeroAt = -(task.talkSeconds - ready.setup.talkSeconds) * 1000
        } else {
            startOver()
        }

        val signals = LiveCallSignals(onEvent = { handle(it, mine) }, onLost = { lost(mine) }, onVoice = { heard(mine) })
        val created = transports.create(microphone, signals)
        transport = created
        timers +=
            scope.launch {
                delay(CONNECT_TIMEOUT)
                if (attempt == mine && phase == LiveCallPhase.Connecting) fail(LiveCallFailure.Connect)
            }

        try {
            val offer = created.makeOffer()
            if (attempt != mine) return
            val answer = client.redeem(ready.setup.connectionId, offer, earlier.turns.conversationTurns)
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
        // Kept even for a start cancelled meanwhile: completion must name the latest connection.
        connectionId = ready.setup.connectionId
        closeConfirmed = false
        endedAtDeadline = false
        reported = false
        liveAt = null

        // A start cancelled meanwhile never connects: its reservation is ended at once.
        if (!isCurrent()) {
            report(CallEnd.LearnerEnded)
            scope.launch { release() }
            return null
        }
        return answer
    }

    /** The server opened a new call: the earlier one's words and help aren't this one's. Goals met stay met for the conversation. */
    private fun startOver() {
        val dropped = earlier.turns.size
        earlier = CallSoFar()
        examCuesSent = 0
        clockZeroAt = null
        mutableState.update { it.copy(turns = it.turns.drop(dropped), usedHelp = helped) }
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
        val now = now() ?: return

        when (event) {
            LiveServerEvent.Started -> {}

            // Our server hangs the session up at its deadline.
            LiveServerEvent.Closed -> {
                end(CallEnd.HardStop)
            }

            is LiveServerEvent.Transcript -> {
                mutableState.update { it.copy(turns = it.turns.adding(event)) }
                if (event.speaker == Speaker.LEARNER) {
                    ending?.learnerHeard(now)
                    mutableState.update { it.copy(learnerSpoke = true) }
                } else {
                    ending?.characterSaid(now, event.startMs)
                    gaps.characterSaid(now)
                    mutableState.update { it.copy(answered = true) }
                }
                heardForCheck(event.speaker, event.startMs)
                advance()
            }

            // The answer that follows still answers the learner, after the wait the delegation cost them.
            is LiveServerEvent.Delegation -> {
                gaps.delegated()
                setup
                    ?.script
                    ?.cues
                    ?.noBackend
                    ?.let { transport?.send(it.command(delegationId = event.id)) }
            }

            is LiveServerEvent.CueTaken -> {
                when (event.clientEventId) {
                    in openingEvents -> ending?.openingTaken(now)
                    in goodbyeEvents -> ending?.goodbyeTaken(event.startMs)
                }
                advance()
            }
        }
    }

    /** A muted or blocked microphone never counts as the learner speaking. */
    private fun heard(run: Int) {
        val current = mutableState.value
        if (run != attempt || current.phase != LiveCallPhase.Live || current.muted || current.micBlocked) return
        val now = now() ?: return
        ending?.learnerSpoke(now)
        gaps.learnerSpoke(now)
        advance()
    }

    private fun goLive() {
        val now = now() ?: return
        val setup = setup ?: return
        ending =
            LiveCallEnding(
                timing = setup.script.timing,
                liveAt = now,
                talkEndsAt = setup.talkSeconds * 1000,
                hardStopAt = setup.seconds * 1000,
            )
        gaps = ReplyGaps()
        liveAt = now
        wentLive = true
        talkSecondsLeft = ((setup.talkSeconds * 1000 - now) / 1000).coerceAtLeast(0)
        val zeroAt = clockZeroAt ?: now
        mutableState.update { it.copy(phase = LiveCallPhase.Live, reconnecting = false, elapsedSeconds = (now - zeroAt) / 1000) }

        sendOpening(setup.script.cues.opening)
        waitingReplies.forEach { send(typedReply(setup.script.cues.typedReply, it)) }
        if (waitingReplies.isNotEmpty()) ending?.learnerSent(now)
        waitingReplies.clear()
        startClock(zeroAt)
    }

    private fun startClock(zeroAt: Long) {
        timers +=
            scope.launch {
                while (phase == LiveCallPhase.Live) {
                    delay(TICK)
                    if (phase != LiveCallPhase.Live) return@launch
                    val now = now() ?: return@launch
                    mutableState.update { it.copy(elapsedSeconds = (now - zeroAt) / 1000) }
                    sendExamCue(elapsed = now - zeroAt)
                    advance()
                }
            }
    }

    /**
     * An exam's own cues follow its format, not the ending: none once the call says goodbye, and none
     * twice. Of the cues that came due while the call was down, only the latest is sent, once the
     * character has spoken on this connection, so it follows the resume line. One the connection
     * refused, as it was lost, stays due.
     */
    private fun sendExamCue(elapsed: Long) {
        val cues = task.examCues.orEmpty()
        if (ending?.reason != null || !mutableState.value.answered) return
        val due = cues.indexOfLast { it.atSeconds * 1000 <= elapsed }
        if (due < examCuesSent) return
        if (send(LiveClientCommand.Append(LiveCallCue.Channel.INSTRUCTIONS, cues[due].say))) examCuesSent = due + 1
    }

    /** Does what the ending says is due now, then shows where the call is. */
    private fun advance() {
        if (phase != LiveCallPhase.Live) return
        val machine = ending ?: return
        val script = setup?.script ?: return
        val now = now() ?: return
        while (true) {
            when (val step = machine.next(now) ?: break) {
                LiveCallEnding.Step.RetryOpening -> {
                    sendOpening(script.cues.opening)
                }

                LiveCallEnding.Step.CheckIn -> {
                    send(script.cues.checkIn.command())
                }

                is LiveCallEnding.Step.SayGoodbye -> {
                    val cue = if (step.reason == EndingReason.Done) script.cues.goodbyeDone else script.cues.goodbye
                    // Measured: said aloud at once, a goodbye talked over a learner pausing mid-answer;
                    // as context to keep in mind, it waited for them.
                    val channel = if (step.whileLearnerSpeaks) LiveCallCue.Channel.THINKING else cue.channel
                    send(LiveClientCommand.Append(channel, cue.text, eventId = UUID.randomUUID().toString().also(goodbyeEvents::add)))
                }

                is LiveCallEnding.Step.HangUp -> {
                    end(step.reason?.let(CallEnd::of) ?: CallEnd.HardStop)
                    return
                }
            }
        }
        mutableState.update {
            it.copy(
                characterTalking = machine.characterSpeaking(now),
                learnerSpeaking = machine.learnerSpeaking(now),
                learnerSpoke = it.learnerSpoke || machine.learnerSpeaking(now),
                ending = machine.reason,
                sayingGoodbye = machine.goodbyeSaid,
                quietHint = machine.quietHint(now),
            )
        }
    }

    /** Its acknowledgment starts the wait for a character who stays silent: a slow start isn't greeted twice. */
    private fun sendOpening(cue: LiveCallCue) = send(cue.command(eventId = UUID.randomUUID().toString().also(openingEvents::add)))

    private fun send(command: LiveClientCommand): Boolean {
        gaps.cueSent()
        return transport?.send(command) == true
    }

    /** Every fragment waits for the transcript to settle again; a check still running holds the next. An exam's goal is graded at its end. */
    private fun heardForCheck(
        speaker: Speaker,
        startMs: Double?,
    ) {
        if (task.examCues != null) return
        checkTiming = checkTiming.hearing(speaker, startMs)
        settle?.cancel()
        settle =
            scope.launch {
                do delay(REPLY_SETTLED) while (checking)
                // Its own job: words that come while it runs hold the next check, never cancel this one.
                if (checkTiming.isDue) scope.launch { checkObjectives() }
            }
    }

    private suspend fun checkObjectives() {
        checking = true
        try {
            val checkedAt = now() ?: return
            val turns = mutableState.value.turns.conversationTurns
            checkTiming = checkTiming.read()
            val check = client.checkObjectives(turns) ?: return
            if (phase != LiveCallPhase.Live) return
            val machine = ending ?: return
            if (check.objectivesMet.size > mutableState.value.metLabels.size) {
                mutableState.update { it.copy(metLabels = check.objectivesMet) }
            }
            if (machine.reason == null) check.progress?.let { send(it.command()) }
            if (check.goodbye) machine.saidGoodbye(checkedAt)
            if (task.objectives.isNotEmpty() && check.objectivesMet.containsAll(task.objectives)) {
                now()?.let(machine::goalsMet)
            }
            advance()
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
        // Nothing still running, such as an objective check on its way, ends the call while the server says how it went.
        ending = null
        timers.forEach(Job::cancel)
        timers.clear()
        settle?.cancel()
        scope.launch {
            val closed = release()
            if (run != attempt || !mutableState.value.isOpen) return@launch
            if (closed &&
                endedAtDeadline
            ) {
                end(CallEnd.HardStop)
            } else {
                fail(if (wasLive) LiveCallFailure.Dropped else LiveCallFailure.Connect)
            }
        }
    }

    private fun end(reason: CallEnd) {
        val current = mutableState.value
        val dropped = current.phase == LiveCallPhase.Failed && (current.failure == LiveCallFailure.Dropped || continuing)
        if (!current.isOpen && !dropped) return
        // A start still on its way never connects now: a reservation that comes back is ended at once.
        if (current.phase == LiveCallPhase.Connecting) attempt += 1
        report(reason)
        silence()
        mutableState.update { it.copy(phase = LiveCallPhase.Ended) }
    }

    private fun fail(
        failure: LiveCallFailure,
        limit: Limit.Reached? = null,
    ) {
        report(if (failure == LiveCallFailure.Dropped) CallEnd.Dropped else CallEnd.Failed)
        mutableState.update { it.copy(phase = LiveCallPhase.Failed, failure = failure, limit = limit, reconnecting = false) }
        scope.launch { release() }
    }

    /** Once per connection the server reserved; a refused start had no call to report. */
    private fun report(reason: CallEnd) {
        if (reported || connectionId == null) return
        reported = true
        val learnerTurns =
            mutableState.value.turns
                .drop(earlier.turns.size)
                .conversationTurns
                .count { it.speaker == Speaker.LEARNER }
        val duration = liveAt?.let { live -> now()?.let { (it - live) / 1000 } } ?: 0
        analytics.track(gaps.event(reason, task.kind, learnerTurns, talkSeconds = talkSecondsLeft, durationSeconds = duration))
    }

    private fun silence() {
        timers.forEach(Job::cancel)
        timers.clear()
        settle?.cancel()
        mutableState.update { it.copy(characterTalking = false, learnerSpeaking = false) }
        transport?.silence()
    }

    /** Milliseconds since the setup's answer arrived. */
    private fun now() = answeredAt?.let { (timeSource.markNow() - it).inWholeMilliseconds }

    companion object {
        /** A session that hasn't started after this isn't going to. */
        val CONNECT_TIMEOUT = 15.seconds

        /** The transcript has settled once it stays still this long: the learner's words come back up to 1.8 s late. */
        val REPLY_SETTLED = 2000.milliseconds

        val TICK = 200.milliseconds
    }
}
