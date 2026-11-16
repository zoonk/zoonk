package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

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

/** One day of [WeekDaysRow], drawn one way on every week: its [ring] ([WEEK_RING] wide) over its [letter], today's in ink. */
@Composable
fun WeekDay(
    letter: String,
    today: Boolean,
    modifier: Modifier = Modifier,
    ring: @Composable () -> Unit,
) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        ring()
        Text(
            text = letter,
            color = if (today) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = if (today) FontWeight.Medium else null,
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

/** A week day's ring, the same on Today, the Plan and the weekly recap. */
val WEEK_RING = 30.dp
