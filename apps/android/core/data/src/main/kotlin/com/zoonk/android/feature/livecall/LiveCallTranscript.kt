package com.zoonk.android.feature.livecall

import com.zoonk.api.models.LanguageConversationTurn
import com.zoonk.api.models.LanguageConversationTurn.Speaker

/** Mirrors main's `live-call-transcript.ts`. A typed reply has no timeline. */
data class TranscriptTurn(
    val speaker: Speaker,
    val text: String,
    val startMs: Double? = null,
    val endMs: Double? = null,
)

/** The longest turn and the most turns the API takes (core's `turn-limits`). */
private const val MAX_TURN_LENGTH = 2000
private const val MAX_TURNS = 300

/** A pause this long between two fragments starts a new sentence. */
private const val UTTERANCE_PAUSE_MS = 1000

/**
 * Fragments carry their own spaces, so they're appended as received, except the first of words said
 * after a pause, which comes without one.
 */
fun List<TranscriptTurn>.adding(fragment: LiveServerEvent.Transcript): List<TranscriptTurn> {
    val last = lastOrNull()
    if (last != null && last.speaker == fragment.speaker && last.startMs != null) {
        val paused = last.endMs != null && fragment.startMs - last.endMs >= UTTERANCE_PAUSE_MS
        val spaced = last.text.lastOrNull()?.isWhitespace() == true || fragment.delta.firstOrNull()?.isWhitespace() == true
        val text = last.text + (if (paused && !spaced) " " else "") + fragment.delta
        return dropLast(1) + last.copy(text = text, endMs = fragment.endMs)
    }
    return this + TranscriptTurn(fragment.speaker, fragment.delta, fragment.startMs, fragment.endMs)
}

fun List<TranscriptTurn>.addingTypedReply(text: String) = this + TranscriptTurn(Speaker.LEARNER, text)

val List<TranscriptTurn>.spokenMs: Double
    get() =
        filter { it.speaker == Speaker.LEARNER }
            .sumOf { turn -> if (turn.startMs != null && turn.endMs != null) turn.endMs - turn.startMs else 0.0 }

val List<TranscriptTurn>.conversationTurns: List<LanguageConversationTurn>
    get() =
        mapNotNull { turn ->
            turn.text
                .trim()
                .take(MAX_TURN_LENGTH)
                .takeIf { it.isNotEmpty() }
                ?.let { LanguageConversationTurn(turn.speaker, it) }
        }.takeLast(MAX_TURNS)
