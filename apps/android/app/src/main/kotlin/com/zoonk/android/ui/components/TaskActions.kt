package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass

/** Main's `TaskActionBar`: as wide as the task's column on a narrow window, across it on a wide one, its lines at the end. */
@Composable
fun TaskActionBar(content: @Composable ColumnScope.() -> Unit) {
    val wide = isWideWindow()
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Column(
            if (wide) Modifier.fillMaxWidth() else Modifier.widthIn(max = TASK_COLUMN_WIDTH).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = if (wide) Alignment.End else Alignment.Start,
            content = content,
        )
    }
}

/**
 * Main's `TaskActions`: the main one at the end on a wide window. On a narrow one the main action
 * fills its line and moves to a line of its own when the others don't leave it room, so a large
 * font never breaks its word.
 */
@Composable
fun TaskActions(content: @Composable FlowRowScope.(main: Modifier) -> Unit) {
    val wide = isWideWindow()

    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp, if (wide) Alignment.End else Alignment.Start),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) { content(if (wide) Modifier.widthIn(min = MAIN_ACTION_WIDTH) else Modifier.weight(1f)) }
}

@Composable
private fun isWideWindow() =
    currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)

private val TASK_COLUMN_WIDTH = 640.dp
private val MAIN_ACTION_WIDTH = 160.dp
