package com.zoonk.android.feature.activities

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import kotlin.math.roundToInt

/**
 * Main's `ActivitySlider`: a named value with its live reading above the track and [scale] (its ends
 * or its stops) under it. It moves in whole steps of [range] by drag, tap, arrow keys and TalkBack,
 * which reads [valueText].
 */
@Composable
fun ActivitySlider(
    label: String,
    range: SnapRange,
    value: Double,
    valueLabel: String,
    valueText: String,
    onValueChange: (Double) -> Unit,
    modifier: Modifier = Modifier,
    disabled: Boolean = false,
    scale: @Composable () -> Unit = {},
) {
    Column(modifier) {
        Row(Modifier.fillMaxWidth().clearAndSetSemantics {}, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                label,
                Modifier.weight(1f).alignByBaseline(),
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
            )
            Text(
                valueLabel,
                Modifier.alignByBaseline(),
                style =
                    MaterialTheme.typography.bodyMedium
                        .withTabularFigures()
                        .copy(fontWeight = FontWeight.SemiBold),
            )
        }
        ActivitySliderTrack(
            position = sliderStop(value, range),
            positions = sliderStops(range),
            enabled = !disabled,
            fill = MaterialTheme.zoonk.vizAccent,
            modifier =
                Modifier
                    .alpha(if (disabled) DISABLED_ALPHA else 1f)
                    .semantics {
                        contentDescription = label
                        stateDescription = valueText
                    },
            onPositionChange = { onValueChange(sliderValue(it, range)) },
        )
        Box(Modifier.clearAndSetSemantics {}) { scale() }
    }
}

/**
 * The kit's one slider look: Material's slider over whole positions, filled up to the thumb with
 * [fill] for an amount, or unfilled for a place, with [marks] drawn over the track.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ActivitySliderTrack(
    position: Int,
    positions: Int,
    enabled: Boolean,
    modifier: Modifier,
    onPositionChange: (Int) -> Unit,
    fill: Color? = null,
    marks: DrawScope.() -> Unit = {},
) {
    val track = MaterialTheme.colorScheme.surfaceContainerHigh
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val colors =
        SliderDefaults.colors(
            activeTrackColor = fill ?: track,
            inactiveTrackColor = track,
            disabledThumbColor = SliderDefaults.colors().thumbColor,
            disabledActiveTrackColor = fill ?: track,
            disabledInactiveTrackColor = track,
        )

    Slider(
        value = position.toFloat(),
        onValueChange = { onPositionChange(it.roundToInt()) },
        modifier = modifier.fillMaxWidth().then(if (positions == 1 && enabled) Modifier.betweenTwoStops(position, rtl, onPositionChange) else Modifier),
        enabled = enabled,
        valueRange = 0f..positions.toFloat(),
        steps = (positions - 1).coerceAtLeast(0),
        colors = colors,
        track = { state ->
            Box {
                SliderDefaults.Track(state, enabled = enabled, colors = colors, drawStopIndicator = null, drawTick = { _, _ -> })
                Canvas(Modifier.matchParentSize(), onDraw = marks)
            }
        },
    )
}

/**
 * With two stops Material's slider has no steps, so its keys move a hundredth of the way and
 * TalkBack a twentieth, which round back to the same stop; here each move goes to the other one.
 */
private fun Modifier.betweenTwoStops(
    position: Int,
    rtl: Boolean,
    onPositionChange: (Int) -> Unit,
) = onPreviewKeyEvent { event ->
    val key =
        when {
            !rtl -> event.key
            event.key == Key.DirectionLeft -> Key.DirectionRight
            event.key == Key.DirectionRight -> Key.DirectionLeft
            else -> event.key
        }
    val next = valueAfterKey(key, position.toDouble(), TWO_STOPS)
    if (next != null && event.type == KeyEventType.KeyDown) onPositionChange(next.toInt())
    next != null
}.semantics {
    setProgress { target ->
        onPositionChange(
            when {
                target > position -> 1
                target < position -> 0
                else -> position
            },
        )
        true
    }
}

private val TWO_STOPS = SnapRange(0.0, 1.0, 1.0)
private const val DISABLED_ALPHA = 0.6f
