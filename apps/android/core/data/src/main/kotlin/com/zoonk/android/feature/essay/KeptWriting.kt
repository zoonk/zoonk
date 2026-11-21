package com.zoonk.android.feature.essay

import com.zoonk.api.models.WritingDraft
import kotlinx.serialization.Serializable

/** The API's longest written answer, in UTF-16 code units, for a draft and a submission alike. */
const val MAX_WRITING_CHARACTERS = 48_000

/**
 * What this device typed under one admission, with the saved draft's revision it was typed over.
 * [sending] is a save of this admission that was out when it was kept, which the server may hold
 * at a later revision; [writingMs] is the active writing time so far.
 */
@Serializable
data class KeptWriting(
    val text: String,
    val base: Long,
    val admissionId: String,
    val sending: String? = null,
    val writingMs: Long = 0,
    // The server already graded the earlier text under this admission. These edits are for Rewrite.
    val replayed: Boolean = false,
)

/** Where an opened answer starts: the server's draft, this device's text over it, or both to choose between. */
sealed interface DraftStart {
    val text: String

    data class Saved(
        override val text: String,
    ) : DraftStart

    data class Kept(
        override val text: String,
        val base: Long,
    ) : DraftStart

    /** Another device saved after this text was typed: neither is overwritten until the learner picks. */
    data class Conflict(
        override val text: String,
        val saved: WritingDraft,
    ) : DraftStart
}

/**
 * This device's text continues only under the admission it was written for, and only over the
 * draft it was typed over, or over a later one this device's own save made. A newer draft from
 * elsewhere keeps both texts for the learner to choose; an empty text kept here is an edit too.
 */
fun chooseDraft(
    kept: KeptWriting?,
    saved: WritingDraft?,
    admissionId: String?,
): DraftStart {
    val savedText = saved?.text.orEmpty()
    val revision = saved?.revision ?: 0
    return when {
        kept == null || admissionId == null || kept.admissionId != admissionId || kept.text == savedText -> {
            DraftStart.Saved(savedText)
        }

        kept.base >= revision -> {
            DraftStart.Kept(kept.text, revision)
        }

        kept.sending == savedText -> {
            DraftStart.Kept(kept.text, revision)
        }

        else -> {
            DraftStart.Conflict(kept.text, checkNotNull(saved))
        }
    }
}
