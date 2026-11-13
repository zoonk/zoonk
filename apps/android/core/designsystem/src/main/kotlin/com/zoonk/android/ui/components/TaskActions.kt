package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.ui.scaffold.BAR_GAP
import com.zoonk.android.ui.scaffold.isOnBookPage
import com.zoonk.android.ui.scaffold.spreadShows
import com.zoonk.android.ui.scaffold.windowAdaptiveInfo

/**
 * Main's `TaskActionBar`: as wide as the task's column ([taskColumn]) on a narrow layout, across it on a wide one
 * ([isWideLayout]), its lines at the end. A spread docks it on the page after its split, where it
 * leans toward the split as that page's column does, so it stays under what it acts on.
 */
@Composable
fun TaskActionBar(content: @Composable ColumnScope.() -> Unit) {
    val wide = isWideLayout()
    Box(Modifier.fillMaxWidth(), contentAlignment = if (spreadShows()) Alignment.TopStart else Alignment.Center) {
        CompositionLocalProvider(LocalButtonSize provides ButtonSize.Large) {
            Column(
                if (wide) Modifier.fillMaxWidth() else Modifier.taskBarColumn(),
                verticalArrangement = Arrangement.spacedBy(BAR_GAP),
                horizontalAlignment = if (wide) Alignment.End else Alignment.Start,
                content = content,
            )
        }
    }
}

/**
 * Main's `TaskActions`: [back] at the start and the main action last. Where the bar has room (a tablet,
 * a tablet's page in a spread, a wide window), the main action sits at the end at its own width; on a
 * phone or a book's page it fills its line, and moves to a line of its own when the others don't leave
 * it room, so a large font never breaks its word. The bar's measured width decides, never the window's.
 */
@Composable
fun TaskActions(
    back: (@Composable () -> Unit)? = null,
    content: @Composable FlowRowScope.(main: Modifier) -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val roomy = maxWidth >= ROOMY_BAR_WIDTH

        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(BAR_GAP, if (roomy) Alignment.End else Alignment.Start),
            verticalArrangement = Arrangement.spacedBy(BAR_GAP),
            itemVerticalAlignment = Alignment.CenterVertically,
        ) {
            if (back != null) {
                if (roomy) Box(Modifier.weight(1f)) { back() } else back()
            }
            content(if (roomy) Modifier.widthIn(min = MAIN_ACTION_WIDTH) else Modifier.weight(1f))
        }
    }
}

/** Main's `TASK_OPTION_CLASS`: an action beside the main one that takes a line of its own on a narrow layout ([isWideLayout]). */
@Composable
fun Modifier.taskOption(): Modifier = if (isWideLayout()) this else fillMaxWidth()

/**
 * Main's `lg` for a task: an expanded window, where its actions line up at its end and what a phone
 * shows a step at a time shows at once, except on a book's page ([isOnBookPage]), which lays out as on a phone.
 */
@Composable
fun isWideLayout(): Boolean =
    windowAdaptiveInfo().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND) && !isOnBookPage()

/** Main's `TASK_COLUMN_CLASS`: a task's one column, centered at a readable measure with the same sides at every width. */
fun Modifier.taskColumn(): Modifier = widthIn(max = TASK_COLUMN_WIDTH).fillMaxWidth().padding(horizontal = TASK_MARGIN)

/** [taskColumn] in a task's bottom bar, which keeps the column's sides itself: as wide as what the column holds. */
fun Modifier.taskBarColumn(): Modifier = widthIn(max = TASK_COLUMN_WIDTH - TASK_MARGIN * 2).fillMaxWidth()

private val TASK_COLUMN_WIDTH = 640.dp
internal val TASK_MARGIN = 16.dp
private val MAIN_ACTION_WIDTH = 160.dp

/** Wider than any phone's or book page's bar (about 400dp), narrower than a tablet's page in a spread. */
private val ROOMY_BAR_WIDTH = 480.dp
