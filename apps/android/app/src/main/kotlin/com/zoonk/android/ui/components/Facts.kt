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

/** Main's `TaskMeta`: short facts in a row, each kept whole, wrapping only between them. */
@Composable
fun Facts(facts: List<String>) {
    FlowRow(
        Modifier.clearAndSetSemantics { contentDescription = facts.joinToString(", ") },
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        facts.forEachIndexed { index, fact ->
            Text(
                text = if (index < facts.lastIndex) fact + NO_BREAK_DOT else fact,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

private const val NO_BREAK_DOT = "\u00A0·"
