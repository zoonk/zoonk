package com.zoonk.android.feature.player

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.sin
import kotlin.time.Duration.Companion.milliseconds

/** Main's lesson chimes, synthesized: two notes for a right answer, a rising three for the end. */
enum class LessonChime(
    val notes: List<Double>,
) {
    Correct(listOf(E5, A5)),
    Finish(listOf(C5, E5, G5)),
}

private const val C5 = 523.25
private const val E5 = 659.25
private const val G5 = 783.99
private const val A5 = 880.0
private const val SAMPLE_RATE = 44_100
private const val NOTE_SECONDS = 0.12
private const val ATTACK_SECONDS = 0.03
private const val PEAK_GAIN = 0.12
private const val SILENT_GAIN = 0.0001

/** The notes as 16-bit samples, each a sine rising fast and fading exponentially, as main's oscillators do. */
internal fun chimeSamples(chime: LessonChime): ShortArray {
    val noteLength = NOTE_SECONDS * 2
    val total = ((chime.notes.size - 1) * NOTE_SECONDS + noteLength) * SAMPLE_RATE
    val samples = DoubleArray(total.toInt())

    chime.notes.forEachIndexed { index, frequency ->
        val start = (index * NOTE_SECONDS * SAMPLE_RATE).toInt()
        val length = (noteLength * SAMPLE_RATE).toInt()

        for (i in 0 until length) {
            val time = i.toDouble() / SAMPLE_RATE
            val gain =
                if (time < ATTACK_SECONDS) {
                    SILENT_GAIN * exp(ln(PEAK_GAIN / SILENT_GAIN) * time / ATTACK_SECONDS)
                } else {
                    PEAK_GAIN * exp(ln(SILENT_GAIN / PEAK_GAIN) * (time - ATTACK_SECONDS) / (noteLength - ATTACK_SECONDS))
                }
            samples[start + i] += gain * sin(2 * PI * frequency * time)
        }
    }

    return ShortArray(samples.size) { (samples[it].coerceIn(-1.0, 1.0) * Short.MAX_VALUE).toInt().toShort() }
}

private suspend fun play(chime: LessonChime) =
    withContext(Dispatchers.Default) {
        val samples = chimeSamples(chime)
        val track =
            AudioTrack
                .Builder()
                .setAudioAttributes(
                    AudioAttributes
                        .Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                ).setAudioFormat(
                    AudioFormat
                        .Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(SAMPLE_RATE)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build(),
                ).setTransferMode(AudioTrack.MODE_STATIC)
                .setBufferSizeInBytes(samples.size * 2)
                .build()

        try {
            track.write(samples, 0, samples.size)
            track.play()
            delay((samples.size * 1000L / SAMPLE_RATE).milliseconds)
        } finally {
            track.release()
        }
    }

/**
 * A chime when a check comes back right and when the lesson ends, never while the learner goes
 * back to review a screen, and none with the sounds setting off.
 */
@Composable
fun LessonSounds(
    state: LessonPlayerState?,
    enabled: Boolean,
) {
    var previous by remember { mutableStateOf(state?.phase) }
    val phase = state?.phase
    val stepId = state?.currentStep?.id
    val isCorrect = stepId?.let { state.results[it]?.isCorrect }

    LaunchedEffect(phase) {
        val changed = previous != null && previous != phase
        previous = phase

        if (!enabled || !changed || state == null || state.reviewing) return@LaunchedEffect

        when {
            phase == LessonPhase.Completed -> play(LessonChime.Finish)
            phase == LessonPhase.Feedback && isCorrect == true -> play(LessonChime.Correct)
        }
    }
}
