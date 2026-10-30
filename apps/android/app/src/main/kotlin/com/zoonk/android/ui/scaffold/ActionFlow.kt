package com.zoonk.android.ui.scaffold

import androidx.compose.foundation.layout.Arrangement
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

/**
 * A task's actions (main's `TaskActions` and `TaskMainButton`), the main one at the end on a wide
 * window. On a narrow one the main action fills its line and moves to a line of its own when the
 * others don't leave it room, so a large font never breaks its word.
 */
@Composable
fun ActionFlow(content: @Composable FlowRowScope.(main: Modifier) -> Unit) {
    val wide = currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)

    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp, if (wide) Alignment.End else Alignment.Start),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) { content(if (wide) Modifier.widthIn(min = MAIN_ACTION_WIDTH) else Modifier.weight(1f)) }
}

private val MAIN_ACTION_WIDTH = 160.dp
