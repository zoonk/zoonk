package com.zoonk.android.feature.session

import com.zoonk.api.ApiJson
import com.zoonk.api.models.StudyBlock
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject

/** A response the contract allows, from `src/test/resources/fixtures/<name>.json`, with [overrides] on top. */
fun fixture(
    name: String,
    vararg overrides: Pair<String, Any?>,
): JsonObject {
    val text = requireNotNull(object {}.javaClass.getResource("/fixtures/$name.json")).readText()
    return JsonObject(ApiJson.parseToJsonElement(text).jsonObject + overrides.associate { (key, value) -> key to value.toJson() })
}

/** A completion's `blocks`, in order, with [blockId] ids. */
fun studyBlocks(vararg blocks: Pair<StudyBlock.Kind, StudyBlock.Status>): JsonArray =
    JsonArray(
        blocks.mapIndexed { position, (kind, status) ->
            fixture(
                "study-block",
                "id" to blockId(position).toString(),
                "kind" to kind.value,
                "position" to position,
                "status" to status.value,
            )
        },
    )

inline fun <reified T> decodeFixture(
    name: String,
    vararg overrides: Pair<String, Any?>,
): T = ApiJson.decodeFromJsonElement(fixture(name, *overrides))

fun Any?.toJson(): JsonElement =
    when (this) {
        null -> JsonNull
        is JsonElement -> this
        is String -> JsonPrimitive(this)
        is Number -> JsonPrimitive(this)
        is Boolean -> JsonPrimitive(this)
        else -> error("No JSON for $this")
    }
