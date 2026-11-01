package com.zoonk.android.feature.activities

import androidx.compose.runtime.saveable.Saver
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json

/**
 * Saves a value as JSON for `rememberSaveable` while it's small. Android sends the whole screen's saved state in one
 * Bundle and closes the app when that's too large, so a bigger value isn't saved and starts again from where it began
 * (for a run, the player's answer).
 */
internal fun <T : Any> jsonSaver(
    json: Json,
    serializer: KSerializer<T>,
): Saver<T?, String> =
    Saver(
        save = { value -> value?.let { json.encodeToString(serializer, it) }?.takeIf { it.length <= MAX_SAVED_JSON } },
        restore = { json.decodeFromString(serializer, it) },
    )

/** About 32 KB once saved, so a few runs and answers stay far below what Android allows. */
private const val MAX_SAVED_JSON = 16_000
