package com.zoonk.android.feature.activities

import androidx.compose.runtime.saveable.Saver
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json

/**
 * A [value]'s JSON while it's small enough for saved state, or null. Android sends a screen's
 * saved state in one Bundle and closes the app when that's too large, so a bigger value isn't
 * saved and starts again from its initial value when the screen comes back.
 */
fun <T : Any> savedJson(
    json: Json,
    serializer: KSerializer<T>,
    value: T,
): String? = json.encodeToString(serializer, value).takeIf { it.length <= MAX_SAVED_JSON }

/** [savedJson] for `rememberSaveable`: a run too big to save comes back from the player's answer while it still holds one. */
internal fun <T : Any> jsonSaver(
    json: Json,
    serializer: KSerializer<T>,
): Saver<T?, String> =
    Saver(
        save = { value -> value?.let { savedJson(json, serializer, it) } },
        restore = { json.decodeFromString(serializer, it) },
    )

/** About 32 KB once saved: a program's whole output (the sandbox keeps 10,000 characters) fits, and a few runs and answers stay far below what Android allows. */
private const val MAX_SAVED_JSON = 16_000
