package com.zoonk.android.feature.livecall

import com.zoonk.api.models.LanguageConversationTurn.Speaker

/**
 * When the call's goals are checked, as on web and Apple: once the transcript has settled, if it
 * holds learner words no check read and the character answered them. The learner's words come back
 * 1.3 to 1.8 s late, often after that answer, so who spoke last is read from the session's timeline,
 * not from when the words arrived.
 */
data class CheckTiming(
    private val latest: Speaker? = null,
    private val latestStartMs: Double = 0.0,
    private val learnerUnread: Boolean = false,
) {
    /** [startMs] is null for a typed reply: it counts as the latest words when it's sent. */
    fun hearing(
        speaker: Speaker,
        startMs: Double?,
    ): CheckTiming {
        val at = startMs ?: latestStartMs
        val isLatest = latest == null || at >= latestStartMs
        return CheckTiming(
            latest = if (isLatest) speaker else latest,
            latestStartMs = if (isLatest) at else latestStartMs,
            learnerUnread = learnerUnread || speaker == Speaker.LEARNER,
        )
    }

    fun read() = copy(learnerUnread = false)

    val isDue get() = learnerUnread && latest == Speaker.CHARACTER
}
