package com.zoonk.android.feature.livecall

import com.zoonk.api.models.LanguageConversationSetup
import com.zoonk.api.models.LanguageConversationTurn
import com.zoonk.api.models.LanguageConversationTurn.Speaker
import kotlinx.coroutines.CompletableDeferred
import java.util.UUID
import kotlin.time.Instant

internal val CONNECTION: UUID = UUID.fromString("00000000-0000-4000-8000-000000000001")

internal fun setup(
    seconds: Long = 300,
    endsAtLimit: LanguageConversationSetup.EndsAtLimit? = null,
    connectionId: UUID = CONNECTION,
) = LanguageConversationSetup(
    connectionId = connectionId,
    deadlineAt = Instant.parse("2026-10-29T12:05:00Z"),
    endsAtLimit = endsAtLimit,
    seconds = seconds,
    sessionUrl = "",
    voice = "marin",
)

internal fun learnerSays(
    text: String,
    startMs: Double,
    endMs: Double,
) = LiveServerEvent.Transcript(Speaker.LEARNER, text, startMs, endMs)

internal fun characterSays(
    text: String,
    startMs: Double = 0.0,
    endMs: Double = 0.0,
) = LiveServerEvent.Transcript(Speaker.CHARACTER, text, startMs, endMs)

internal class FakeTransport(
    val microphone: Boolean,
    val onEvent: (LiveServerEvent) -> Unit,
    val onLost: () -> Unit,
) : LiveCallTransport {
    val sent = mutableListOf<LiveClientCommand>()
    var answer: String? = null
    var silenced = false
    var closed = false

    /** Holds [makeOffer] until completed. */
    var offerGate: CompletableDeferred<Unit>? = null

    override suspend fun makeOffer(): String {
        offerGate?.await()
        return "offer"
    }

    override suspend fun accept(answer: String) {
        this.answer = answer
    }

    override fun send(command: LiveClientCommand) {
        sent += command
    }

    override fun silence() {
        silenced = true
    }

    override fun close() {
        closed = true
    }

    val instructions get() = sent.filterIsInstance<LiveClientCommand.Instructions>().map { it.content }
    val thinking get() = sent.filterIsInstance<LiveClientCommand.Thinking>()
}

internal class FakeCallClient : LiveCallClient {
    var reservations = ArrayDeque<CallReservation>(listOf(CallReservation.Ready(setup())))
    val connects = mutableListOf<Boolean>()
    val redeemed = mutableListOf<Pair<UUID, String>>()
    val ended = mutableListOf<UUID>()
    var endAnswers = ArrayDeque<Boolean?>()
    val checks = mutableListOf<List<LanguageConversationTurn>>()
    var met: (List<LanguageConversationTurn>) -> List<String>? = { emptyList() }

    /** Holds the reservation with that number (from 1) until completed. */
    val connectGates = mutableMapOf<Int, CompletableDeferred<Unit>>()

    /** Holds every objective check until completed. */
    var checkGate: CompletableDeferred<Unit>? = null

    override suspend fun connect(takeover: Boolean): CallReservation {
        connects += takeover
        connectGates[connects.size]?.await()
        return reservations.removeFirstOrNull() ?: CallReservation.Failed
    }

    override suspend fun redeem(
        connectionId: UUID,
        offer: String,
    ): String {
        redeemed += connectionId to offer
        return "answer"
    }

    override suspend fun end(connectionId: UUID): Boolean? {
        ended += connectionId
        return if (endAnswers.isEmpty()) false else endAnswers.removeFirst()
    }

    override suspend fun checkObjectives(turns: List<LanguageConversationTurn>): List<String>? {
        checks += turns
        checkGate?.await()
        return met(turns)
    }
}
