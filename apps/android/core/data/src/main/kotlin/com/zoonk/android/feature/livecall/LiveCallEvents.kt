package com.zoonk.android.feature.livecall

import com.zoonk.api.models.LanguageConversationTurn.Speaker
import com.zoonk.api.models.LiveCallCue
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** GPT-Live's other events (usage, other acknowledgments, errors for a cue it rejected) don't move the call. */
sealed interface LiveServerEvent {
    data object Started : LiveServerEvent

    data object Closed : LiveServerEvent

    data class Transcript(
        val speaker: Speaker,
        val delta: String,
        val startMs: Double,
        val endMs: Double,
    ) : LiveServerEvent

    data class Delegation(
        val id: String,
    ) : LiveServerEvent

    /** The session took the commentary sent with [clientEventId]; [startMs] is where on its timeline. */
    data class CommentaryTaken(
        val clientEventId: String,
        val startMs: Double,
    ) : LiveServerEvent

    companion object {
        /** The `oai-events` channel's message, or null for any event that doesn't move the call. */
        fun parse(text: String): LiveServerEvent? {
            val event = runCatching { Json.parseToJsonElement(text).jsonObject }.getOrNull() ?: return null
            return when (val type = event.string("type")) {
                "session.started" -> {
                    Started
                }

                "session.closed" -> {
                    Closed
                }

                "session.input_transcript.delta", "session.output_transcript.delta" -> {
                    val delta = event.string("delta") ?: return null
                    val startMs = event.number("start_ms") ?: return null
                    val endMs = event.number("end_ms")?.takeIf { it >= startMs } ?: return null
                    val speaker = if (type == "session.input_transcript.delta") Speaker.LEARNER else Speaker.CHARACTER
                    Transcript(speaker, delta, startMs, endMs)
                }

                "session.delegation.created" -> {
                    (event["delegation"] as? JsonObject)?.string("id")?.let(::Delegation)
                }

                "session.commentary.appended" -> {
                    val id = event.string("client_event_id") ?: return null
                    event.number("start_ms")?.let { CommentaryTaken(id, it) }
                }

                else -> {
                    null
                }
            }
        }

        private fun JsonObject.string(key: String) = (get(key) as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull

        private fun JsonObject.number(key: String) = get(key)?.jsonPrimitive?.takeUnless { it.isString }?.doubleOrNull
    }
}

/** What the app tells GPT-Live during a call: context on one of its channels, and muting the learner's audio. */
sealed interface LiveClientCommand {
    /** [eventId] comes back on the session's acknowledgment of it. */
    data class Append(
        val channel: LiveCallCue.Channel,
        val content: String,
        val delegationId: String? = null,
        val eventId: String? = null,
    ) : LiveClientCommand

    data class Mute(
        val muted: Boolean,
    ) : LiveClientCommand

    /** The event as GPT-Live reads it (`@ai-sdk/openai`'s `serializeOpenAILiveClientEvent`). */
    val json: String
        get() =
            when (this) {
                is Append -> {
                    buildJsonObject {
                        put("type", JsonPrimitive("session.${channel.value}.append"))
                        put("content", JsonPrimitive(content))
                        put("delegation_id", delegationId?.let(::JsonPrimitive) ?: JsonNull)
                        eventId?.let { put("event_id", JsonPrimitive(it)) }
                    }
                }

                is Mute -> {
                    buildJsonObject { put("type", JsonPrimitive(if (muted) "session.input_audio.mute" else "session.input_audio.unmute")) }
                }
            }.toString()
}

/** [cue] with [reply], the typed words, quoted as data after it: never instructions. */
fun typedReply(
    cue: LiveCallCue,
    reply: String,
) = LiveClientCommand.Append(cue.channel, cue.text + JsonPrimitive(reply).toString())

fun LiveCallCue.command(
    delegationId: String? = null,
    eventId: String? = null,
) = LiveClientCommand.Append(channel, text, delegationId, eventId)
