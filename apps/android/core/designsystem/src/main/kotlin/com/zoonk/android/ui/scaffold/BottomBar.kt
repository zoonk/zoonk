package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.app.LocalSnackbarAnchors
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.LocalButtonSize

/**
 * Main's `BottomBar`: the one home of a screen's main action, pinned to the bottom over a hairline. It
 * keeps the page's margin ([pageMargin]) at the sides of its buttons and [BAR_ROOM] over and under them at
 * every window size, clear of the system bars and the keyboard, with its lines 8dp apart and its buttons [ButtonSize.Large]; [columnWidth] keeps them
 * under a page's column, which a page whose column starts at its pane's edge or keeps another side margin says
 * with [columnAtStart] and [columnMargin], so the buttons end where the column does. A [note] (an error, a status) draws over the page
 * just above the bar, so the bar never grows and its buttons never move; [noteRoom] tells the page how tall it is, for its scrolling
 * content to end clear of it. A note taller than the room between the page's content ([barNoteViewport]) and the bar goes into the
 * page's scroll instead ([BarNoteInPage]), where it can be read whole. Its slot stays in place as a polite live region, so a new note
 * is read out. The window's snackbars show above it. Across an unfolded book's fold,
 * or a spread's split on a wide window ([screenSplit]), it sits on the page after it, off the fold.
 */
@Composable
fun BottomBar(
    modifier: Modifier = Modifier,
    note: (@Composable () -> Unit)? = null,
    columnWidth: Dp = Dp.Unspecified,
    columnAtStart: Boolean = false,
    columnMargin: Dp = pageMargin(),
    noteRoom: BarNoteRoom? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val anchors = LocalSnackbarAnchors.current
    val key = remember { Any() }
    var span by remember { mutableStateOf<PageSpan?>(null) }
    val margin = pageMargin()
    var barTop by remember { mutableFloatStateOf(Float.NaN) }
    val room = noteRoom ?: remember { BarNoteRoom() }

    DisposableEffect(anchors) { onDispose { anchors.remove(key) } }
    SideEffect { room.show(note) }
    FollowNoteIntoPage(room)

    Box(
        modifier
            .onGloballyPositioned {
                barTop = it.positionInRoot().y
                anchors.set(key, barTop)
            }.onPageSpan { span = it },
    ) {
        // Placed before the bar, so Tab reaches the note's action before the buttons under it, as on the web.
        Box(
            Modifier
                .aboveBar(room) { barTop }
                .fillMaxWidth()
                .semantics { liveRegion = LiveRegionMode.Polite },
        ) {
            note?.takeUnless { room.inPage }?.let {
                Surface(Modifier.fillMaxWidth()) { Box(Modifier.padding(horizontal = margin, vertical = 8.dp)) { it() } }
            }
        }
        Surface {
            BoxWithConstraints {
                val fold = screenSplit(maxWidth, span)

                Column {
                    HorizontalDivider()
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .windowInsetsPadding(
                                WindowInsets.safeDrawing
                                    .only(
                                        WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal,
                                    ).union(WindowInsets.ime),
                            ).padding(start = fold?.end ?: 0.dp),
                        contentAlignment = if (columnAtStart) Alignment.TopStart else Alignment.TopCenter,
                    ) {
                        CompositionLocalProvider(LocalButtonSize provides ButtonSize.Large) {
                            Column(
                                Modifier.widthIn(max = columnWidth).fillMaxWidth().padding(horizontal = columnMargin, vertical = BAR_ROOM),
                                verticalArrangement = Arrangement.spacedBy(BAR_GAP),
                                content = content,
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Where a page and its [BottomBar] meet over the bar's note: the room the page keeps clear at its scrolling content's end while the
 * note draws over it ([height]), and the note itself once it's too tall for that and the page holds it. A page that scrolls in a
 * lazy [list] passes it, so the list is scrolled to the note it takes.
 */
@Stable
class BarNoteRoom(
    internal val list: LazyListState? = null,
) {
    var height by mutableStateOf(0.dp)
        internal set

    /** The top of the page's scrolling content in the window, from [barNoteViewport]; unknown, the note always draws over the page. */
    internal var top by mutableFloatStateOf(Float.NaN)

    /** The shown note went into the page's scroll; it stays there until it's gone, so it never flips back and forth at the edge. */
    internal var inPage by mutableStateOf(false)

    private var note by mutableStateOf<(@Composable () -> Unit)?>(null)

    internal val pageNote get() = note.takeIf { inPage }

    internal fun show(next: (@Composable () -> Unit)?) {
        note = next
        if (next == null) inPage = false
    }
}

@Composable
fun rememberBarNoteRoom(list: LazyListState? = null): BarNoteRoom = remember(list) { BarNoteRoom(list) }

/** The [BarNoteRoom] of the [TaskScaffold] around this content, for the content's own scroll to mark and hold its note. */
val LocalBarNoteRoom = compositionLocalOf<BarNoteRoom?> { null }

/** Marks the page's scrolling viewport for its bar's note: the note draws over the page only in the room between its top and the bar. */
fun Modifier.barNoteViewport(room: BarNoteRoom?): Modifier = onGloballyPositioned { room?.top = it.positionInRoot().y }

/** At the end of the page's scrolling content: the bar's note when it's too tall to draw over the page, scrolled into view as it comes. */
@Composable
fun BarNoteInPage(
    room: BarNoteRoom?,
    modifier: Modifier = Modifier,
) {
    val note = room?.pageNote ?: return
    val requester = remember { BringIntoViewRequester() }
    LaunchedEffect(requester) {
        withFrameNanos {}
        requester.bringIntoView()
    }
    Box(modifier.fillMaxWidth().bringIntoViewRequester(requester).semantics { liveRegion = LiveRegionMode.Polite }) { note() }
}

/** [BarNoteInPage] as a lazy page's last item. */
fun LazyListScope.barNoteInPage(
    room: BarNoteRoom,
    modifier: Modifier = Modifier,
) {
    if (room.pageNote != null) item(key = BAR_NOTE_KEY) { BarNoteInPage(room, modifier) }
}

/** A lazy page composes only what's in view, so its list is scrolled to the end, where the note it takes is. */
@Composable
private fun FollowNoteIntoPage(room: BarNoteRoom) {
    val list = room.list ?: return
    val inPage = room.inPage
    LaunchedEffect(list, inPage) {
        if (!inPage) return@LaunchedEffect
        withFrameNanos {}
        list.animateScrollToItem(list.layoutInfo.totalItemsCount - 1)
    }
}

/** [this] with [extra] more at its bottom, such as a [BarNoteRoom]'s height for a scaffold's content. */
@Composable
fun PaddingValues.plusBottom(extra: Dp): PaddingValues {
    val direction = LocalLayoutDirection.current
    return PaddingValues(
        start = calculateStartPadding(direction),
        top = calculateTopPadding(),
        end = calculateEndPadding(direction),
        bottom = calculateBottomPadding() + extra,
    )
}

/**
 * Laid out with no height of its own and drawn just above its parent's top ([barTop]), so what it holds never moves the bar. It draws
 * only when it fits between the page's content top and the bar; otherwise it sends the note into the page's scroll.
 */
private fun Modifier.aboveBar(
    room: BarNoteRoom,
    barTop: () -> Float,
): Modifier =
    layout { measurable, constraints ->
        val placeable = measurable.measure(constraints.copy(minHeight = 0))
        val bar = barTop()
        val fits = room.top.isNaN() || placeable.height <= bar - room.top
        // Until the bar has its place, nothing draws and nothing is decided.
        if (placeable.height > 0 && !bar.isNaN() && !fits) room.inPage = true
        val shown = placeable.height.takeIf { fits && !bar.isNaN() } ?: 0
        room.height = shown.toDp()
        layout(placeable.width, 0) { if (shown > 0) placeable.place(0, -placeable.height) }
    }

private const val BAR_NOTE_KEY = "bar-note"

/** Main's gap between a bar's buttons. */
val BAR_GAP = 8.dp

/** Main's room over and under a bar's buttons: the same on a phone and a wide window, so the bar never grows with the page margin. */
val BAR_ROOM = 16.dp

/** A [BottomBar] note for what its last tap couldn't do, such as a failed save: read out as the note's slot appears. */
@Composable
fun BarError(message: String) {
    Text(text = message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
}
