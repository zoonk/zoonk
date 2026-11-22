package com.zoonk.android.ui.components

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

private val KEY_STEP = 48.dp
internal val FOCUS_RING = 2.dp

private fun arrowStep(
    event: KeyEvent,
    rtl: Boolean,
): Int {
    if (event.type != KeyEventType.KeyDown) return 0
    val step =
        when (event.key) {
            Key.DirectionRight -> 1
            Key.DirectionLeft -> -1
            else -> 0
        }
    return if (rtl) -step else step
}

/**
 * Lets a keyboard scroll a region that scrolls sideways with [state], as main's scrollers do: while
 * there's more to see, the region takes focus, Left and Right move it, and Home and End take it to
 * either end. Compose scrolls with touch and the mouse wheel but not keys. [onFocus] says when the
 * region holds focus, so it can draw its focus ring.
 */
@Composable
fun Modifier.arrowKeyScroll(
    state: ScrollState,
    onFocus: (Boolean) -> Unit,
): Modifier {
    val scope = rememberCoroutineScope()
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val stepPx = with(LocalDensity.current) { KEY_STEP.toPx() }

    return onFocusChanged { onFocus(it.isFocused) }
        .onKeyEvent { event ->
            val step = arrowStep(event, rtl)
            val end = endOf(event, state.maxValue)
            when {
                step != 0 -> scope.launch { state.scrollBy(step * stepPx) }
                end != null -> scope.launch { state.scrollTo(end) }
            }
            step != 0 || end != null
        }.focusable(enabled = state.maxValue > 0)
}

/** Home's or End's scroll position; a scroll's 0 is its start in either direction. */
private fun endOf(
    event: KeyEvent,
    max: Int,
): Int? =
    when {
        event.type != KeyEventType.KeyDown -> null
        event.key == Key.MoveHome -> 0
        event.key == Key.MoveEnd -> max
        else -> null
    }

@Composable
fun Modifier.focusRing(
    focused: Boolean,
    shape: Shape,
): Modifier = if (focused) border(FOCUS_RING, MaterialTheme.colorScheme.primary, shape) else this
