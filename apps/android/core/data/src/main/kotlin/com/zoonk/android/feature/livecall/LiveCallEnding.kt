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
            val whileLearnerSpeaks: Boolean,
        ) : Step

        /** [reason] is null at the hard stop. */
        data class HangUp(
            val reason: EndingReason?,
        ) : Step
    }

    var reason: EndingReason? = null
        private set

    var goodbyeSaid = false
        private set

    private var armedAt = Long.MAX_VALUE
    private var lastCharacterAt: Long? = null
    private var lastVoiceAt: Long? = null
    private var lastHeardAt: Long? = null
    private var lastTypedAt: Long? = null
    private var lastSentAt: Long? = null

    private var quietSince = liveAt
    private var checkedIn = false
    private var openingTakenAt: Long? = null
    private var openingRetried = false
    private var goodbyeSentAt: Long? = null
    private var goodbyeRetried = false
    private var goodbyeTaken = false
    private var goodbyeTakenAtMs: Double? = null
    private var goodbyeHeardFromMs: Double? = null

    /** [startMs] is where the words fall on the session's timeline. */
    fun characterSaid(
        now: Long,
        startMs: Double,
    ) {
        lastCharacterAt = now
        // The character's answer to its own check-in doesn't start again the quiet it checks in on.
        if (!checkedIn) soundUntil(now + timing.characterQuietMs)
        if (goodbyeSentAt == null || goodbyeSaid) return
        if (goodbyeTaken) {
            goodbyeSaid = startsGoodbye(startMs)
        } else {
            goodbyeHeardFromMs = maxOf(goodbyeHeardFromMs ?: startMs, startMs)
        }
    }

    /** The session took the opening cue: from then on, a character still silent is greeted again once. */
    fun openingTaken(now: Long) {
        if (openingTakenAt == null) openingTakenAt = now
    }

    /** The session took the goodbye cue at [startMs] on its timeline; words heard before this count when they start near it. */
    fun goodbyeTaken(startMs: Double?) {
        if (goodbyeTaken || goodbyeSentAt == null) return
        goodbyeTaken = true
        goodbyeTakenAtMs = startMs
        goodbyeHeardFromMs?.let { if (startsGoodbye(it)) goodbyeSaid = true }
    }

    /** The microphone heard the learner; a muted or blocked one never reports. */
    fun learnerSpoke(now: Long) {
        lastVoiceAt = now
        learnerActed(until = now + VOICE_HANGOVER_MS)
    }

    /**
     * The learner's words came back as a transcript, 1.3 to 1.8 s after they said them, often after a
     * short answer: they count as speaking.
     */
    fun learnerHeard(now: Long) {
        lastHeardAt = now
        learnerActed(until = now)
    }

    /** A reply being typed holds the goodbye: the character can't see it and would talk over it. */
    fun learnerTyped(now: Long) {
        lastTypedAt = now
        learnerActed(until = now)
    }

    fun learnerSent(now: Long) {
        lastSentAt = now
        lastTypedAt = null
        learnerActed(until = now)
    }

    fun goalsMet(now: Long) = arm(EndingReason.Done, now)

    /**
     * The objective check found a mutual goodbye in what it was sent at [checkedAt]; anything the
     * learner did since makes it stale. Once the goodbye cue went, its own words and their quiet end
     * the call instead.
     */
    fun saidGoodbye(checkedAt: Long) {
        if (goodbyeSentAt != null || (learnerAt() ?: Long.MIN_VALUE) > checkedAt) return
        arm(EndingReason.Goodbye, now = checkedAt)
        goodbyeSaid = true
    }

    fun characterSpeaking(now: Long) = lastCharacterAt?.let { now - it < timing.characterQuietMs } == true

    /** What the microphone hears, for the screen; a learner on a typed call never shows as speaking. */
    fun learnerSpeaking(now: Long) = lastVoiceAt?.let { now - it < VOICE_HANGOVER_MS } == true

    fun quietHint(now: Long) = reason == null && now - quietSince >= timing.quietHintMs

    fun next(now: Long): Step? {
        if (now >= hardStopAt) return Step.HangUp(null)
        if (goodbyeSaid && goodbyeOver(now)) return Step.HangUp(reason)

        if (now >= talkEndsAt) arm(EndingReason.Time, now)
        val quiet = now - quietSince
        if (quiet >= timing.quietGoodbyeMs) arm(EndingReason.Quiet, now)

        if (reason == null && !checkedIn && quiet >= timing.checkInMs) {
            checkedIn = true
            return Step.CheckIn
        }
        val openingAt = openingTakenAt
        if (reason == null && !openingRetried && lastCharacterAt == null && openingAt != null && now - openingAt >= timing.openingRetryMs) {
            openingRetried = true
            return Step.RetryOpening
        }
        return goodbyeStep(now)
    }

    /** One goodbye request at a time, sent once more when nothing at all followed it. */
    private fun goodbyeStep(now: Long): Step? {
        val armed = reason ?: return null
        if (goodbyeSaid) return null
        val sentAt = goodbyeSentAt
        if (sentAt == null) {
            if (!canSayGoodbye(armed, now)) return null
            goodbyeSentAt = now
            return Step.SayGoodbye(armed, learnerTalking(now))
        }
        if (goodbyeRetried || now - maxOf(sentAt, lastActivityAt()) < timing.goodbyeRetryMs) return null
        goodbyeRetried = true
        return Step.SayGoodbye(armed, learnerTalking(now))
    }

    private fun canSayGoodbye(
        armed: EndingReason,
        now: Long,
    ): Boolean {
        if (characterSpeaking(now) || lastTypedAt?.let { now - it < timing.characterQuietMs } == true) return false
        if (armed == EndingReason.Quiet) return true
        // Measured: a goodbye sent with a typed reply was taken as part of the reply and never said,
        // so after one it goes once the character has answered it, whatever the learner says meanwhile.
        val sentAt = lastSentAt
        if (sentAt != null && sentAt >= armedAt) {
            return (lastCharacterAt ?: Long.MIN_VALUE) > sentAt || now - sentAt >= timing.answerWaitMs
        }
        if (learnerTalking(now)) return true
        val characterStopped = lastCharacterAt?.plus(timing.characterQuietMs) ?: liveAt
        return now - maxOf(characterStopped, learnerAt() ?: Long.MIN_VALUE) >= timing.answerWaitMs
    }

    /**
     * Measured over WebRTC: a cue's answer began 200 ms before its acknowledgment's place on the
     * timeline and arrived before it. Words from before the cue started earlier still, since the cue
     * waits for the character to be quiet.
     */
    private fun startsGoodbye(startMs: Double) = goodbyeTakenAtMs?.let { startMs >= it - GOODBYE_LEAD_MS } ?: true

    private fun arm(
        armed: EndingReason,
        now: Long,
    ) {
        if (reason != null) return
        reason = armed
        armedAt = now
    }

    private fun learnerActed(until: Long) {
        soundUntil(until)
        checkedIn = false
    }

    private fun soundUntil(at: Long) {
        quietSince = maxOf(quietSince, at)
    }

    /** The microphone hears them, or their words just came back: the model waits for a speaker to finish. */
    private fun learnerTalking(now: Long) = learnerSpeaking(now) || lastHeardAt?.let { now - it < timing.characterQuietMs } == true

    /**
     * Measured: a noisy room keeps the microphone above the speech level, so after the goodbye its
     * sound holds the call only as long as a learner gets to answer unless it comes back as words.
     */
    private fun goodbyeOver(now: Long) = now - lastActivityAt() >= timing.goodbyeQuietMs || now - lastWordsAt() >= timing.answerWaitMs

    private fun lastWordsAt() = listOfNotNull(liveAt, lastCharacterAt, lastHeardAt, lastTypedAt, lastSentAt).max()

    private fun learnerAt() = listOfNotNull(lastVoiceAt?.plus(VOICE_HANGOVER_MS), lastHeardAt, lastTypedAt, lastSentAt).maxOrNull()

    private fun lastActivityAt() = maxOf(liveAt, lastCharacterAt ?: liveAt, learnerAt() ?: liveAt)

    companion object {
        /** The learner still counts as speaking this long after the microphone last heard them, through the pauses between words. */
        const val VOICE_HANGOVER_MS = 1000L

        private const val GOODBYE_LEAD_MS = 500
    }
}
