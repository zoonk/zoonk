package com.zoonk.android.feature.livecall

import com.zoonk.api.models.LiveCallTiming

/** Why the call started saying goodbye; the first reason wins. */
enum class EndingReason { Time, Done, Goodbye, Quiet }

/**
 * The call's ending and silence rules, the same as main's and Apple's: when to check on a quiet
 * learner, when to ask the character for its goodbye, and when to hang up. Times are milliseconds on
 * one clock; the call reports what happened and asks [next] what to do at that moment.
 *
 * The hard stop at [hardStopAt] is the one ending that can cut a learner off: it bounds what a call
 * costs, and the other endings finish well before it.
 */
class LiveCallEnding(
    private val timing: LiveCallTiming,
    private val liveAt: Long,
    private val talkEndsAt: Long,
    private val hardStopAt: Long,
) {
    sealed interface Step {
        data object RetryOpening : Step

        data object CheckIn : Step

        /** [reason] picks the words: every goal met thanks the learner, the others have to go. */
        data class SayGoodbye(
            val reason: EndingReason,
        ) : Step

        /** [reason] is null at the hard stop. */
        data class HangUp(
            val reason: EndingReason?,
        ) : Step
    }

    var reason: EndingReason? = null
        private set

    private var armedAt = Long.MAX_VALUE

    var goodbyeSaid = false
        private set

    private var lastCharacterAt: Long? = null
    private var lastVoiceAt: Long? = null
    private var lastTypedAt: Long? = null
    private var silenceSince: Long? = liveAt
    private var checkedIn = false
    private var openingRetried = false
    private var goodbyeSentAt: Long? = null
    private var goodbyeRetried = false
    private var goodbyeHeardFrom: Double? = null

    /** [startMs] is where the words fall on the session's timeline. */
    fun characterSaid(
        now: Long,
        startMs: Double,
    ) {
        lastCharacterAt = now
        if (goodbyeHeardFrom?.let { startMs >= it } == true) goodbyeSaid = true
    }

    /** The session took the goodbye cue at [startMs] on its timeline: what the character says from there is the goodbye. */
    fun goodbyeAcknowledged(startMs: Double) {
        goodbyeHeardFrom = minOf(goodbyeHeardFrom ?: startMs, startMs)
    }

    /** The microphone heard the learner; a muted or blocked one never reports. */
    fun learnerSpoke(now: Long) {
        lastVoiceAt = now
        learnerActed()
    }

    fun learnerTyped(now: Long) {
        lastTypedAt = now
        learnerActed()
    }

    fun goalsMet(now: Long) = arm(EndingReason.Done, now)

    /** The objective check found a mutual goodbye in what it was sent at [checkedAt]; anything the learner did since makes it stale. */
    fun saidGoodbye(checkedAt: Long) {
        val learnerAt = maxOf(lastVoiceAt ?: Long.MIN_VALUE, lastTypedAt ?: Long.MIN_VALUE)
        if (learnerAt > checkedAt) return
        arm(EndingReason.Goodbye, now = checkedAt)
        goodbyeSaid = true
    }

    fun characterSpeaking(now: Long) = lastCharacterAt?.let { now - it < timing.characterQuietMs } == true

    fun learnerSpeaking(now: Long) = lastVoiceAt?.let { now - it < VOICE_HANGOVER_MS } == true

    fun quietHint(now: Long) = reason == null && silenceSince?.let { now - it >= timing.quietHintMs } == true

    fun next(now: Long): Step? {
        if (now >= hardStopAt) return Step.HangUp(null)
        if (goodbyeSaid && now - lastActivityAt() >= timing.goodbyeQuietMs) return Step.HangUp(reason)

        if (now >= talkEndsAt) arm(EndingReason.Time, now)
        val silence = silence(now)
        if (silence >= timing.quietGoodbyeMs) arm(EndingReason.Quiet, now)

        if (reason == null && !checkedIn && silence >= timing.checkInMs) {
            checkedIn = true
            return Step.CheckIn
        }
        if (reason == null && !openingRetried && lastCharacterAt == null && now - liveAt >= timing.openingRetryMs) {
            openingRetried = true
            return Step.RetryOpening
        }
        return goodbyeStep(now)
    }

    private fun goodbyeStep(now: Long): Step? {
        val armed = reason ?: return null
        if (goodbyeSaid || armed == EndingReason.Goodbye) return null
        val sentAt = goodbyeSentAt
        if (sentAt == null) {
            if (characterSpeaking(now)) return null
            val waited = now - maxOf(armedAt, floorFreeAt()) >= timing.answerWaitMs
            val answered = armed == EndingReason.Quiet || learnerActive(now) || waited
            if (!answered) return null
            goodbyeSentAt = now
            return Step.SayGoodbye(armed)
        }
        val unanswered = (lastCharacterAt ?: Long.MIN_VALUE) <= sentAt
        if (goodbyeRetried || !unanswered || now - maxOf(sentAt, lastActivityAt()) < timing.goodbyeRetryMs) return null
        goodbyeRetried = true
        return Step.SayGoodbye(armed)
    }

    /**
     * How long the learner has left the floor unanswered: from when the character stopped, or the
     * learner did. The character's answer to a check-in doesn't start it again.
     */
    private fun silence(now: Long): Long {
        if (characterSpeaking(now) && !checkedIn) silenceSince = null
        if (silenceSince == null && !learnerActive(now) && !characterSpeaking(now)) silenceSince = floorFreeAt()
        return silenceSince?.let { now - it } ?: 0
    }

    private fun arm(
        armed: EndingReason,
        now: Long,
    ) {
        if (reason != null) return
        reason = armed
        armedAt = now
    }

    private fun learnerActed() {
        silenceSince = null
        checkedIn = false
    }

    private fun learnerActive(now: Long) = learnerSpeaking(now) || lastTypedAt?.let { now - it < timing.characterQuietMs } == true

    private fun floorFreeAt() =
        maxOf(
            liveAt,
            lastCharacterAt?.plus(timing.characterQuietMs) ?: liveAt,
            lastVoiceAt?.plus(VOICE_HANGOVER_MS) ?: liveAt,
            lastTypedAt?.plus(timing.characterQuietMs) ?: liveAt,
        )

    private fun lastActivityAt() = maxOf(liveAt, lastCharacterAt ?: liveAt, lastVoiceAt ?: liveAt, lastTypedAt ?: liveAt)

    companion object {
        /** The learner still counts as speaking this long after the microphone last heard them, through the pauses between words. */
        const val VOICE_HANGOVER_MS = 1000L
    }
}
