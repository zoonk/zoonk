package com.zoonk.android.feature.activities.music

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos

/** A tune played on the piano, with the note sounding now; the sound and the highlight start on the same moment of [MusicClock]. */
class NotationPlayback internal constructor(
    private val audio: MusicAudio,
) {
    data class Event(
        val element: NotationElementId,
        /** Seconds from the first note. */
        val start: Double,
    )

    class Schedule(
        val events: List<Event>,
        val sounds: List<MusicSound>,
        val seconds: Double,
    )

    private class Run(
        val start: Double,
        val events: List<Event>,
        val end: Double,
    ) {
        var cursor = -1
    }

    private var run by mutableStateOf<Run?>(null)

    /** The note or rest sounding now, or null between runs. */
    var playing by mutableStateOf<NotationElementId?>(null)
        private set

    val isPlaying: Boolean get() = run != null

    fun play(
        tune: AbcTune,
        bpm: Int,
    ) {
        stop()

        val schedule = schedule(tune, bpm)

        if (schedule.events.isEmpty()) return

        val start = (audio.soonestHeardTime() ?: return) + START_DELAY
        audio.play(schedule.sounds, MusicInstrument.Piano, from = start)
        run = Run(start, schedule.events, start + schedule.seconds)
    }

    fun stop() {
        if (run != null) audio.stop()
        run = null
        playing = null
    }

    internal suspend fun follow() {
        while (run != null) withFrameNanos { advance(it / NANOS) }
    }

    /** Frame times are `System.nanoTime`'s, as [MusicClock]'s are. */
    private fun advance(now: Double) {
        val current = run ?: return

        if (now >= current.end) {
            run = null
            playing = null
            return
        }

        while (current.cursor + 1 < current.events.size && current.events[current.cursor + 1].start <= now - current.start) {
            current.cursor += 1
        }

        playing = current.events.getOrNull(current.cursor)?.element
    }

    companion object {
        private const val START_DELAY = 0.05
        private const val NANOS = 1e9

        /**
         * Every note and rest in playing order with its start, the notes as sounds (a tie rings on instead of striking again),
         * and how long the tune lasts: a beat (abcjs's beat length for the meter) lasts 60 / [bpm] seconds.
         */
        fun schedule(
            tune: AbcTune,
            bpm: Int,
        ): Schedule {
            val secondsPerWhole = 60.0 / bpm / tune.meter.beatLength
            val played =
                tune.playOrder.flatMap { bar ->
                    tune.bars[bar].elements.mapIndexed { index, it ->
                        NotationElementId(bar, index) to
                            it
                    }
                }
            val events = mutableListOf<Event>()
            val sounds = mutableListOf<MusicSound>()
            var time = 0.0

            played.forEachIndexed { index, (id, element) ->
                events += Event(id, time)

                for (pitch in element.pitches) {
                    if (pitch.continuesTie) continue

                    var length = element.sounding
                    var next = index
                    var isTied = pitch.isTied

                    while (isTied && next + 1 < played.size) {
                        val held = played[next + 1].second.pitches.firstOrNull { it.midi == pitch.midi && it.continuesTie } ?: break
                        next += 1
                        length += played[next].second.sounding
                        isTied = held.isTied
                    }

                    sounds += MusicSound(time, pitch.midi, length * secondsPerWhole)
                }

                time += element.sounding * secondsPerWhole
            }

            return Schedule(events, sounds, time)
        }
    }
}

/** Stops when the screen's sound is interrupted or the screen closes. */
@Composable
fun rememberNotationPlayback(audio: MusicAudio): NotationPlayback {
    val playback = remember(audio) { NotationPlayback(audio) }

    DisposableEffect(playback) {
        audio.onInterruption = playback::stop
        onDispose { playback.stop() }
    }

    LaunchedEffect(playback, playback.isPlaying) { playback.follow() }

    return playback
}
