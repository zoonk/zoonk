package com.zoonk.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.indication
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonkType

/**
 * Main's `ListRow`, as every list draws its rows: a mark, the title (`ListRowTitle`) over its
 * description, and mono data at its end (`ListRowTrailing`), 11dp above and below the words and at
 * least 48dp tall. [highlighted] is the learner's place, on `muted` with `lg` corners reaching 10dp
 * past the words, as main's; a row with [expanded] opens what's under it, TalkBack hearing whether
 * it's open after [stateDescription]. [meta] (numbers, a date, the Plus mark) ends the headline and
 * moves under it when the words would get too little room. [trailing] is a control at the row's end,
 * such as a switch or a button (main's `SettingRow`). [leading] is a mark at least a line tall, or a
 * larger picture (an avatar). Rows reach the list's edges and inset their own content by
 * [LIST_ITEM_INSET]; a nested row moves its mark and words in by [indent], so its highlight still
 * spans the list.
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
    trailing: (@Composable () -> Unit)? = null,
) {
    val openWords = expanded?.let { stringResource(if (it) R.string.disclosure_expanded else R.string.disclosure_collapsed) }
    val state =
        when {
            stateDescription != null && openWords != null -> stringResource(R.string.list_row_states, stateDescription, openWords)
            else -> stateDescription ?: openWords
        }
    val ink = MaterialTheme.colorScheme.onSurface
    val quiet = MaterialTheme.colorScheme.onSurfaceVariant
    val interaction = remember { MutableInteractionSource() }

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = MIN_HEIGHT)
                // The whole row takes the tap; its ripple stays inside the highlight's rounded shape.
                .then(
                    if (onClick != null) {
                        Modifier.clickable(interaction, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
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
                }.padding(horizontal = LIST_ITEM_INSET - HIGHLIGHT_OUTSET, vertical = HIGHLIGHT_INSET)
                .clip(RoundedCornerShape(ZoonkRadius.lg))
                .background(if (highlighted) MaterialTheme.colorScheme.surfaceContainerHigh else Color.Transparent)
                .indication(interaction, ripple())
                .padding(start = HIGHLIGHT_OUTSET + indent, end = HIGHLIGHT_OUTSET, top = WORDS_PADDING, bottom = WORDS_PADDING),
        horizontalArrangement = Arrangement.spacedBy(LEADING_GAP),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CompositionLocalProvider(LocalContentColor provides quiet) {
            leading?.let {
                Box(
                    Modifier.sizeIn(minWidth = markSize(), minHeight = markSize()),
                    contentAlignment = Alignment.Center,
                ) { it() }
            }
        }

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            CompositionLocalProvider(LocalContentColor provides ink) {
                ProvideTextStyle(MaterialTheme.typography.titleSmall) {
                    if (meta == null) {
                        headline()
                    } else {
                        TitleAndMeta(
                            meta = {
                                CompositionLocalProvider(LocalContentColor provides quiet) {
                                    ProvideTextStyle(MaterialTheme.zoonkType.data, meta)
                                }
                            },
                        ) {
                            headline()
                        }
                    }
                }
            }
            supporting?.let {
                CompositionLocalProvider(LocalContentColor provides quiet) { ProvideTextStyle(MaterialTheme.typography.bodySmall, it) }
            }
        }

        expanded?.let {
            Icon(
                painterResource(R.drawable.ic_expand_more),
                contentDescription = null,
                modifier = Modifier.rotate(if (it) 180f else 0f),
                tint = quiet,
            )
        }

        trailing?.invoke()
    }
}

/** Where a row's words start, past its mark, for what opens under a row to line up with them. */
@Composable
fun listRowWordsStart(): Dp = LIST_ITEM_INSET + markSize() + LEADING_GAP

/**
 * A mark and words that aren't a list row, in a row's leading slot and gap so their words start where
 * rows' do. The mark centers on the first line of [firstLine].
 */
@Composable
fun MarkedLine(
    firstLine: TextStyle,
    mark: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val line = with(LocalDensity.current) { firstLine.lineHeight.toDp() }
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(LEADING_GAP)) {
        Box(Modifier.width(markSize()).height(line), contentAlignment = Alignment.Center) { mark() }
        content()
    }
}

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

/** Main's `gap-3` between a row's mark and its words. */
private val LEADING_GAP = 12.dp

/** Main's `min-h-11` row, raised to Android's 48dp touch target. */
private val MIN_HEIGHT = 48.dp

/** How far the learner's row's `muted` reaches past the words, and how far it stays off the hairlines. */
private val HIGHLIGHT_OUTSET = 10.dp
private val HIGHLIGHT_INSET = 2.dp

/** Main's 11dp above and below a row's words, less the highlight's inset. */
private val WORDS_PADDING = 11.dp - HIGHLIGHT_INSET
