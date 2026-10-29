package com.zoonk.android.feature.audio

import android.content.Context
import android.net.Uri
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import kotlin.coroutines.resume

/** One player for the app, created on the first sound. It takes audio focus while a clip plays and pauses when headphones come out. */
class ExoAudioOutput(
    private val context: Context,
) : AudioOutput {
    private var created: ExoPlayer? = null
    private val player: ExoPlayer
        get() = created ?: create().also { created = it }

    private fun create() =
        ExoPlayer
            .Builder(context)
            .setAudioAttributes(
                AudioAttributes
                    .Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                    .build(),
                true,
            ).setHandleAudioBecomingNoisy(true)
            .build()

    override suspend fun play(
        file: File,
        rate: Float,
        onStart: () -> Unit,
    ): PlaybackEnd =
        suspendCancellableCoroutine { continuation ->
            val listener =
                object : Player.Listener {
                    private var started = false

                    fun finish(end: PlaybackEnd) {
                        player.removeListener(this)
                        stop()
                        if (continuation.isActive) continuation.resume(end)
                    }

                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        if (isPlaying && !started) {
                            started = true
                            onStart()
                        }
                    }

                    override fun onPlaybackStateChanged(playbackState: Int) {
                        if (playbackState == Player.STATE_ENDED) finish(PlaybackEnd.Ended)
                    }

                    override fun onPlayWhenReadyChanged(
                        playWhenReady: Boolean,
                        reason: Int,
                    ) {
                        // Another app took the audio for good, or the headphones came out.
                        if (!playWhenReady) finish(PlaybackEnd.Stopped)
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        finish(PlaybackEnd.Failed)
                    }
                }
            player.addListener(listener)
            continuation.invokeOnCancellation { player.removeListener(listener) }
            player.setMediaItem(MediaItem.fromUri(Uri.fromFile(file)))
            player.playbackParameters = PlaybackParameters(rate)
            player.prepare()
            player.playWhenReady = true
        }

    override fun stop() {
        created?.stop()
        created?.clearMediaItems()
    }
}
