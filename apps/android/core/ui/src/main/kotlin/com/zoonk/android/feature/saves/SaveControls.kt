package com.zoonk.android.feature.saves

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconToggleButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.ButtonEdge
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.DropdownMenu
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.iconButtonEdge
import com.zoonk.android.ui.components.listRowDescription
import kotlinx.coroutines.launch

/**
 * What saving something is called where a row offers it (its long-press menu and its swipe): each kind of thing brings
 * its own words, since they agree with what was saved in some languages.
 */
@Immutable
data class SaveWords(
    val save: String,
    val unsave: String,
)

/**
 * Main's `SaveButton` drawn as the bookmark alone: outlined, then filled once saved. [label] says the state ("Save"
 * until it's "Saved"), as main's does, and TalkBack hears it toggle.
 */
@Composable
fun BookmarkToggle(
    saved: Boolean,
    label: String,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    IconToggleButton(checked = saved, onCheckedChange = { onToggle() }, modifier = modifier) {
        Icon(painterResource(if (saved) R.drawable.ic_bookmark_filled else R.drawable.ic_bookmark), contentDescription = label)
    }
}

/**
 * A row's bookmark, or its empty slot, on the row's end edge: the button gives up its blank room past the glyph, and
 * the glyph its own room past its ink, so the ink ends where a row's chevron does.
 */
fun Modifier.rowBookmarkEdge(): Modifier =
    iconButtonEdge(ButtonEdge.End).layout { measurable, constraints ->
        val pull = BOOKMARK_INK.roundToPx()
        val placeable = measurable.measure(constraints)
        layout(placeable.width - pull, placeable.height) { placeable.placeRelative(0, 0) }
    }

/** `ic_bookmark` leaves 5dp blank after its ink. */
private val BOOKMARK_INK = 5.dp

/** A row's long-press menu: Save, or Remove from saved. */
@Composable
fun SaveMenu(
    expanded: Boolean,
    saved: Boolean,
    words: SaveWords,
    onDismiss: () -> Unit,
    onToggle: () -> Unit,
) {
    DropdownMenu(expanded = expanded, onDismissRequest = onDismiss) {
        DropdownMenuItem(
            text = { Text(if (saved) words.unsave else words.save) },
            leadingIcon = {
                Icon(painterResource(if (saved) R.drawable.ic_bookmark_filled else R.drawable.ic_bookmark), contentDescription = null)
            },
            onClick = {
                onDismiss()
                onToggle()
            },
        )
    }
}

/**
 * Swiping a row either way saves what it shows, or removes it when saved, then the row slides back: the same as its
 * long-press menu. Nothing to swipe without [onToggle].
 */
@Composable
fun SaveSwipe(
    saved: Boolean,
    words: SaveWords,
    onToggle: (() -> Unit)?,
    content: @Composable () -> Unit,
) {
    if (onToggle == null) {
        content()
        return
    }
    val state = rememberSwipeToDismissBoxState()
    val scope = rememberCoroutineScope()

    SwipeToDismissBox(
        state = state,
        backgroundContent = {
            val start = state.dismissDirection == SwipeToDismissBoxValue.StartToEnd
            Row(
                Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceContainerHigh).padding(horizontal = LIST_ITEM_INSET),
                horizontalArrangement = if (start) Arrangement.Start else Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    painterResource(if (saved) R.drawable.ic_bookmark else R.drawable.ic_bookmark_filled),
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    if (saved) words.unsave else words.save,
                    Modifier.padding(horizontal = 8.dp),
                    style = MaterialTheme.typography.labelLarge,
                )
            }
        },
        onDismiss = {
            onToggle()
            scope.launch { state.reset() }
        },
    ) {
        Column(Modifier.background(MaterialTheme.colorScheme.surface)) { content() }
    }
}

/**
 * A save that can no longer open, under "No longer available": its saved title, what it was, and Remove, which takes
 * it away at once since it can't be saved again. [spoken] is what TalkBack says for Remove, naming it.
 */
@Composable
fun UnavailableSaveRow(
    title: String,
    detail: String?,
    remove: String,
    spoken: String,
    onRemove: () -> Unit,
    leading: (@Composable () -> Unit)? = null,
) {
    ListRow(
        headline = { Text(title) },
        leading = leading,
        supporting = listRowDescription(detail),
        trailing = {
            OutlinedButton(onClick = onRemove, modifier = Modifier.semantics { contentDescription = spoken }, size = ButtonSize.Small) {
                Text(remove)
            }
        },
    )
}
