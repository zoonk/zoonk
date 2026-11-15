package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

/**
 * Main's week row: the days edge to edge across the column, the first and last on its edges and equal gaps between,
 * each day as wide as its ring. A day that opens something takes taps in a 48dp target centered on it that takes no
 * part in the layout: Compose widens a smaller target to 48dp, and neighbors split the room where targets meet.
 */
@Composable
fun WeekDaysRow(
    modifier: Modifier = Modifier,
    content: @Composable RowScope.() -> Unit,
) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top, content = content)
}
