package com.zoonk.android.feature.livecall

/** One call's peer. Its events and loss arrive on the main thread. */
interface LiveCallTransport {
    suspend fun makeOffer(): String

    suspend fun accept(answer: String)

    fun send(command: LiveClientCommand)

    /** Stops the learner's audio going out and the character's playing, for good. */
    fun silence()

    fun close()
}

fun interface LiveCallTransports {
    /**
     * Without [microphone], the call sends silence: a GPT-Live session only moves on while audio
     * streams in. [onLost]: the connection went away without GPT-Live saying the session closed.
     */
    fun create(
        microphone: Boolean,
        onEvent: (LiveServerEvent) -> Unit,
        onLost: () -> Unit,
    ): LiveCallTransport
}
