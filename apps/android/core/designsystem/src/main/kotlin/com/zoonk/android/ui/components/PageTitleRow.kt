package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.scaffold.pageTitle

/**
 * Main's `PageHeader`: a page's title with what sits at its end (actions, a readout). It is the page's
 * title for TalkBack and the keyboard ([pageTitle]), and on a `PageScaffold` the bar names the page
 * only once it scrolls away.
 */
@Composable
fun PageTitleRow(
    title: String,
    modifier: Modifier = Modifier,
    verticalAlignment: Alignment.Vertical = Alignment.Bottom,
    trailing: @Composable RowScope.() -> Unit = {},
) {
    HeadingRow(title, MaterialTheme.typography.headlineMedium, modifier, verticalAlignment, Modifier.pageTitle()) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, content = trailing)
    }
}

/**
 * A heading with what sits at its end, which moves under it when both don't fit, so the heading
 * keeps its words whole (main's `flex-wrap`).
 */
@Composable
internal fun HeadingRow(
    title: String,
    style: TextStyle,
    modifier: Modifier,
    verticalAlignment: Alignment.Vertical,
    titleModifier: Modifier = Modifier.semantics { heading() },
    trailing: @Composable () -> Unit,
) {
    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalArrangement = Arrangement.spacedBy(4.dp),
        itemVerticalAlignment = verticalAlignment,
    ) {
        Text(title, Modifier.padding(end = 12.dp).then(titleModifier), style = style)
        trailing()
    }
}

/** Main's `PageHeader` with its `PageSubtitle`: a page's title and the line under it. */
@Composable
fun PageHeader(
    title: String,
    supporting: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        PageTitleRow(title)
        Text(supporting, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
}
