package com.zoonk.android.feature.livecall

/** One call's peer. Its events, loss and voice arrive on the main thread. */
interface LiveCallTransport {
    suspend fun makeOffer(): String

    suspend fun accept(answer: String)

    /** Whether the channel took it: one closing with a lost connection refuses it. */
    fun send(command: LiveClientCommand): Boolean

    /** Stops the learner's audio going out and the character's playing, for good. */
    fun silence()

    fun close()
}

/** What a call's peer reports. */
class LiveCallSignals(
    val onEvent: (LiveServerEvent) -> Unit,
    /** The connection went away without GPT-Live saying the session closed. */
    val onLost: () -> Unit,
    /** The learner's microphone heard speech just now; it's reported again for as long as it does. */
    val onVoice: () -> Unit,
)

fun interface LiveCallTransports {
    /** Without [microphone], the call sends silence: a GPT-Live session only moves on while audio streams in. */
    fun create(
        microphone: Boolean,
        signals: LiveCallSignals,
    ): LiveCallTransport
}
