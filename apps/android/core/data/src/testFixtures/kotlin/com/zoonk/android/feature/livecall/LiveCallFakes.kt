package com.zoonk.android.feature.livecall

import com.zoonk.api.models.LanguageConversationObjectiveCheck
import com.zoonk.api.models.LanguageConversationSetup
import com.zoonk.api.models.LanguageConversationTurn
import com.zoonk.api.models.LanguageConversationTurn.Speaker
import com.zoonk.api.models.LiveCallCue
import com.zoonk.api.models.LiveCallCues
import com.zoonk.api.models.LiveCallScript
import com.zoonk.api.models.LiveCallTiming
import kotlinx.coroutines.CompletableDeferred
import java.util.UUID
import kotlin.time.Instant

val CONNECTION: UUID = UUID.fromString("00000000-0000-4000-8000-000000000001")

private fun commentary(text: String) = LiveCallCue(LiveCallCue.Channel.COMMENTARY, text)

/** The server's cues for a call, each named by what it asks, and its timings. */
val SCRIPT =
    LiveCallScript(
        cues =
            LiveCallCues(
                checkIn = commentary("Check in"),
                goodbye = commentary("Say goodbye"),
                goodbyeDone = commentary("Thank them and say goodbye"),
                noBackend = LiveCallCue(LiveCallCue.Channel.THINKING, "Nothing to look up"),
                opening = commentary("Open the call"),
                typedReply = commentary("They typed: "),
            ),
        timing =
            LiveCallTiming(
                answerWaitMs = 8000,
                characterQuietMs = 1500,
                checkInMs = 25_000,
                goodbyeQuietMs = 3000,
                goodbyeRetryMs = 8000,
                openingRetryMs = 5000,
                quietGoodbyeMs = 50_000,
                quietHintMs = 12_000,
            ),
    )

/** [talkSeconds] of talk, then the server hangs up [seconds] after the answer; [continuesCall] when the call dropped and was called again. */
fun setup(
    talkSeconds: Long = 300,
    seconds: Long = talkSeconds + 45,
    continuesCall: Boolean = false,
) = LanguageConversationSetup(
    connectionId = CONNECTION,
    continuesCall = continuesCall,
    deadlineAt = Instant.parse("2026-10-29T12:05:00Z"),
    script = SCRIPT,
    seconds = seconds,
    sessionUrl = "",
    talkSeconds = talkSeconds,
    voice = "marin",
)

fun learnerSays(
    text: String,
    startMs: Double,
    endMs: Double,
) = LiveServerEvent.Transcript(Speaker.LEARNER, text, startMs, endMs)

fun characterSays(
    text: String,
    startMs: Double = 0.0,
    endMs: Double = 0.0,
) = LiveServerEvent.Transcript(Speaker.CHARACTER, text, startMs, endMs)

class FakeTransport(
    val microphone: Boolean,
    private val signals: LiveCallSignals,
) : LiveCallTransport {
    fun onEvent(event: LiveServerEvent) = signals.onEvent(event)

    fun onLost() = signals.onLost()

    /** The learner's microphone hearing them for one sample. */
    fun voice() = signals.onVoice()

    val sent = mutableListOf<LiveClientCommand>()
    var answer: String? = null
    var silenced = false
    var closed = false

    /** The channel closing with a lost connection: it takes nothing. */
    var refusing = false

    override suspend fun makeOffer(): String = "offer"

    override suspend fun accept(answer: String) {
        this.answer = answer
    }

    override fun send(command: LiveClientCommand): Boolean {
        if (refusing) return false
        sent += command
        return true
    }

    override fun silence() {
        silenced = true
    }

    override fun close() {
        closed = true
    }

    val appended get() = sent.filterIsInstance<LiveClientCommand.Append>()

    /** What was said aloud, with the event id goodbyes carry. */
    val commentary get() = appended.filter { it.channel == LiveCallCue.Channel.COMMENTARY }

    val instructions get() = appended.filter { it.channel == LiveCallCue.Channel.INSTRUCTIONS }.map { it.content }

    val thinking get() = appended.filter { it.channel == LiveCallCue.Channel.THINKING }
}

class FakeCallClient : LiveCallClient {
    var reservations = ArrayDeque<CallReservation>(listOf(CallReservation.Ready(setup())))
    val connects = mutableListOf<Boolean>()
    val redeemed = mutableListOf<Pair<UUID, String>>()
    val offeredTurns = mutableListOf<List<LanguageConversationTurn>>()
    val ended = mutableListOf<UUID>()
    var endAnswers = ArrayDeque<Boolean?>()
    val checks = mutableListOf<List<LanguageConversationTurn>>()
    var check: (
        List<LanguageConversationTurn>,
    ) -> LanguageConversationObjectiveCheck? = {
        LanguageConversationObjectiveCheck(goodbye = false, objectivesMet = emptyList(), progress = null)
    }

    /** Holds the reservation with that number (from 1) until completed. */
    val connectGates = mutableMapOf<Int, CompletableDeferred<Unit>>()

    /** Holds every objective check until completed. */
    var checkGate: CompletableDeferred<Unit>? = null

    /** Holds every hangup until completed. */
    var endGate: CompletableDeferred<Unit>? = null

    override suspend fun connect(takeover: Boolean): CallReservation {
        connects += takeover
        connectGates[connects.size]?.await()
        return reservations.removeFirstOrNull() ?: CallReservation.Failed
    }

    override suspend fun redeem(
        connectionId: UUID,
        offer: String,
        turns: List<LanguageConversationTurn>,
    ): String {
        redeemed += connectionId to offer
        offeredTurns += turns
        return "answer"
    }

    override suspend fun end(connectionId: UUID): Boolean? {
        ended += connectionId
        endGate?.await()
        return if (endAnswers.isEmpty()) false else endAnswers.removeFirst()
    }

    override suspend fun checkObjectives(turns: List<LanguageConversationTurn>): LanguageConversationObjectiveCheck? {
        checks += turns
        checkGate?.await()
        return check(turns)
    }
}
