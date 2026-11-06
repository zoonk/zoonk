package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
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
        Column(
            if (wide) Modifier.fillMaxWidth() else Modifier.taskBarColumn(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = if (wide) Alignment.End else Alignment.Start,
            content = content,
        )
    }
}

/**
 * Main's `TaskActions`: the main one at the end on a wide layout ([isWideLayout]), [back] at the
 * start. On a narrow one the main action fills its line and moves to a line of its own when the
 * others don't leave it room, so a large font never breaks its word.
 */
@Composable
fun TaskActions(
    back: (@Composable () -> Unit)? = null,
    content: @Composable FlowRowScope.(main: Modifier) -> Unit,
) {
    val wide = isWideLayout()

    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp, if (wide) Alignment.End else Alignment.Start),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        if (back != null) {
            if (wide) Box(Modifier.weight(1f)) { back() } else back()
        }
        content(if (wide) Modifier.widthIn(min = MAIN_ACTION_WIDTH) else Modifier.weight(1f))
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
