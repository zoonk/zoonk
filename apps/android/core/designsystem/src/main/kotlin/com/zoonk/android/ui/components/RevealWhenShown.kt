package com.zoonk.android.ui.components

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** Whether the screen brings its own feedback into view, as the lesson player does to keep its question in sight too. */
val LocalOwnFeedbackReveal = staticCompositionLocalOf { false }

/**
 * A page a [revealWhenShown] scrolls by main's rule ([reveal]): its [scroll], the box it shows ([revealPage]) and the
 * parts a reveal never leaves as a sliver at its top ([keptWhole]).
 */
@Stable
class RevealPage(
    val scroll: ScrollState,
) {
    internal var viewport: LayoutCoordinates? = null
    internal val parts = mutableSetOf<KeptPart>()

    /** Room the page adds under its content while a reveal needs more scroll than the content gives. */
    var extraRoom by mutableFloatStateOf(0f)
        internal set
}

internal class KeptPart {
    var coordinates: LayoutCoordinates? = null
}

/** The [RevealPage] of the page around; null where a reveal brings itself into view the least it can. */
val LocalRevealPage = staticCompositionLocalOf<RevealPage?> { null }

/** The box [page] shows, the scrolling container's own. */
fun Modifier.revealPage(page: RevealPage): Modifier = onGloballyPositioned { page.viewport = it }

/** A part a reveal scrolls away whole or not at all: a question's title, its answers, a match board's cards. */
@Composable
fun Modifier.keptWhole(): Modifier {
    val page = LocalRevealPage.current ?: return this
    val part = remember { KeptPart() }
    DisposableEffect(page) {
        page.parts += part
        onDispose { page.parts -= part }
    }
    return onGloballyPositioned { part.coordinates = it }
}

/**
 * Main's `RevealWhenShown`: once this shows, and again for each new [key], the page scrolls it into sight: the whole of
 * it with a gap under it, never past its own top, and what scrolls away at the top goes whole, never as a sliver
 * ([reveal]). It stays put when it's already in sight, and the system's animation setting decides whether the
 * scroll animates. Outside a [RevealPage], it scrolls the least it takes to show it whole.
 */
@Composable
fun Modifier.revealWhenShown(key: Any? = Unit): Modifier {
    val inView = remember { BringIntoViewRequester() }
    val size = remember { mutableStateOf(IntSize.Zero) }
    val placed = remember { mutableStateOf<LayoutCoordinates?>(null) }
    val page = LocalRevealPage.current
    val room = with(LocalDensity.current) { REVEAL_ROOM.toPx() }
    LaunchedEffect(key) {
        // A frame later, so what it shows with (the board laid out again, the bar's new action) is in place.
        withFrameNanos {}
        val reveal = page?.let { placed.value?.let { shown -> it.reveal(shown, room) } }
        if (page == null || reveal == null) {
            inView.bringIntoView(Rect(0f, 0f, size.value.width.toFloat(), size.value.height + room))
        } else if (reveal.delta != 0f) {
            if (reveal.extraRoom > 0f) {
                page.extraRoom = reveal.extraRoom
                withFrameNanos {}
            }
            page.scroll.animateScrollBy(reveal.delta)
        }
    }
    if (page != null) DisposableEffect(page) { onDispose { page.extraRoom = 0f } }
    return bringIntoViewRequester(inView).onSizeChanged { size.value = it }.onGloballyPositioned { placed.value = it }
}

private fun RevealPage.reveal(
    shown: LayoutCoordinates,
    margin: Float,
): Reveal? {
    val view = viewport?.takeIf { it.isAttached && shown.isAttached } ?: return null
    val span = { coordinates: LayoutCoordinates ->
        view.localBoundingBoxOf(coordinates, clipBounds = false).let { RevealSpan(it.top, it.bottom) }
    }
    val feedback = span(shown)
    val kept =
        parts
            .mapNotNull { part -> part.coordinates?.takeIf { it.isAttached } }
            .map(span)
            .filter { it.bottom > it.top && !(it.top >= feedback.top && it.bottom <= feedback.bottom) }
    return reveal(
        feedback,
        kept,
        RevealSpan(0f, view.size.height.toFloat()),
        (scroll.maxValue - scroll.value).toFloat() - extraRoom,
        margin,
    )
}

/** Where something sits on a page, top to bottom. */
data class RevealSpan(
    val top: Float,
    val bottom: Float,
)

/** How far a reveal scrolls, and the room the page first adds under its content where it can't scroll that far. */
data class Reveal(
    val delta: Float,
    val extraRoom: Float,
)

/**
 * Main's `getReveal`: how far a page scrolls so [feedback] is in sight in [visible]: until the whole of it shows with a
 * [margin] under it, and never past its own top. What scrolls away leaves whole: a [kept] part the scroll would cut is
 * scrolled out. Where the page can't scroll that far ([room]), the part stays whole in sight if the whole feedback still
 * shows; otherwise the page gets the room it lacks under the feedback.
 */
fun reveal(
    feedback: RevealSpan,
    kept: List<RevealSpan>,
    visible: RevealSpan,
    room: Float,
    margin: Float,
): Reveal {
    val whole = wholeDelta(feedback, visible, margin)
    val cuts =
        kept
            .map { RevealSpan(floor(it.top - visible.top), ceil(it.bottom - visible.top)) }
            .sortedBy { it.top }
            .fold(mutableListOf<RevealSpan>()) { merged, part ->
                val last = merged.lastOrNull()
                if (last != null && part.top < last.bottom) {
                    merged[merged.lastIndex] = last.copy(bottom = max(last.bottom, part.bottom))
                } else {
                    merged += part
                }
                merged
            }
    val cut = cuts.firstOrNull { whole > it.top && whole < it.bottom } ?: return Reveal(whole, max(0f, whole - room))
    val delta = if (cut.bottom > room && feedback.bottom - visible.bottom <= cut.top) cut.top else cut.bottom
    return Reveal(delta, max(0f, delta - room))
}

private fun wholeDelta(
    feedback: RevealSpan,
    visible: RevealSpan,
    margin: Float,
): Float {
    if (feedback.top < visible.top) return feedback.top - visible.top - margin
    if (feedback.bottom <= visible.bottom) return 0f
    val toBottom = feedback.bottom - visible.bottom
    val toTop = feedback.top - visible.top
    if (toBottom > toTop) return toTop - margin
    return min(toBottom + margin, max(toTop - margin, toBottom))
}

private val REVEAL_ROOM = 16.dp
