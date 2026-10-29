package com.zoonk.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R

/**
 * Main's list row, at least 48dp tall: the learner's place is highlighted, inset from the column's
 * edges. A row with [expanded] opens what's under it, and TalkBack hears whether it's open after
 * [stateDescription]. Without [end] it keeps an icon's room, so rows' numbers line up.
 */
@Composable
fun ListRow(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    highlighted: Boolean = false,
    expanded: Boolean? = null,
    stateDescription: String? = null,
    end: (@Composable () -> Unit)? = null,
    content: @Composable RowScope.() -> Unit,
) {
    val openWords = expanded?.let { stringResource(if (it) R.string.disclosure_expanded else R.string.disclosure_collapsed) }
    val state =
        when {
            stateDescription != null && openWords != null -> stringResource(R.string.list_row_states, stateDescription, openWords)
            else -> stateDescription ?: openWords
        }

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .bleed(ROW_BLEED)
                .clip(MaterialTheme.shapes.medium)
                .then(if (highlighted) Modifier.background(MaterialTheme.colorScheme.surfaceContainerHigh) else Modifier)
                .then(
                    if (onClick != null) {
                        Modifier.clickable(role = Role.Button, onClick = onClick)
                    } else {
                        Modifier.semantics(mergeDescendants = true) {}
                    },
                ).semantics {
                    if (state != null) this.stateDescription = state
                    if (expanded != null && onClick != null) {
                        val toggle = {
                            onClick()
                            true
                        }
                        if (expanded) collapse(action = toggle) else expand(action = toggle)
                    }
                }.heightIn(min = 48.dp)
                .padding(horizontal = ROW_BLEED, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        content()
        when {
            end != null -> {
                end()
            }

            expanded != null -> {
                Icon(
                    painter = painterResource(if (expanded) R.drawable.ic_expand_less else R.drawable.ic_expand_more),
                    contentDescription = null,
                    modifier = Modifier.size(ROW_ICON_SIZE),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            else -> {
                Box(Modifier.size(ROW_ICON_SIZE))
            }
        }
    }
}

/** A row's mark, one line of body text tall, so rows' words start in one place. */
@Composable
fun ListRowLeading(content: @Composable () -> Unit) {
    Box(Modifier.size(markSize()), contentAlignment = Alignment.Center) { content() }
}

/** The end of a row that opens a page. */
@Composable
fun ListRowChevron(modifier: Modifier = Modifier) {
    Icon(
        painter = painterResource(R.drawable.ic_chevron_right),
        contentDescription = null,
        modifier = modifier.size(ROW_ICON_SIZE),
        tint = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

/**
 * A row's words with its numbers or date at the end, as main's rows show them; when the words would
 * get too little room (large text, a narrow pane), the numbers go under them instead.
 */
@Composable
fun TitleAndMeta(
    modifier: Modifier = Modifier,
    meta: @Composable () -> Unit,
    title: @Composable () -> Unit,
) {
    Layout(
        contents =
            listOf({
                Column {
                    title()
                }
            }, { Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) { meta() } }),
        modifier = modifier,
    ) { (titles, metas), constraints ->
        val width = constraints.maxWidth
        val gap = 12.dp.roundToPx()
        val metaPlaceable = metas.first().measure(Constraints(maxWidth = width))
        val titleMeasurable = titles.first()
        val room = width - metaPlaceable.width - if (metaPlaceable.width > 0) gap else 0
        val beside = metaPlaceable.width == 0 || room >= minOf(titleMeasurable.maxIntrinsicWidth(Constraints.Infinity), width / 2)
        if (beside) {
            val titlePlaceable = titleMeasurable.measure(Constraints(maxWidth = room.coerceAtLeast(0)))
            val height = maxOf(titlePlaceable.height, metaPlaceable.height)
            layout(width, height) {
                titlePlaceable.placeRelative(0, (height - titlePlaceable.height) / 2)
                metaPlaceable.placeRelative(width - metaPlaceable.width, (height - metaPlaceable.height) / 2)
            }
        } else {
            val titlePlaceable = titleMeasurable.measure(Constraints(maxWidth = width))
            layout(width, titlePlaceable.height + metaPlaceable.height) {
                titlePlaceable.placeRelative(0, 0)
                metaPlaceable.placeRelative(0, titlePlaceable.height)
            }
        }
    }
}

/** Rows reach past the page's margin by [amount] on each side, so their words line up with the headings above them. */
fun Modifier.bleed(amount: Dp): Modifier =
    layout { measurable, constraints ->
        val extra = (amount * 2).roundToPx()
        val wide =
            if (constraints.hasBoundedWidth) {
                constraints.copy(minWidth = constraints.minWidth + extra, maxWidth = constraints.maxWidth + extra)
            } else {
                constraints
            }
        val placeable = measurable.measure(wide)
        layout(placeable.width - extra, placeable.height) { placeable.placeRelative(-amount.roundToPx(), 0) }
    }

val ROW_BLEED = 8.dp

/** Icons in rows take Material's 24dp, so they keep pace with the words beside them. */
val ROW_ICON_SIZE = 24.dp
