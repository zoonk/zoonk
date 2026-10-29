package com.zoonk.android.feature.memory

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.api.models.MemoryChangeReference
import kotlinx.coroutines.launch
import java.util.UUID

/** One change to memory: the fact it added ([statement]) and the one it replaced or removed. */
data class MemoryChangeShown(
    val factId: UUID?,
    val statement: String?,
    val previousFactId: UUID?,
    val previousStatement: String?,
)

/**
 * Main's "Memory updated" line with Undo, wherever Zoonk learns or forgets something (the memory
 * page, the tutor). [onUndo] answers whether every change was undone.
 */
@Composable
fun MemoryUpdated(
    changes: List<MemoryChangeShown>,
    onUndo: suspend (List<MemoryChangeReference>) -> Boolean,
    modifier: Modifier = Modifier,
) {
    val first = changes.firstOrNull() ?: return
    var undone by remember(changes) { mutableStateOf<Boolean?>(null) }
    var isUndoing by remember(changes) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val label = stringResource(R.string.memory_updated)
    val more = if (changes.size > 1) pluralStringResource(R.plurals.memory_updated_more, changes.size - 1, changes.size - 1) else null
    val strong = MaterialTheme.colorScheme.onSurface

    Row(
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            painter = painterResource(R.drawable.ic_psychology),
            contentDescription = null,
            modifier = Modifier.size(18.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Text(
            text =
                when (undone) {
                    true -> {
                        buildAnnotatedString { append(stringResource(R.string.memory_change_undone)) }
                    }

                    false -> {
                        buildAnnotatedString {
                            withStyle(SpanStyle(color = MaterialTheme.colorScheme.error)) { append(stringResource(R.string.memory_undo_failed)) }
                        }
                    }

                    null -> {
                        buildAnnotatedString {
                            withStyle(SpanStyle(color = strong, fontWeight = FontWeight.Medium)) { append(label) }
                            first.statement?.let { append(" $it") }
                            first.previousStatement?.let {
                                append(" ")
                                withStyle(SpanStyle(textDecoration = TextDecoration.LineThrough)) { append(it) }
                            }
                            more?.let { append(" $it") }
                        }
                    }
                },
            modifier = Modifier.weight(1f),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )

        if (undone == null) {
            TextButton(
                onClick = {
                    isUndoing = true
                    scope.launch {
                        undone = onUndo(changes.map { MemoryChangeReference(it.factId, it.previousFactId) })
                        isUndoing = false
                    }
                },
                enabled = !isUndoing,
                modifier = Modifier.padding(start = 4.dp),
            ) { Text(stringResource(R.string.memory_undo)) }
        }
    }
}
