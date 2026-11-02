package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.format.FACT_SEPARATOR

/** Main's `TaskMeta`: short facts in a row, each kept whole, wrapping only between them. */
@Composable
fun Facts(facts: List<String>) {
    FlowRow(
        Modifier.clearAndSetSemantics { contentDescription = facts.joinToString(", ") },
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        facts.forEachIndexed { index, fact ->
            Text(
                text = if (index < facts.lastIndex) fact + FACT_SEPARATOR.trimEnd() else fact,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}
