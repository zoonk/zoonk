package com.zoonk.api

import com.zoonk.api.infrastructure.Serializer
import kotlinx.serialization.json.Json

/**
 * Starts from the generated configuration so the models' contextual serializers (UUID) resolve,
 * and leaves nulls out: that configuration encodes defaults, so a PATCH would otherwise send every
 * unset field as `null` and clear it. A request that must send `null` builds its body as JSON.
 */
val ApiJson: Json = Json(from = Serializer.kotlinxSerializationJson) { explicitNulls = false }
