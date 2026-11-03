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
 * may have started that answer. Speaking again after a pause is the same turn, which keeps a cue sent
 * during it; the pause counts as unanswered when it outlasted a slow reply, as does a turn the call
 * ended on.
 */
class ReplyGaps {
    private var unansweredTurns = 0
    private var delegations = 0
    private val gaps = mutableListOf<Long>()
    private var lastVoiceAt: Long? = null
    private var cueSinceVoice = false

    fun learnerSpoke(now: Long) {
        val voiceAt = lastVoiceAt
        if (voiceAt == null) {
            cueSinceVoice = false
        } else if (now - voiceAt >= SLOW_REPLY_MS) {
            unansweredTurns += 1
        }
        lastVoiceAt = now
    }

    fun cueSent() {
        if (lastVoiceAt != null) cueSinceVoice = true
    }

    /** Words the character says over the learner, while the microphone still hears them, don't answer them. */
    fun characterSaid(now: Long) {
        val voiceAt = lastVoiceAt ?: return
        if (now - voiceAt < OVERLAP_MS) return
        if (!cueSinceVoice) gaps += now - voiceAt
        lastVoiceAt = null
    }

    fun delegated() {
        delegations += 1
    }

    /** [learnerTurns] come from the transcript, so a typed call counts its replies. */
    fun event(
        end: CallEnd,
        kind: String,
        learnerTurns: Int,
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

        /** Two of the microphone's samples. */
        const val OVERLAP_MS = 400L
    }
}
