package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.foundation.layout.fillMaxWidth
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
 * Main's `TaskActionBar`: as wide as the task's column on a narrow layout, across it on a wide one
 * ([isWideLayout]), its lines at the end. A spread docks it on the page after its split, where it
 * leans toward the split as that page's column does, so it stays under what it acts on.
 */
@Composable
fun TaskActionBar(content: @Composable ColumnScope.() -> Unit) {
    val wide = isWideLayout()
    Box(Modifier.fillMaxWidth(), contentAlignment = if (spreadShows()) Alignment.TopStart else Alignment.Center) {
        Column(
            if (wide) Modifier.fillMaxWidth() else Modifier.widthIn(max = TASK_COLUMN_WIDTH).fillMaxWidth(),
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

/** Main's 40rem task column less its 16dp sides, so the bar lines up with the task's content. */
private val TASK_COLUMN_WIDTH = 608.dp
private val MAIN_ACTION_WIDTH = 160.dp
