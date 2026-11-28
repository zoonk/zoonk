package com.zoonk.android.feature.audio

import android.provider.Settings
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.ui.draw.alpha
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

// TalkBack speech during recording would be captured in the take.
@Composable
fun SpeakCue(
    status: VoiceRecorder.Status,
    checking: Boolean,
    levels: () -> List<Float>,
    modifier: Modifier = Modifier,
) {
    val recording = status as? VoiceRecorder.Status.Recording
    val acquiring = status == VoiceRecorder.Status.Acquiring
    val live = recording != null
    val still = animationsOff()
    LiveTap(recording?.startedAt)

    Box(
        modifier.fillMaxWidth().heightIn(min = TRACK_HEIGHT).clearAndSetSemantics {},
        contentAlignment = Alignment.CenterStart,
    ) {
        CueLabel(
            stringResource(R.string.audio_say_when_cue_appears),
            MaterialTheme.colorScheme.onSurfaceVariant,
            visible = !live && !acquiring && !checking,
        )
        CueTrack(
            stringResource(R.string.audio_microphone_getting_ready),
            MaterialTheme.colorScheme.onSurfaceVariant,
            MaterialTheme.colorScheme.outlineVariant,
            visible = acquiring,
        ) { emptyList() }
        CueTrack(
            stringResource(R.string.audio_speak_now),
            MaterialTheme.colorScheme.onSurface,
            MaterialTheme.colorScheme.onSurface,
            visible = live,
            weight = FontWeight.Medium,
            still = still,
        ) { if (live) levels() else emptyList() }
    }
}

@Composable
private fun CueTrack(
    label: String,
    labelColor: Color,
    trackColor: Color,
    visible: Boolean,
    weight: FontWeight? = null,
    still: Boolean = false,
    levels: () -> List<Float>,
) {
    Row(
        modifier = Modifier.fillMaxWidth().alpha(if (visible) 1f else 0f),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CueLabel(label, labelColor, visible, weight)
        Track(trackColor, still, levels)
    }
}

@Composable
private fun CueLabel(
    text: String,
    color: Color,
    visible: Boolean,
    weight: FontWeight? = null,
) {
    val modifier = if (visible) Modifier else Modifier.alpha(0f).clearAndSetSemantics {}
    Text(text, modifier = modifier, color = color, fontWeight = weight, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun RowScope.Track(
    color: Color,
    still: Boolean,
    levels: () -> List<Float>,
) {
    Canvas(Modifier.weight(1f).height(TRACK_HEIGHT)) {
        val bar = BAR_WIDTH.toPx()
        val step = bar + BAR_GAP.toPx()
        val count = ((size.width + BAR_GAP.toPx()) / step).toInt()
        val samples = levels()
        val recent = if (still) emptyList() else samples.takeLast(count)
        val alpha = if (still && (samples.lastOrNull() ?: 0f) < SPEECH_LEVEL) 0.4f else 1f
        val quiet = count - recent.size
        for (slot in 0 until count) {
            val level = recent.getOrNull(slot - quiet) ?: 0f
            val height = (level * size.height).coerceAtLeast(bar)
            val start = slot * step
            val x = if (layoutDirection == LayoutDirection.Rtl) size.width - start - bar else start
            drawRoundRect(color, Offset(x, (size.height - height) / 2), Size(bar, height), CornerRadius(bar / 2), alpha = alpha)
        }
    }
}

// Preserve the haptic across recreation so rotation cannot replay it.
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

@Composable
private fun animationsOff(): Boolean {
    val resolver = LocalContext.current.contentResolver
    return remember(resolver) { Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }
}

private val TRACK_HEIGHT = 24.dp

private val BAR_WIDTH = 4.dp

private val BAR_GAP = 4.dp

// About -34 dBFS on the recorder's -45 to 0 dBFS peak scale, matching the web's nominal level.
private const val SPEECH_LEVEL = 0.245f
