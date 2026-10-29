package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun DisclosureRow(
    title: String,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    leading: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    count: Int? = null,
    content: @Composable () -> Unit,
) {
    Column(modifier) {
        ListRow(
            headline = { Text(title) },
            onClick = { onExpandedChange(!expanded) },
            expanded = expanded,
            leading = leading,
            meta = count?.let { { Text(it.toString()) } },
        )
        if (expanded) Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) { content() }
    }
}
