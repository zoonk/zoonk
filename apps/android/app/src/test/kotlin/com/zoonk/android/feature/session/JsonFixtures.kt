package com.zoonk.android.feature.session

import com.zoonk.api.ApiJson
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject

/** A response the contract allows, from `src/test/resources/fixtures/<name>.json`, with [overrides] on top. */
internal fun fixture(
    name: String,
    vararg overrides: Pair<String, Any?>,
): JsonObject {
    val text = requireNotNull(object {}.javaClass.getResource("/fixtures/$name.json")).readText()
    return JsonObject(ApiJson.parseToJsonElement(text).jsonObject + overrides.associate { (key, value) -> key to value.toJson() })
}

internal inline fun <reified T> decodeFixture(
    name: String,
    vararg overrides: Pair<String, Any?>,
): T = ApiJson.decodeFromJsonElement(fixture(name, *overrides))

internal fun Any?.toJson(): JsonElement =
    when (this) {
        null -> JsonNull
        is JsonElement -> this
        is String -> JsonPrimitive(this)
        is Number -> JsonPrimitive(this)
        is Boolean -> JsonPrimitive(this)
        else -> error("No JSON for $this")
    }
