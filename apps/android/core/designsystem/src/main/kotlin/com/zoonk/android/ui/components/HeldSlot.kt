package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity

/**
 * A gate that lifts by itself, with no tap, leaves its slot as tall as it was for the rest of the
 * visit, so what's below doesn't move; what replaces it sits at the top. The height belongs to the
 * width it was measured at: a width change, gated or not, starts again from the natural height.
 */
@Composable
fun HeldSlot(
    gated: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val held = remember(LocalDensity.current) { Held() }
    Box(
        modifier.layout { measurable, constraints ->
            val placeable = measurable.measure(constraints.copy(minHeight = 0))
            // The room it's given, not what fills it: a lifted gate's content can be narrower than the gate was.
            val width = constraints.maxWidth
            // The tallest it has been at this width: its line can go a moment before the gate does.
            if (gated) {
                held.height = maxOf(if (held.width == width) held.height else 0, placeable.height)
                held.width = width
            } else if (held.width != width) {
                // A lifted gate's height belonged to its width: at another, the slot takes its natural height.
                held.height = 0
            }
            val height = maxOf(placeable.height, held.height).coerceIn(constraints.minHeight, constraints.maxHeight)
            layout(placeable.width, height) { placeable.place(0, 0) }
        },
    ) { content() }
}

private class Held(
    var width: Int = 0,
    var height: Int = 0,
)
