package com.zoonk.android.feature.activities

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitLongPressOrCancellation
import androidx.compose.foundation.gestures.awaitTouchSlopOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.graphics.layer.setOutline
import androidx.compose.ui.graphics.rememberGraphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.changedToUpIgnoreConsumed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.toSize

/**
 * Main's `ActivityDragDrop`: pieces dragged onto targets. Dragging is one path of three: each
 * template also places a picked piece with a tap on its target, and each piece offers TalkBack one
 * action per target.
 */
@Stable
class ActivityDragDropState internal constructor(
    internal val layer: GraphicsLayer,
    private val haptics: HapticFeedback,
) {
    internal var onDrop: (itemId: String, targetId: String) -> Unit = { _, _ -> }
    private val pieces = HashMap<String, LayoutCoordinates>()
    private val targets = HashMap<String, LayoutCoordinates>()
    internal var origin = Offset.Zero
    internal var lifted by mutableStateOf<LiftedPiece?>(null)
        private set

    var overId by mutableStateOf<String?>(null)
        private set

    fun isLifted(id: String): Boolean = lifted?.id == id

    internal fun place(
        id: String,
        coordinates: LayoutCoordinates,
    ) {
        pieces[id] = coordinates
    }

    internal fun target(
        id: String,
        coordinates: LayoutCoordinates?,
    ) {
        if (coordinates == null) targets.remove(id) else targets[id] = coordinates
    }

    internal fun rootOf(
        id: String,
        local: Offset,
    ): Offset = (pieces[id]?.takeIf { it.isAttached }?.positionInRoot() ?: Offset.Zero) + local

    internal fun lift(
        id: String,
        pointer: Offset,
    ) {
        val piece = pieces[id]?.takeIf { it.isAttached } ?: return
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        lifted = LiftedPiece(id, Rect(piece.positionInRoot(), piece.size.toSize()), pointer)
        move(pointer)
    }

    internal fun move(pointer: Offset) {
        val piece = lifted ?: return
        piece.pointer = pointer
        overId = targetUnder(pointer, piece.bounds.translate(pointer - piece.grab))
    }

    internal fun end(drops: Boolean) {
        val piece = lifted ?: return
        val target = overId
        lifted = null
        overId = null
        if (drops && target != null) onDrop(piece.id, target)
    }

    /** dnd-kit's `pointerWithin`, then `rectIntersection`: the target under the pointer, else the one the piece covers most. */
    private fun targetUnder(
        pointer: Offset,
        piece: Rect,
    ): String? {
        val bounds = targets.filterValues { it.isAttached }.mapValues { it.value.boundsInRoot() }
        return bounds.entries.firstOrNull { it.value.contains(pointer) }?.key
            ?: bounds
                .mapValues { it.value.intersect(piece) }
                .filterValues { it.width > 0 && it.height > 0 }
                .maxByOrNull { it.value.width * it.value.height }
                ?.key
    }
}

internal class LiftedPiece(
    val id: String,
    val bounds: Rect,
    val grab: Offset,
) {
    var pointer by mutableStateOf(grab)
}

@Composable
fun rememberActivityDragDrop(onDrop: (itemId: String, targetId: String) -> Unit): ActivityDragDropState {
    val layer = rememberGraphicsLayer()
    val haptics = LocalHapticFeedback.current
    val latest by rememberUpdatedState(onDrop)
    return remember(layer, haptics) {
        ActivityDragDropState(layer, haptics).apply {
            this.onDrop = {
                item,
                target,
                ->
                latest(item, target)
            }
        }
    }
}

/** Draws the lifted piece above everything inside it, wherever the pointer takes it. */
@Composable
fun ActivityDragDrop(
    state: ActivityDragDropState,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier
            .onGloballyPositioned { state.origin = it.positionInRoot() }
            .drawWithContent {
                drawContent()
                val piece = state.lifted ?: return@drawWithContent
                val at = piece.bounds.topLeft + (piece.pointer - piece.grab) - state.origin
                translate(at.x, at.y) { drawLayer(state.layer) }
            },
    ) { content() }
}

/**
 * A piece the learner can lift onto a target. TalkBack gets [actions], each a label and the target
 * it drops the piece on ("Put Melting ice in Same substance").
 */
fun Modifier.activityDraggable(
    state: ActivityDragDropState,
    id: String,
    enabled: Boolean = true,
    shape: Shape = RoundedCornerShape(12.dp),
    actions: List<Pair<String, String>> = emptyList(),
): Modifier {
    if (!enabled) return this
    return semantics {
        customActions = actions.map { (label, target) -> CustomAccessibilityAction(label) { true.also { state.onDrop(id, target) } } }
    }.onGloballyPositioned { state.place(id, it) }
        .pointerInput(state, id) {
            detectLift(
                onLift = { state.lift(id, state.rootOf(id, it)) },
                onMove = { state.move(state.rootOf(id, it)) },
                onEnd = state::end,
            )
        }.drawWithContent {
            if (state.isLifted(id)) {
                state.layer.setOutline(shape.createOutline(size, layoutDirection, this))
                state.layer.shadowElevation = LIFTED_ELEVATION.toPx()
                state.layer.record { this@drawWithContent.drawContent() }
            } else {
                drawContent()
            }
        }
}

/** A place a piece can be dropped on; [ActivityDragDropState.overId] says which one a piece is held over. */
fun Modifier.activityDropTarget(
    state: ActivityDragDropState,
    id: String,
    enabled: Boolean = true,
): Modifier = onGloballyPositioned { state.target(id, it.takeIf { enabled }) }

/**
 * A finger holds to lift, so a quick swipe still scrolls the lesson; a mouse lifts once it moves.
 * Once lifted, the pointer is followed in the first pass, so neither the piece's own tap nor the
 * lesson's scroll sees it. A touch the system takes back (its back gesture at the screen's edge)
 * arrives already consumed and ends without a drop.
 */
internal suspend fun PointerInputScope.detectLift(
    onLift: (Offset) -> Unit,
    onMove: (Offset) -> Unit,
    onEnd: (drops: Boolean) -> Unit,
) = awaitEachGesture {
    val down = awaitFirstDown(requireUnconsumed = false)
    val start =
        if (down.type == PointerType.Mouse) {
            awaitTouchSlopOrCancellation(down.id) { change, _ -> change.consume() }
        } else {
            awaitLongPressOrCancellation(down.id)
        } ?: return@awaitEachGesture
    onLift(start.position)
    var drops = false
    try {
        while (true) {
            val change = awaitPointerEvent(PointerEventPass.Initial).changes.firstOrNull { it.id == start.id } ?: break
            if (change.changedToUpIgnoreConsumed()) {
                drops = !change.isConsumed
                change.consume()
                break
            }
            onMove(change.position)
            change.consume()
        }
    } finally {
        onEnd(drops)
    }
}

internal val LIFTED_ELEVATION = 8.dp
