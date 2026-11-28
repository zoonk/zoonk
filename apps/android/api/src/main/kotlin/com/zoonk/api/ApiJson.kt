package com.zoonk.api

import com.zoonk.api.infrastructure.Serializer
import kotlinx.serialization.SerializationStrategy
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonEncoder

/**
 * Reads responses. It starts from the generated configuration so the models' contextual serializers
 * (UUID) resolve, and reads an absent nullable field as `null`.
 */
val ApiJson: Json = Json(from = Serializer.kotlinxSerializationJson) { explicitNulls = false }

/**
 * Writes request bodies: a field the contract requires keeps its `null`, and an optional field left
 * unset stays out, so a PATCH doesn't clear it. A request that must send `null` for an optional field
 * builds its body as JSON.
 */
val ApiRequestJson: Json =
    Json(from = ApiJson) {
        explicitNulls = true
        encodeDefaults = false
    }

private val knownEnumsJson = Json(from = ApiJson) {}

private class UnknownApiEnum : RuntimeException()

/** Activities must be understood before a run starts. Free-form strings can contain any text. */
fun <T> encodeWithKnownEnums(
    serializer: SerializationStrategy<T>,
    value: T,
): JsonElement? =
    try {
        knownEnumsJson.encodeToJsonElement(serializer, value)
    } catch (_: UnknownApiEnum) {
        null
    }

internal fun Encoder.unknownApiEnum() {
    if (this is JsonEncoder && json === knownEnumsJson) throw UnknownApiEnum()
}
