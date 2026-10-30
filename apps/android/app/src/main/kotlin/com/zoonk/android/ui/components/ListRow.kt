package com.zoonk.android.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
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
import com.zoonk.android.ui.theme.withTabularFigures

/**
 * Material's list item, as every list draws its rows: [highlighted] is the learner's place, and a row
 * with [expanded] opens what's under it, TalkBack hearing whether it's open after [stateDescription].
 * [meta] (numbers, a date, the Plus mark) ends the headline and moves under it when the words would
 * get too little room. Rows reach the list's edges and inset their own content; a nested row moves its
 * mark and words in by [indent], so its highlight still spans the list.
 */
@Composable
fun ListRow(
    headline: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    enabled: Boolean = true,
    highlighted: Boolean = false,
    indent: Dp = 0.dp,
    expanded: Boolean? = null,
    stateDescription: String? = null,
    leading: (@Composable () -> Unit)? = null,
    supporting: (@Composable () -> Unit)? = null,
    meta: (@Composable () -> Unit)? = null,
) {
    val openWords = expanded?.let { stringResource(if (it) R.string.disclosure_expanded else R.string.disclosure_collapsed) }
    val state =
        when {
            stateDescription != null && openWords != null -> stringResource(R.string.list_row_states, stateDescription, openWords)
            else -> stateDescription ?: openWords
        }
    val quiet = MaterialTheme.colorScheme.onSurfaceVariant
    val metaStyle = MaterialTheme.typography.labelMedium.withTabularFigures()

    ListItem(
        headlineContent = {
            if (meta == null) {
                headline()
            } else {
                TitleAndMeta(meta = { CompositionLocalProvider(LocalContentColor provides quiet) { ProvideTextStyle(metaStyle, meta) } }) {
                    headline()
                }
            }
        },
        modifier =
            modifier
                .then(
                    if (onClick != null) {
                        Modifier.clickable(enabled = enabled, role = Role.Button, onClick = onClick)
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
                },
        leadingContent =
            leading?.let {
                {
                    Box(
                        Modifier.padding(start = indent).size(markSize()),
                        contentAlignment = Alignment.Center,
                    ) { it() }
                }
            },
        supportingContent = supporting,
        trailingContent =
            expanded?.let {
                {
                    Icon(
                        painterResource(R.drawable.ic_expand_more),
                        contentDescription = null,
                        modifier = Modifier.rotate(if (it) 180f else 0f),
                    )
                }
            },
        colors =
            ListItemDefaults.colors(
                containerColor = if (highlighted) MaterialTheme.colorScheme.surfaceContainerHigh else Color.Transparent,
            ),
    )
}

/** Where a row's words start, past its mark, for what opens under a row to line up with them. */
@Composable
fun listRowWordsStart(): Dp = LIST_ITEM_INSET + markSize() + LEADING_GAP

@Composable
private fun TitleAndMeta(
    meta: @Composable () -> Unit,
    title: @Composable () -> Unit,
) {
    Layout(
        contents =
            listOf({
                Column {
                    title()
                }
            }, { Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) { meta() } }),
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

/** Rows reach past their column's margin by [amount] on each side, so their words line up with the headings above them. */
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

/** Material's room between a list item's leading content and its words. */
private val LEADING_GAP = 16.dp
