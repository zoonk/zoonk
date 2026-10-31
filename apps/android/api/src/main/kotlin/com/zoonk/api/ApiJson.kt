package com.zoonk.api

import com.zoonk.api.infrastructure.Serializer
import kotlinx.serialization.json.Json

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
