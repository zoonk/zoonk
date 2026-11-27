package com.zoonk.android.feature.tutor

import androidx.compose.runtime.Immutable
import kotlin.time.Instant

/** One of a goal's conversations with the buddy, titled by its first question. */
@Immutable
data class BuddyConversation(
    val id: String,
    val title: String,
    val lastAskedAt: Instant,
)

/**
 * A goal's conversations, latest first, as many pages as were read. [currentId] is the one a cold
 * visit opens (none when it opens blank), and [nextCursor] reads the next page.
 */
@Immutable
data class BuddyConversationList(
    val conversations: List<BuddyConversation>,
    val currentId: String?,
    val nextCursor: String?,
) {
    /** A question asked in [id] makes it the latest; a first one adds its row, titled by it. */
    fun asked(
        id: String,
        question: String,
        at: Instant,
    ): BuddyConversationList {
        val row = conversations.firstOrNull { it.id == id }?.copy(lastAskedAt = at) ?: BuddyConversation(id, question, at)
        return copy(conversations = listOf(row) + conversations.filterNot { it.id == id })
    }

    /** The [next] page after these rows; a row that moved up since this one was read is listed once. */
    fun appending(next: BuddyConversationList): BuddyConversationList {
        val listed = conversations.mapTo(mutableSetOf()) { it.id }
        return copy(conversations = conversations + next.conversations.filterNot { it.id in listed }, nextCursor = next.nextCursor)
    }
}
