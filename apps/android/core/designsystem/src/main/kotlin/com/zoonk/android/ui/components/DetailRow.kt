package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.zoonkType

/**
 * Main's `DetailRow`: a fact's label and its value at the row's end, with the [action] that changes
 * or copies it. A value that doesn't fit beside its label goes under it, so a large font never
 * splits a date or a code mid-word.
 */
@Composable
fun DetailRow(
    label: String,
    value: String,
    mono: Boolean = false,
    action: (@Composable () -> Unit)? = null,
) {
    HorizontalDivider()
    Row(
        Modifier.fillMaxWidth().padding(vertical = if (action == null) 10.dp else 0.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        FlowRow(
            Modifier.weight(1f).semantics(mergeDescendants = true) {},
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                label,
                Modifier.padding(end = 16.dp).alignByBaseline(),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                value,
                Modifier.alignByBaseline(),
                style =
                    if (mono) {
                        MaterialTheme.zoonkType.data.copy(color = MaterialTheme.colorScheme.onSurface)
                    } else {
                        MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium)
                    },
            )
        }
        action?.invoke()
    }
}
