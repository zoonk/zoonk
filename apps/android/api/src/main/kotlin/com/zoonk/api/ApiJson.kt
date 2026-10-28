package com.zoonk.api

import com.zoonk.api.infrastructure.Serializer
import kotlinx.serialization.json.Json

/**
 * The one `Json` for requests and responses. It starts from the generated configuration so the
 * contextual serializers the models use (UUID and the rest) resolve, and leaves nulls out: the
 * generated configuration encodes defaults, so a PATCH meant to change one field would otherwise
 * send every other optional field as `null` and clear it. A request that must send an explicit
 * `null` builds its body as JSON.
 */
val ApiJson: Json = Json(from = Serializer.kotlinxSerializationJson) { explicitNulls = false }
