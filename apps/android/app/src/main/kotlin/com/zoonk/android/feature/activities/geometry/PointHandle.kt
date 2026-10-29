package com.zoonk.android.feature.activities.geometry

import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.AbsoluteAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.SemanticsPropertyReceiver
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/**
 * Main's draggable point: a dot on a 48dp target, ringed while the keyboard focuses it. It takes
 * arrow keys through [onKey] and TalkBack's actions through [actions]; a drag reaches it through
 * the [PointDragArea] it sits in.
 */
@Composable
internal fun PointHandle(
    center: Offset,
    label: String,
    value: String,
    enabled: Boolean,
    onKey: (Key) -> Boolean,
    actions: SemanticsPropertyReceiver.() -> Unit,
) {
    val interactions = remember { MutableInteractionSource() }
    val focused by interactions.collectIsFocusedAsState()
    val ink = MaterialTheme.colorScheme.onSurface
    val ring = MaterialTheme.colorScheme.primary
    val halo = MaterialTheme.colorScheme.surface

    Box(
        Modifier
            .absoluteOffset { IntOffset((center.x - TARGET.toPx() / 2).roundToInt(), (center.y - TARGET.toPx() / 2).roundToInt()) }
            .size(TARGET)
            .semantics {
                contentDescription = label
                stateDescription = value
                if (enabled) actions() else disabled()
            }.onKeyEvent { event -> enabled && event.type == KeyEventType.KeyDown && onKey(event.key) }
            .focusable(enabled, interactions)
            .drawBehind {
                if (enabled) drawCircle(ink.copy(alpha = HIT_ALPHA))
                if (focused) drawCircle(ring, FOCUS_RADIUS.toPx(), style = Stroke(FOCUS_WIDTH.toPx()))
                drawCircle(halo, KNOB_RADIUS.toPx() + KNOB_EDGE.toPx())
                drawCircle(ink, KNOB_RADIUS.toPx())
            },
    )
}

/**
 * Where points are dragged: a press on a point (what [pick] finds at its position) moves it with
 * the finger, in this area's coordinates; a tap anywhere else goes to [onTap]. Other presses are
 * left alone, so the screen still scrolls over the drawing, and the system's back gesture keeps
 * the screen's edges.
 */
@Composable
internal fun PointDragArea(
    enabled: Boolean,
    pick: (Offset) -> Int?,
    onDrag: (index: Int, at: Offset) -> Unit,
    modifier: Modifier = Modifier,
    onTap: ((Offset) -> Unit)? = null,
    content: @Composable BoxScope.() -> Unit,
) {
    val currentPick by rememberUpdatedState(pick)
    val currentDrag by rememberUpdatedState(onDrag)
    val currentTap by rememberUpdatedState(onTap)

    Box(
        modifier.pointerInput(enabled) {
            if (!enabled) return@pointerInput
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false)
                val index = currentPick(down.position)
                if (index != null) {
                    down.consume()
                    currentDrag(index, down.position)
                    drag(down.id) { change ->
                        change.consume()
                        currentDrag(index, change.position)
                    }
                } else {
                    val tap = currentTap ?: return@awaitEachGesture
                    waitForUpOrCancellation()?.let { up ->
                        up.consume()
                        tap(up.position)
                    }
                }
            }
        },
        contentAlignment = AbsoluteAlignment.TopLeft,
        content = content,
    )
}

/** Within reach of a finger on a point drawn at [center]. */
internal fun Offset.reaches(
    center: Offset,
    density: Density,
): Boolean = (this - center).getDistance() <= with(density) { TARGET.toPx() / 2 }

private val TARGET = 48.dp
private val FOCUS_RADIUS = 17.dp
private val FOCUS_WIDTH = 3.dp
private val KNOB_RADIUS = 9.dp
private val KNOB_EDGE = 2.5.dp
private const val HIT_ALPHA = 0.1f
