package com.zoonk.android.feature.livecall

import com.zoonk.api.models.LanguageConversationTurn
import com.zoonk.api.models.LanguageConversationTurn.Speaker
import kotlin.math.roundToLong

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

/** Fragments are appended exactly as received, since they carry their own spaces. */
fun List<TranscriptTurn>.adding(fragment: LiveServerEvent.Transcript): List<TranscriptTurn> {
    val last = lastOrNull()
    if (last != null && last.speaker == fragment.speaker && last.startMs != null) {
        return dropLast(1) + last.copy(text = last.text + fragment.delta, endMs = fragment.endMs)
    }
    return this + TranscriptTurn(fragment.speaker, fragment.delta, fragment.startMs, fragment.endMs)
}

fun List<TranscriptTurn>.addingTypedReply(text: String) = this + TranscriptTurn(Speaker.LEARNER, text)

val List<TranscriptTurn>.spokenSeconds: Long
    get() {
        val spokenMs =
            filter { it.speaker == Speaker.LEARNER }
                .sumOf { turn -> if (turn.startMs != null && turn.endMs != null) turn.endMs - turn.startMs else 0.0 }
        return (spokenMs / 1000).roundToLong()
    }

val List<TranscriptTurn>.conversationTurns: List<LanguageConversationTurn>
    get() =
        mapNotNull { turn ->
            turn.text
                .trim()
                .take(MAX_TURN_LENGTH)
                .takeIf { it.isNotEmpty() }
                ?.let { LanguageConversationTurn(turn.speaker, it) }
        }.take(MAX_TURNS)
