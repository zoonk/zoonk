package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
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
 * under a page's column. A [note] (an error, a status) shows over the screen just above the bar, so the
 * bar and its buttons never move; its slot stays in place as a polite live region, so a new note is read out. The window's snackbars show above it. Across an unfolded book's fold,
 * or a spread's split on a wide window ([screenSplit]), it sits on the page after it, off the fold.
 */
@Composable
fun BottomBar(
    modifier: Modifier = Modifier,
    note: (@Composable () -> Unit)? = null,
    columnWidth: Dp = Dp.Unspecified,
    content: @Composable ColumnScope.() -> Unit,
) {
    val anchors = LocalSnackbarAnchors.current
    val key = remember { Any() }
    var span by remember { mutableStateOf<PageSpan?>(null) }
    val margin = pageMargin()

    DisposableEffect(anchors) { onDispose { anchors.remove(key) } }

    Box(modifier.onGloballyPositioned { anchors.set(key, it.boundsInRoot().top) }.onPageSpan { span = it }) {
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
                        contentAlignment = Alignment.TopCenter,
                    ) {
                        CompositionLocalProvider(LocalButtonSize provides ButtonSize.Large) {
                            Column(
                                Modifier.widthIn(max = columnWidth).fillMaxWidth().padding(margin),
                                verticalArrangement = Arrangement.spacedBy(BAR_GAP),
                                content = content,
                            )
                        }
                    }
                }
            }
        }
        Box(Modifier.aboveBar().fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }) {
            note?.let {
                Surface(Modifier.fillMaxWidth()) { Box(Modifier.padding(horizontal = margin, vertical = 8.dp)) { it() } }
            }
        }
    }
}

/** Laid out with no height of its own and drawn just above its parent's top, so what it holds never moves the bar. */
private fun Modifier.aboveBar(): Modifier =
    layout { measurable, constraints ->
        val placeable = measurable.measure(constraints.copy(minHeight = 0))
        layout(placeable.width, 0) { placeable.place(0, -placeable.height) }
    }

/** Main's gap between a bar's buttons. */
val BAR_GAP = 8.dp

/** A [BottomBar] note for what its last tap couldn't do, such as a failed save: read out as the note's slot appears. */
@Composable
fun BarError(message: String) {
    Text(text = message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
}
