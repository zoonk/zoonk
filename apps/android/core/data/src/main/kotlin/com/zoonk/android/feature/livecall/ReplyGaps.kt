package com.zoonk.android.feature.livecall

import com.zoonk.android.data.AnalyticsEvent

/** How a call ended, as the call-ended event names it. */
enum class CallEnd(
    val value: String,
) {
    Time("time"),
    Done("done"),
    Goodbye("goodbye"),
    Quiet("quiet"),
    LearnerEnded("learner_ended"),
    HardStop("hard_stop"),
    Dropped("dropped"),
    Failed("failed"),
    ;

    companion object {
        fun of(reason: EndingReason) =
            when (reason) {
                EndingReason.Time -> Time
                EndingReason.Done -> Done
                EndingReason.Goodbye -> Goodbye
                EndingReason.Quiet -> Quiet
            }
    }
}

/**
 * A proxy for how long the character took to answer: from the learner's microphone last hearing them
 * to the character's next words arriving. A gap after a cue the app sent is left out, since the cue
 * may have started that answer. A learner turn no answer followed (they spoke again after a slow
 * reply's wait, or the call ended) counts as unanswered.
 */
class ReplyGaps {
    private var learnerTurns = 0
    private var unansweredTurns = 0
    private var delegations = 0
    private val gaps = mutableListOf<Long>()
    private var lastVoiceAt: Long? = null
    private var cueSinceVoice = false

    fun learnerSpoke(now: Long) {
        val voiceAt = lastVoiceAt
        if (voiceAt != null && now - voiceAt >= SLOW_REPLY_MS) unansweredTurns += 1
        if (voiceAt == null || now - voiceAt >= SLOW_REPLY_MS) learnerTurns += 1
        lastVoiceAt = now
        cueSinceVoice = false
    }

    fun cueSent() {
        if (lastVoiceAt != null) cueSinceVoice = true
    }

    /** Words the character says over the learner don't answer them. */
    fun characterSaid(
        now: Long,
        learnerSpeaking: Boolean,
    ) {
        val voiceAt = lastVoiceAt ?: return
        if (learnerSpeaking) return
        if (!cueSinceVoice) gaps += now - voiceAt
        lastVoiceAt = null
    }

    fun delegated() {
        delegations += 1
    }

    fun event(
        end: CallEnd,
        kind: String,
        talkSeconds: Long,
        durationSeconds: Long,
    ): AnalyticsEvent.CallEnded {
        val sorted = gaps.sorted()
        val median = sorted.takeIf { it.isNotEmpty() }?.let { (it[(it.size - 1) / 2] + it[it.size / 2]) / 2 }
        return AnalyticsEvent.CallEnded(
            reason = end.value,
            conversationKind = kind,
            talkSeconds = talkSeconds,
            durationSeconds = durationSeconds,
            learnerTurns = learnerTurns,
            unansweredTurns = unansweredTurns + if (lastVoiceAt != null) 1 else 0,
            replyGapMedianMs = median,
            replyGapMaxMs = sorted.lastOrNull(),
            slowReplies = gaps.count { it > SLOW_REPLY_MS },
            delegations = delegations,
        )
    }

    private companion object {
        const val SLOW_REPLY_MS = 3000L
    }
}
