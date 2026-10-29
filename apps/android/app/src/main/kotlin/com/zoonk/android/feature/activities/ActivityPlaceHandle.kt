package com.zoonk.android.feature.activities

import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerIcon
import androidx.compose.ui.input.pointer.pointerHoverIcon
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.components.LinearScale
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

enum class PlaceOrientation { Horizontal, Vertical }

/**
 * Main's `ActivityPlaceHandle`: something the learner places along one axis of a plot, centered on
 * [center] in the plot's pixels, where [scale] turns that axis's pixels into values. Lay it over the
 * plot in a box of the same size. It owns a 48dp target that takes a drag, the arrow, Page and
 * Home/End keys and TalkBack's adjust actions, snapping to [range]; the caller draws the [knob].
 */
@Composable
fun ActivityPlaceHandle(
    center: Offset,
    scale: LinearScale,
    range: SnapRange,
    value: Double,
    label: String,
    valueText: String,
    onChange: (Double) -> Unit,
    modifier: Modifier = Modifier,
    orientation: PlaceOrientation = PlaceOrientation.Horizontal,
    disabled: Boolean = false,
    knob: @Composable () -> Unit,
) {
    val half = with(LocalDensity.current) { HIT.toPx() / 2 }
    val bounds = Rect(center - Offset(half, half), Size(half * 2, half * 2))
    val place by rememberUpdatedState { at: Offset -> onChange(snapToStep(scale.toValue((bounds.topLeft + at).along(orientation)), range)) }
    var focused by remember { mutableStateOf(false) }
    val ring = MaterialTheme.colorScheme.primary

    Box(
        modifier
            .inPlot(bounds)
            .semantics {
                contentDescription = label
                stateDescription = valueText
                progressBarRangeInfo = rangeInfo(value, range)
                if (disabled) {
                    disabled()
                } else {
                    setProgress { target ->
                        onChange(snapToStep(target.toDouble(), range))
                        true
                    }
                }
            }.then(
                if (disabled) {
                    Modifier
                } else {
                    Modifier
                        .pointerHoverIcon(PointerIcon.Hand)
                        .pointerInput(Unit) {
                            awaitEachGesture {
                                val down = awaitFirstDown()
                                down.consume()
                                place(down.position)
                                drag(down.id) { change ->
                                    change.consume()
                                    place(change.position)
                                }
                            }
                        }.onFocusChanged { focused = it.isFocused }
                        .onKeyEvent { event ->
                            val key = if (growsDownward(orientation, scale)) flipVerticalKey(event.key) else event.key
                            val next = if (event.type == KeyEventType.KeyDown) valueAfterKey(key, value, range) else null
                            next?.let(onChange)
                            next != null
                        }.focusable()
                },
            ).drawBehind { if (focused && !disabled) drawCircle(ring, FOCUS_RADIUS.toPx(), style = Stroke(FOCUS_STROKE.toPx())) },
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.wrapContentSize(unbounded = true).clearAndSetSemantics {}) { knob() }
    }
}

/**
 * Main's `usePlacePointer` on a track: a tap in [area] (the plot's pixels) places the value there,
 * and a drag along [orientation] moves it, so a drag across the track still scrolls the page.
 */
@Composable
fun ActivityPlaceTrack(
    area: Rect,
    scale: LinearScale,
    range: SnapRange,
    onChange: (Double) -> Unit,
    orientation: PlaceOrientation = PlaceOrientation.Horizontal,
    disabled: Boolean = false,
) {
    if (disabled) return
    val place by rememberUpdatedState { at: Offset -> onChange(snapToStep(scale.toValue((area.topLeft + at).along(orientation)), range)) }

    Box(
        Modifier
            .inPlot(area)
            .pointerHoverIcon(PointerIcon.Hand)
            .pointerInput(orientation) {
                coroutineScope {
                    launch { detectTapGestures { place(it) } }
                    launch {
                        when (orientation) {
                            PlaceOrientation.Horizontal -> {
                                detectHorizontalDragGestures(onDragStart = { place(it) }) { change, _ ->
                                    change.consume()
                                    place(change.position)
                                }
                            }

                            PlaceOrientation.Vertical -> {
                                detectVerticalDragGestures(onDragStart = { place(it) }) { change, _ ->
                                    change.consume()
                                    place(change.position)
                                }
                            }
                        }
                    }
                }
            },
    )
}

/** Fills the plot it's laid over and puts what follows at [bounds], in the plot's pixels, in either layout direction. */
private fun Modifier.inPlot(bounds: Rect) =
    layout { measurable, constraints ->
        val placeable = measurable.measure(Constraints.fixed(bounds.width.roundToInt(), bounds.height.roundToInt()))
        layout(constraints.maxWidth, constraints.maxHeight) { placeable.place(bounds.left.roundToInt(), bounds.top.roundToInt()) }
    }

private fun Offset.along(orientation: PlaceOrientation): Float = if (orientation == PlaceOrientation.Horizontal) x else y

/** TalkBack's adjust actions move one [SnapRange.step] at a time. */
private fun rangeInfo(
    value: Double,
    range: SnapRange,
) = ProgressBarRangeInfo(
    current = value.toFloat(),
    range = range.min.toFloat()..range.max.toFloat(),
    steps = (((range.max - range.min) / range.step).roundToInt() - 1).coerceAtLeast(0),
)

/** A vertical axis whose values grow downward keeps Up meaning up on the screen. */
internal fun growsDownward(
    orientation: PlaceOrientation,
    scale: LinearScale,
): Boolean =
    orientation == PlaceOrientation.Vertical &&
        (scale.range.second > scale.range.first) == (scale.domain.endInclusive > scale.domain.start)

internal fun flipVerticalKey(key: Key): Key =
    when (key) {
        Key.DirectionUp -> Key.DirectionDown
        Key.DirectionDown -> Key.DirectionUp
        else -> key
    }

private val HIT = 48.dp
private val FOCUS_RADIUS = 17.dp
private val FOCUS_STROKE = 3.dp
