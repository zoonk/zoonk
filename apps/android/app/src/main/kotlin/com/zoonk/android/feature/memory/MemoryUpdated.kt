package com.zoonk.android.feature.memory

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.zoonk.android.R
import com.zoonk.api.models.MemoryChangeReference
import java.util.UUID

/** One change to memory: the fact it added ([statement]) and the one it replaced or removed. */
data class MemoryChangeShown(
    val factId: UUID?,
    val statement: String?,
    val previousFactId: UUID?,
    val previousStatement: String?,
) {
    val reference: MemoryChangeReference get() = MemoryChangeReference(factId, previousFactId)
}

/** Where an Undo of a memory change stands; [Failed] means memory changed since. */
enum class MemoryUndo { Offered, Undoing, Undone, Failed }

/**
 * Main's "Memory updated" line with Undo, wherever Zoonk learns or forgets something (the memory
 * page, the tutor). The screen's view model runs the Undo, so leaving the line doesn't cancel it.
 */
@Composable
fun MemoryUpdated(
    changes: List<MemoryChangeShown>,
    undo: MemoryUndo,
    onUndo: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val first = changes.firstOrNull() ?: return
    val label = stringResource(R.string.memory_updated)
    val more = if (changes.size > 1) pluralStringResource(R.plurals.memory_updated_more, changes.size - 1, changes.size - 1) else null
    val strong = MaterialTheme.colorScheme.onSurface
    val icon = MaterialTheme.colorScheme.onSurfaceVariant

    Row(
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text =
                buildAnnotatedString {
                    // The icon is decorative: TalkBack reads its stand-in as a pause, not a symbol.
                    appendInlineContent(ICON_ID, alternateText = " ")
                    append(" ")
                    when (undo) {
                        MemoryUndo.Undone -> {
                            append(stringResource(R.string.memory_change_undone))
                        }

                        MemoryUndo.Failed -> {
                            withStyle(
                                SpanStyle(color = MaterialTheme.colorScheme.error),
                            ) { append(stringResource(R.string.memory_undo_failed)) }
                        }

                        MemoryUndo.Offered, MemoryUndo.Undoing -> {
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
            modifier = Modifier.weight(1f).alignByBaseline(),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
            inlineContent =
                mapOf(
                    ICON_ID to
                        InlineTextContent(Placeholder(ICON_EM.em, ICON_EM.em, PlaceholderVerticalAlign.TextCenter)) {
                            Icon(painterResource(R.drawable.ic_psychology), contentDescription = null, Modifier.fillMaxSize(), tint = icon)
                        },
                ),
        )

        if (undo == MemoryUndo.Offered || undo == MemoryUndo.Undoing) {
            TextButton(onClick = onUndo, enabled = undo == MemoryUndo.Offered, modifier = Modifier.alignByBaseline()) {
                Text(stringResource(R.string.memory_undo))
            }
        }
    }
}

private const val ICON_ID = "icon"
private const val ICON_EM = 1.3f
