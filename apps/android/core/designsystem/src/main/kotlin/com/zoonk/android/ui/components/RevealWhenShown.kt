package com.zoonk.android.ui.components

import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp

/** Whether the screen brings its own feedback into view, as the lesson player does to keep its question in sight too. */
val LocalOwnFeedbackReveal = staticCompositionLocalOf { false }

/**
 * Main's `RevealWhenShown`: once this shows, and again for each new [key], the page scrolls the least it takes to show
 * it whole with a gap under it, so it's seen even below the fold or under the bar. It stays put when it's already in
 * sight, and the system's animation setting decides whether the scroll animates.
 */
@Composable
fun Modifier.revealWhenShown(key: Any? = Unit): Modifier {
    val inView = remember { BringIntoViewRequester() }
    val size = remember { mutableStateOf(IntSize.Zero) }
    val room = with(LocalDensity.current) { REVEAL_ROOM.toPx() }
    LaunchedEffect(key) {
        // A frame later, so what it shows with (the board laid out again, the bar's new action) is in place.
        withFrameNanos {}
        inView.bringIntoView(Rect(0f, 0f, size.value.width.toFloat(), size.value.height + room))
    }
    return bringIntoViewRequester(inView).onSizeChanged { size.value = it }
}

private val REVEAL_ROOM = 16.dp
