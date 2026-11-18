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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
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
 * keeps the page's margin ([pageMargin]) on all four sides of its buttons, clear of the system bars and
 * the keyboard, with its lines 8dp apart and its buttons [ButtonSize.Large]; [columnWidth] keeps them
 * under a page's column, which a page whose column starts at its pane's edge or keeps another side margin says
 * with [columnAtStart] and [columnMargin], so the buttons end where the column does. A [note] (an error, a status) draws over the page
 * just above the bar, so the bar never grows and its buttons never move; [noteRoom] tells the page how tall it is, for its scrolling
 * content to end clear of it. Its slot stays in place as a polite live region, so a new note is read out. The window's snackbars show above it. Across an unfolded book's fold,
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
    val density = LocalDensity.current
    var barTop by remember { mutableFloatStateOf(Float.POSITIVE_INFINITY) }
    // The note never reaches above the page's top bar: in a short window it keeps the room between them and scrolls in it.
    val pageTop = WindowInsets.safeDrawing.getTop(density) + with(density) { TopAppBarDefaults.TopAppBarExpandedHeight.toPx() }
    val noteRoomLeft = maxOf(barTop - pageTop, with(density) { NOTE_MIN_HEIGHT.toPx() })

    DisposableEffect(anchors) { onDispose { anchors.remove(key) } }

    Box(
        modifier
            .onGloballyPositioned {
                barTop = it.boundsInRoot().top
                anchors.set(key, barTop)
            }.onPageSpan { span = it },
    ) {
        // Placed before the bar, so Tab reaches the note's action before the buttons under it, as on the web.
        Box(
            Modifier
                .aboveBar(noteRoomLeft)
                .onSizeChanged { noteRoom?.height = with(density) { it.height.toDp() } }
                .fillMaxWidth()
                .semantics { liveRegion = LiveRegionMode.Polite },
        ) {
            note?.let {
                Surface(Modifier.fillMaxWidth()) {
                    Box(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = margin, vertical = 8.dp)) { it() }
                }
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
                                Modifier.widthIn(max = columnWidth).fillMaxWidth().padding(horizontal = columnMargin, vertical = margin),
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

/** The room a page keeps clear at its scrolling content's end for its [BottomBar]'s note, which draws over the page. */
@Stable
class BarNoteRoom {
    var height by mutableStateOf(0.dp)
        internal set
}

@Composable
fun rememberBarNoteRoom(): BarNoteRoom = remember { BarNoteRoom() }

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

/** Laid out with no height of its own and drawn just above its parent's top, so what it holds never moves the bar; at most [maxHeight] px tall. */
private fun Modifier.aboveBar(maxHeight: Float): Modifier =
    layout { measurable, constraints ->
        val cap = if (maxHeight.isFinite()) minOf(constraints.maxHeight, maxHeight.toInt()) else constraints.maxHeight
        val placeable = measurable.measure(constraints.copy(minHeight = 0, maxHeight = cap))
        layout(placeable.width, 0) { placeable.place(0, -placeable.height) }
    }

/** The least a note keeps above the bar in the shortest window, a line and its padding. */
private val NOTE_MIN_HEIGHT = 48.dp

/** Main's gap between a bar's buttons. */
val BAR_GAP = 8.dp

/** A [BottomBar] note for what its last tap couldn't do, such as a failed save: read out as the note's slot appears. */
@Composable
fun BarError(message: String) {
    Text(text = message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
}
