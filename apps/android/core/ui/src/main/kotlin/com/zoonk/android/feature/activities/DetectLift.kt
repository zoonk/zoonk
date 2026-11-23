package com.zoonk.android.feature.activities

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitLongPressOrCancellation
import androidx.compose.foundation.gestures.awaitTouchSlopOrCancellation
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.changedToUpIgnoreConsumed
import androidx.compose.ui.unit.dp

/**
 * A finger holds to lift, so a quick swipe still scrolls the lesson; a mouse lifts once it moves.
 * Once lifted, the pointer is followed in the first pass, so neither the piece's own tap nor the
 * lesson's scroll sees it. A touch the system takes back (its back gesture at the screen's edge)
 * arrives already consumed and ends without a drop.
 */
suspend fun PointerInputScope.detectLift(
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

val LIFTED_ELEVATION = 8.dp
