package com.zoonk.android.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.withTabularFigures

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
    val state = stringResource(if (expanded) R.string.disclosure_expanded else R.string.disclosure_collapsed)

    Column(modifier) {
        ListItem(
            headlineContent = { Text(title) },
            modifier =
                Modifier
                    .clickable(role = Role.Button) { onExpandedChange(!expanded) }
                    .semantics {
                        stateDescription = state
                        val toggle = {
                            onExpandedChange(!expanded)
                            true
                        }
                        if (expanded) collapse(action = toggle) else expand(action = toggle)
                    },
            leadingContent = leading,
            colors = ListItemDefaults.colors(containerColor = Color.Transparent),
            trailingContent = {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    count?.let { Text(it.toString(), style = MaterialTheme.typography.labelLarge.withTabularFigures()) }
                    Icon(
                        painterResource(R.drawable.ic_expand_more),
                        contentDescription = null,
                        modifier = Modifier.rotate(if (expanded) 180f else 0f),
                    )
                }
            },
        )
        if (expanded) Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) { content() }
    }
}
