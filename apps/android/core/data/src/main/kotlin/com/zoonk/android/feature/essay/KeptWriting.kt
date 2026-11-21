package com.zoonk.android.feature.essay

import kotlinx.serialization.Serializable

/** What this device typed, with the saved draft's revision it was typed over. */
@Serializable
data class KeptWriting(
    val text: String,
    val base: Long,
)

/**
 * This device's text wins only when it was typed over the draft the server still has: a newer
 * draft saved on another device is the one to continue.
 */
fun chooseDraftText(
    kept: KeptWriting?,
    savedText: String?,
    savedRevision: Long?,
): String {
    val revision = savedRevision ?: 0
    return if (kept != null && kept.text.isNotBlank() && kept.base >= revision) kept.text else savedText.orEmpty()
}
