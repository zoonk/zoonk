package com.zoonk.android.feature.activities.music

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk

/** Main's `NoteMark`: a note's name in a circle, filled while answering and outlined once it's right, wrong or missed. */
@Composable
internal fun NoteMark(
    kind: NoteMarkKind,
    label: String,
    modifier: Modifier = Modifier,
) {
    val colors = MaterialTheme.colorScheme
    val accent = MaterialTheme.zoonk.vizAccent
    val (fill, text, border) =
        when (kind) {
            NoteMarkKind.Correct -> Triple(colors.tertiary, colors.onTertiary, null)
            NoteMarkKind.Heard, NoteMarkKind.New -> Triple(accent, colors.surface, null)
            NoteMarkKind.Kept -> Triple(colors.onSurface, colors.surface, null)
            NoteMarkKind.Missed -> Triple(colors.surface, colors.tertiary, colors.tertiary)
            NoteMarkKind.Removed -> Triple(colors.surface, colors.onSurfaceVariant, colors.onSurfaceVariant)
            NoteMarkKind.Wrong -> Triple(colors.surface, colors.error, colors.error)
        }
    val isDashed = kind == NoteMarkKind.Missed || kind == NoteMarkKind.Removed
    val size = with(LocalDensity.current) { MARK_SIZE.toDp() }

    Box(
        modifier.size(size).drawBehind {
            drawCircle(fill)
            border?.let { drawMarkBorder(it, isDashed) }
        },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = text,
            style =
                MaterialTheme.typography.labelMedium
                    .copy(fontWeight = FontWeight.SemiBold)
                    .withTabularFigures(),
            maxLines = 1,
            overflow = TextOverflow.Clip,
        )
    }
}

private fun DrawScope.drawMarkBorder(
    color: Color,
    isDashed: Boolean,
) {
    val width = 2.dp.toPx()
    val dash = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 2.dp.toPx())).takeIf { isDashed }
    drawCircle(color, radius = size.minDimension / 2 - width / 2, style = Stroke(width, pathEffect = dash))
}

/** Main's `ActivitySoundButton`: plays a sound, named by what it plays. */
@Composable
internal fun MusicSoundButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
    ) {
        Icon(painterResource(R.drawable.ic_volume_up), contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
        Text(text, Modifier.padding(start = ButtonDefaults.IconSpacing))
    }
}

/** Says when the sound couldn't start, so silence isn't mistaken for a broken key. */
@Composable
internal fun MusicSoundNote(
    audio: MusicAudio,
    modifier: Modifier = Modifier,
) {
    if (audio.isUnavailable) {
        Text(
            stringResource(R.string.activities_music_sound_unavailable),
            modifier.semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

/**
 * Main's `useRovingFocus`: a row of controls is one Tab stop, at its [active] item; the arrows, Home and End move along it
 * (calling `onMove`) and never reach the lesson, whose arrows change screens.
 */
@Stable
internal class RovingFocus(
    private val count: Int,
    initial: Int,
) {
    var active by mutableIntStateOf(initial)
    private val requesters = List(count) { FocusRequester() }

    fun item(
        index: Int,
        onMove: (Int) -> Unit = {},
    ): Modifier =
        Modifier
            .focusRequester(requesters[index])
            .focusProperties { canFocus = index == active }
            .onFocusChanged { if (it.isFocused) active = index }
            .onPreviewKeyEvent { event ->
                val target =
                    when (event.key) {
                        Key.DirectionLeft, Key.DirectionUp -> index - 1
                        Key.DirectionRight, Key.DirectionDown -> index + 1
                        Key.MoveHome -> 0
                        Key.MoveEnd -> count - 1
                        else -> return@onPreviewKeyEvent false
                    }.coerceIn(0, count - 1)

                if (event.type == KeyEventType.KeyDown && target != index) {
                    active = target
                    requesters[target].requestFocus()
                    onMove(target)
                }
                true
            }
}

@Composable
internal fun rememberRovingFocus(
    count: Int,
    initial: Int = 0,
): RovingFocus = remember(count) { RovingFocus(count, initial.coerceIn(0, count - 1)) }

private val MARK_SIZE = 28.sp
