package com.zoonk.android.feature.audio

import android.provider.Settings
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R

/** [SpeakCue] for [recorder]'s take; [checking] while the take is graded. */
@Composable
fun SpeakCue(
    recorder: VoiceRecorder,
    checking: Boolean,
    modifier: Modifier = Modifier,
) {
    val status by recorder.state.collectAsStateWithLifecycle()
    val levels by recorder.levels.collectAsStateWithLifecycle()
    SpeakCue(status, checking, { levels }, modifier)
}

/**
 * Main's cue row, right under what the learner says: when to start talking. Before a take it says to wait for "Speak now";
 * while the microphone opens, a pale flat track says it's getting ready; once the recorder runs, "Speak now" over a dark
 * track whose bars follow the voice ([levels], newest at the end), with one light tap. Empty while the take is [checking].
 * It keeps one height through all of them, so nothing under it moves.
 *
 * TalkBack doesn't read it: speech at "Speak now" would land in the take, and Record turning into Stop already says it.
 */
@Composable
fun SpeakCue(
    status: VoiceRecorder.Status,
    checking: Boolean,
    levels: () -> List<Float>,
    modifier: Modifier = Modifier,
) {
    val recording = status as? VoiceRecorder.Status.Recording
    LiveTap(recording?.startedAt)

    Row(
        modifier.fillMaxWidth().heightIn(min = TRACK_HEIGHT).clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when {
            recording != null -> {
                CueLabel(stringResource(R.string.audio_speak_now), MaterialTheme.colorScheme.onSurface, FontWeight.Medium)
                val still = animationsOff()
                Track(MaterialTheme.colorScheme.onSurface, if (still) ({ emptyList() }) else levels)
            }

            status == VoiceRecorder.Status.Acquiring -> {
                CueLabel(stringResource(R.string.audio_microphone_getting_ready), MaterialTheme.colorScheme.onSurfaceVariant)
                Track(MaterialTheme.colorScheme.outlineVariant) { emptyList() }
            }

            !checking -> {
                CueLabel(stringResource(R.string.audio_say_after_cue), MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun CueLabel(
    text: String,
    color: Color,
    weight: FontWeight? = null,
) {
    Text(text, color = color, fontWeight = weight, style = MaterialTheme.typography.bodyMedium)
}

/** As many bars as fit, each a dot at rest and as tall as the row at full voice; quiet slots before the first sample. */
@Composable
private fun RowScope.Track(
    color: Color,
    levels: () -> List<Float>,
) {
    Canvas(Modifier.weight(1f).height(TRACK_HEIGHT)) {
        val bar = BAR_WIDTH.toPx()
        val step = bar + BAR_GAP.toPx()
        val count = ((size.width + BAR_GAP.toPx()) / step).toInt()
        val recent = levels().takeLast(count)
        val quiet = count - recent.size
        for (slot in 0 until count) {
            val level = recent.getOrNull(slot - quiet) ?: 0f
            val height = (level * size.height).coerceAtLeast(bar)
            val start = slot * step
            val x = if (layoutDirection == LayoutDirection.Rtl) size.width - start - bar else start
            drawRoundRect(color, Offset(x, (size.height - height) / 2), Size(bar, height), CornerRadius(bar / 2))
        }
    }
}

/** One light tap when a take goes live, kept through a recreation so a turned phone doesn't tap again. */
@Composable
private fun LiveTap(startedAt: Long?) {
    val haptics = LocalHapticFeedback.current
    var tapped by rememberSaveable { mutableLongStateOf(0L) }
    LaunchedEffect(startedAt) {
        if (startedAt == null || startedAt == tapped) return@LaunchedEffect
        tapped = startedAt
        haptics.performHapticFeedback(HapticFeedbackType.ContextClick)
    }
}

/** Animations turned off for the device: the bars hold still, while pale and dark still say getting ready and live. */
@Composable
private fun animationsOff(): Boolean {
    val resolver = LocalContext.current.contentResolver
    return remember(resolver) { Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }
}

private val TRACK_HEIGHT = 24.dp

private val BAR_WIDTH = 4.dp

private val BAR_GAP = 4.dp
