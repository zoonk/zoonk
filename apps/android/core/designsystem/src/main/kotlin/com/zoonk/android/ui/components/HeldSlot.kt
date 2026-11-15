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
 * width it was measured at: at a width the gate never had, the slot takes its natural height.
 */
@Composable
fun HeldSlot(
    gated: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    // Per width, since a parent can measure it at two widths in one frame (a dialog does).
    val held = remember(LocalDensity.current) { mutableMapOf<Int, Int>() }
    Box(
        modifier.layout { measurable, constraints ->
            val placeable = measurable.measure(constraints.copy(minHeight = 0))
            // The room it's given, not what fills it: a lifted gate's content can be narrower than the gate was.
            val width = constraints.maxWidth
            // The tallest it has been at this width: its line can go a moment before the gate does.
            if (gated) held[width] = maxOf(held[width] ?: 0, placeable.height)
            val height = maxOf(placeable.height, held[width] ?: 0).coerceIn(constraints.minHeight, constraints.maxHeight)
            layout(placeable.width, height) { placeable.place(0, 0) }
        },
    ) { content() }
}
