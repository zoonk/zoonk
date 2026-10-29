package com.zoonk.android.feature.livecall

import android.content.Context
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import livekit.org.webrtc.AudioSource
import livekit.org.webrtc.AudioTrack
import livekit.org.webrtc.DataChannel
import livekit.org.webrtc.IceCandidate
import livekit.org.webrtc.MediaConstraints
import livekit.org.webrtc.MediaStream
import livekit.org.webrtc.PeerConnection
import livekit.org.webrtc.PeerConnectionFactory
import livekit.org.webrtc.SdpObserver
import livekit.org.webrtc.SessionDescription
import livekit.org.webrtc.audio.JavaAudioDeviceModule
import java.nio.ByteBuffer
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * GPT-Live's events come on the `oai-events` data channel. The peer is created per call and
 * released when it closes; WebRTC calls its observers on its own threads, so each is posted to the
 * main thread.
 */
class WebRtcLiveCallTransport(
    context: Context,
    private val microphone: Boolean,
    private val onEvent: (LiveServerEvent) -> Unit,
    private val onLost: () -> Unit,
) : LiveCallTransport {
    private val context = context.applicationContext
    private val main = Handler(Looper.getMainLooper())
    private val route = CallAudioRoute(this.context)
    private var connection: PeerConnection? = null
    private var channel: DataChannel? = null
    private var source: AudioSource? = null
    private var track: AudioTrack? = null
    private val gathered = CompletableDeferred<Unit>()
    private val opened = CompletableDeferred<Unit>()
    private val lostAfterGrace = Runnable { if (connection?.connectionState() == PeerConnection.PeerConnectionState.DISCONNECTED) lose() }
    private var closed = false

    override suspend fun makeOffer(): String {
        val webRtc = WebRtc.get(context)
        webRtc.audio.setAudioRecordEnabled(microphone)
        route.start()

        val configuration =
            PeerConnection.RTCConfiguration(emptyList()).apply {
                sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
                continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_ONCE
            }
        val peer = webRtc.factory.createPeerConnection(configuration, observer) ?: error("No peer connection")
        connection = peer

        val audioSource = webRtc.factory.createAudioSource(MediaConstraints())
        val audioTrack = webRtc.factory.createAudioTrack("learner", audioSource)
        source = audioSource
        track = audioTrack
        peer.addTrack(audioTrack, listOf("call"))
        channel = peer.createDataChannel("oai-events", DataChannel.Init()).also { it.registerObserver(channelObserver) }

        peer.describe { setLocalDescription(it) }
        if (peer.iceGatheringState() != PeerConnection.IceGatheringState.COMPLETE) gathered.await()
        check(!closed) { "The call closed" }
        return peer.localDescription.description
    }

    override suspend fun accept(answer: String) {
        val peer = connection
        check(peer != null && !closed) { "The call closed" }
        peer.describe { setRemoteDescription(it, SessionDescription(SessionDescription.Type.ANSWER, answer)) }
        if (channel?.state() != DataChannel.State.OPEN) opened.await()
    }

    override fun send(command: LiveClientCommand) {
        val open = channel?.takeIf { it.state() == DataChannel.State.OPEN } ?: return
        open.send(DataChannel.Buffer(ByteBuffer.wrap(command.json.encodeToByteArray()), false))
    }

    override fun silence() {
        track?.setEnabled(false)
        connection?.receivers?.forEach { it.track()?.setEnabled(false) }
    }

    override fun close() {
        if (closed) return
        closed = true
        main.removeCallbacks(lostAfterGrace)
        gathered.complete(Unit)
        opened.completeExceptionally(IllegalStateException("The call closed"))
        channel?.run {
            unregisterObserver()
            close()
            dispose()
        }
        connection?.dispose()
        track?.dispose()
        source?.dispose()
        channel = null
        connection = null
        track = null
        source = null
        route.stop()
    }

    private fun lose() {
        if (closed) return
        opened.completeExceptionally(IllegalStateException("The call was lost"))
        onLost()
    }

    private fun onMain(block: () -> Unit) {
        main.post { if (!closed) block() }
    }

    private val observer =
        object : PeerConnection.Observer {
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {
                if (state == PeerConnection.IceGatheringState.COMPLETE) onMain { gathered.complete(Unit) }
            }

            override fun onConnectionChange(state: PeerConnection.PeerConnectionState) {
                onMain {
                    when (state) {
                        PeerConnection.PeerConnectionState.CONNECTED -> {
                            main.removeCallbacks(lostAfterGrace)
                        }

                        PeerConnection.PeerConnectionState.DISCONNECTED -> {
                            main.removeCallbacks(lostAfterGrace)
                            main.postDelayed(lostAfterGrace, DISCONNECT_GRACE_MS)
                        }

                        PeerConnection.PeerConnectionState.FAILED, PeerConnection.PeerConnectionState.CLOSED -> {
                            lose()
                        }

                        else -> {}
                    }
                }
            }

            // The call doesn't use these: one audio track each way, ICE gathered before the offer is sent.
            override fun onSignalingChange(state: PeerConnection.SignalingState) = Unit

            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) = Unit

            override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit

            override fun onIceCandidate(candidate: IceCandidate) = Unit

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) = Unit

            override fun onAddStream(stream: MediaStream) = Unit

            override fun onRemoveStream(stream: MediaStream) = Unit

            override fun onDataChannel(channel: DataChannel) = Unit

            override fun onRenegotiationNeeded() = Unit
        }

    private val channelObserver =
        object : DataChannel.Observer {
            override fun onStateChange() {
                val state = channel?.state() ?: return
                onMain {
                    when (state) {
                        DataChannel.State.OPEN -> {
                            opened.complete(Unit)
                        }

                        DataChannel.State.CLOSED -> {
                            opened.completeExceptionally(IllegalStateException("The call's channel closed"))
                            lose()
                        }

                        else -> {}
                    }
                }
            }

            override fun onMessage(buffer: DataChannel.Buffer) {
                if (buffer.binary) return
                // The buffer is WebRTC's only while this runs.
                val text = ByteArray(buffer.data.remaining()).also(buffer.data::get).decodeToString()
                onMain { LiveServerEvent.parse(text)?.let(onEvent) }
            }

            override fun onBufferedAmountChange(previousAmount: Long) = Unit
        }

    private companion object {
        /** A disconnected peer gets this long to come back before the call counts as lost. */
        const val DISCONNECT_GRACE_MS = 5000L
    }
}

/** One factory and audio device for the process, made on the first call. */
private class WebRtc private constructor(
    val factory: PeerConnectionFactory,
    val audio: JavaAudioDeviceModule,
) {
    companion object {
        private var shared: WebRtc? = null

        fun get(context: Context): WebRtc =
            shared ?: run {
                PeerConnectionFactory.initialize(PeerConnectionFactory.InitializationOptions.builder(context).createInitializationOptions())
                val audio = JavaAudioDeviceModule.builder(context).createAudioDeviceModule()
                WebRtc(
                    PeerConnectionFactory.builder().setAudioDeviceModule(audio).createPeerConnectionFactory(),
                    audio,
                ).also { shared = it }
            }
    }
}

/** Runs a description step and resumes once WebRTC confirms it. */
private suspend fun PeerConnection.describe(step: PeerConnection.(SdpObserver) -> Unit) =
    suspendCancellableCoroutine { continuation ->
        step(
            object : SdpObserver {
                override fun onSetSuccess() = continuation.resume(Unit)

                override fun onSetFailure(error: String?) = continuation.resumeWithException(IllegalStateException(error))

                override fun onCreateSuccess(description: SessionDescription?) = Unit

                override fun onCreateFailure(error: String?) = continuation.resumeWithException(IllegalStateException(error))
            },
        )
    }
