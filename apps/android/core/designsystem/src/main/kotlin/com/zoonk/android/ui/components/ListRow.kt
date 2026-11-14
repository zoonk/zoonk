package com.zoonk.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.indication
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonkType
import kotlin.math.roundToInt

/**
 * Main's `ListRow`, as every list draws its rows: a mark, the title (`ListRowTitle`) over its
 * description, and mono data at its end (`ListRowTrailing`), 11dp above and below the words and at
 * least 48dp tall. [highlighted] is the learner's place, on `muted` with `lg` corners reaching 10dp
 * past the words, as main's; a row with [expanded] opens what's under it, TalkBack hearing whether
 * it's open after [stateDescription]. [meta] (numbers, a date, the Plus mark) ends the headline and
 * moves under it when the words would get too little room. [trailing] is a control at the row's end,
 * such as a switch or a button (main's `SettingRow`). [leading] is a mark at least a line tall, or a
 * larger picture (an avatar). A [busy] row's end (its chevron, or its [meta] without one) turns
 * into a spinner while it works ([BusyContent]); a row that isn't [enabled] dims, and with
 * [focusableWhenDisabled], as one waiting on another control's request, keeps its focus. Rows reach the list's edges and inset
 * their own content by [LIST_ITEM_INSET]; a nested row moves its mark and words in by [indent], so its highlight still
 * spans the list. [verticalAlignment] `Top` puts the words and the row's end at its top (main's
 * `items-start`). A row that opens a page ends with main's chevron; one
 * that acts in place (a "Show more", logging out) passes [chevron] `false`, and one whose [trailing]
 * is a value rather than a control passes `true`. [onLongClick] opens what else a tappable row offers,
 * such as a menu, which TalkBack names with [onLongClickLabel]. The mark is centered on the words beside one
 * or two lines (the title however it wraps, a value moved under it, each description) and on the first line
 * beside three or more (E5); a lead that is text ([leadOnFirstLine], a number or a date) is always on the first.
 */
@Composable
fun ListRow(
    headline: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    onLongClickLabel: String? = null,
    onLongClick: (() -> Unit)? = null,
    enabled: Boolean = true,
    focusableWhenDisabled: Boolean = false,
    busy: Boolean = false,
    highlighted: Boolean = false,
    indent: Dp = 0.dp,
    expanded: Boolean? = null,
    stateDescription: String? = null,
    leading: (@Composable () -> Unit)? = null,
    leadOnFirstLine: Boolean = false,
    supporting: (@Composable () -> Unit)? = null,
    meta: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    verticalAlignment: Alignment.Vertical = Alignment.CenterVertically,
    chevron: Boolean = onClick != null && expanded == null && trailing == null,
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
                .layoutPart(LayoutPart.LIST, LayoutPart.Part.Row, endInset = LIST_ITEM_INSET)
                .fillMaxWidth()
                .heightIn(min = MIN_HEIGHT)
                // The whole row takes the tap; its ripple stays inside the highlight's rounded shape.
                .then(
                    if (onClick != null) {
                        Modifier.busyClickable(
                            busy,
                            interaction,
                            indication = null,
                            enabled,
                            focusableWhenDisabled,
                            onLongClickLabel,
                            onLongClick,
                            onClick,
                        )
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
                .alpha(if (onClick != null && !enabled && !busy) DISABLED_ALPHA else 1f)
                .padding(start = HIGHLIGHT_OUTSET + indent, end = HIGHLIGHT_OUTSET, top = WORDS_PADDING, bottom = WORDS_PADDING),
        horizontalArrangement = Arrangement.spacedBy(LEADING_GAP),
        verticalAlignment = verticalAlignment,
    ) {
        val parts = remember { RowParts() }
        if (meta == null) SideEffect { parts.stacked = false }
        if (supporting == null) SideEffect { parts.descriptions = 0 }
        FirstLineMark(
            firstLine = MaterialTheme.typography.titleSmall,
            onFirstLine = { leadOnFirstLine || parts.lines >= THREE_LINES },
            modifier = Modifier.weight(1f),
            mark =
                leading?.let { mark ->
                    {
                        CompositionLocalProvider(LocalContentColor provides quiet) {
                            Box(
                                Modifier
                                    .sizeIn(
                                        minWidth = markSize(),
                                        minHeight = markSize(),
                                    ).layoutPart(LayoutPart.LIST, LayoutPart.Part.Mark),
                                contentAlignment = Alignment.Center,
                            ) { mark() }
                        }
                    }
                },
        ) {
            Column {
                CompositionLocalProvider(LocalContentColor provides ink) {
                    ProvideTextStyle(MaterialTheme.typography.titleSmall) {
                        if (meta == null) {
                            Column(
                                Modifier.layoutPart(LayoutPart.LIST, LayoutPart.Part.Label),
                                verticalArrangement = Arrangement.spacedBy(1.dp),
                            ) {
                                headline()
                            }
                        } else {
                            TitleAndMeta(
                                parts = parts,
                                metaBusy = busy && !chevron,
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
                    CompositionLocalProvider(LocalContentColor provides quiet) {
                        ProvideTextStyle(MaterialTheme.typography.bodySmall) {
                            Descriptions(parts, Modifier.layoutPart(LayoutPart.LIST, LayoutPart.Part.Note), it)
                        }
                    }
                }
            }
        }

        expanded?.let {
            Icon(
                painterResource(R.drawable.ic_expand_more),
                contentDescription = null,
                modifier = Modifier.layoutPart(LayoutPart.LIST, LayoutPart.Part.End).rotate(if (it) 180f else 0f),
                tint = quiet,
            )
        }

        trailing?.let { Box(Modifier.layoutPart(LayoutPart.LIST, LayoutPart.Part.End)) { it() } }

        if (chevron) BusyContent(busy) { ListRowChevron() }
    }
}

/** Main's `ListRowChevron`: what a row that opens a page ends with, quieter than its words. */
@Composable
fun ListRowChevron() {
    Icon(
        painterResource(R.drawable.ic_chevron_right),
        contentDescription = null,
        modifier = Modifier.layoutPart(LayoutPart.LIST, LayoutPart.Part.End).size(16.dp),
        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
    )
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
    FirstLineMark(
        firstLine = firstLine,
        onFirstLine = { true },
        modifier = modifier,
        mark = { Box(Modifier.widthIn(min = markSize()), contentAlignment = Alignment.Center) { mark() } },
        content = content,
    )
}

/**
 * A mark beside words, where E5 puts it: centered on the words, or, when [onFirstLine] says so (a list row of
 * three lines or more, a lead), centered on their first line, a line as tall as [firstLine]'s at this text
 * size. The words start [LEADING_GAP] past the mark.
 */
@Composable
private fun FirstLineMark(
    firstLine: TextStyle,
    onFirstLine: () -> Boolean,
    modifier: Modifier = Modifier,
    mark: (@Composable () -> Unit)?,
    content: @Composable () -> Unit,
) {
    if (mark == null) {
        Box(modifier) { content() }
        return
    }
    val measurer = rememberTextMeasurer()
    // As the words' own style lays a line out at this text size, nonlinear scaling included.
    val line = remember(firstLine, measurer) { measurer.measure("A", firstLine, maxLines = 1).size.height }
    Layout(contents = listOf(mark, content), modifier = modifier) { (marks, words), constraints ->
        val gap = LEADING_GAP.roundToPx()
        val markPlaceable = marks.first().measure(constraints.copy(minWidth = 0, minHeight = 0))
        val wordsWidth = (constraints.maxWidth - markPlaceable.width - gap).coerceAtLeast(0)
        val wordsPlaceable = words.first().measure(constraints.copy(minWidth = wordsWidth, maxWidth = wordsWidth, minHeight = 0))
        // The words' measuring has just counted their lines.
        val middle = if (onFirstLine()) line else wordsPlaceable.height
        // Whichever reaches higher above the middle sets the top.
        val markTop = ((middle - markPlaceable.height) / 2f).coerceAtLeast(0f).roundToInt()
        val wordsTop = ((markPlaceable.height - middle) / 2f).coerceAtLeast(0f).roundToInt()
        val drawn = maxOf(markTop + markPlaceable.height, wordsTop + wordsPlaceable.height)
        // Taller than what it draws (the row's touch height): the mark and words stay together in the middle.
        val height = maxOf(drawn, constraints.minHeight)
        val inset = (height - drawn) / 2
        layout(constraints.maxWidth, height) {
            markPlaceable.placeRelative(0, inset + markTop)
            wordsPlaceable.placeRelative(markPlaceable.width + gap, inset + wordsTop)
        }
    }
}

/**
 * What a row's words hold, counted as E5 counts lines: the title (wrapped or not), a value moved under it,
 * and each description. Its layouts write it while they measure, before the mark is placed.
 */
private class RowParts {
    var stacked = false
    var descriptions = 0
    val lines get() = 1 + (if (stacked) 1 else 0) + descriptions
}

/** A row's descriptions, one under another and 1dp under the title, counted for [RowParts]; none take no room. */
@Composable
private fun Descriptions(
    parts: RowParts,
    modifier: Modifier,
    content: @Composable () -> Unit,
) {
    Layout(content, modifier) { measurables, constraints ->
        val gap = 1.dp.roundToPx()
        // A slot child that draws nothing is no description.
        val placeables = measurables.map { it.measure(constraints.copy(minHeight = 0)) }.filter { it.height > 0 }
        parts.descriptions = placeables.size
        val height = placeables.sumOf { it.height + gap }
        layout(placeables.maxOfOrNull { it.width } ?: 0, height) {
            var y = gap
            placeables.forEach {
                it.placeRelative(0, y)
                y += it.height + gap
            }
        }
    }
}

@Composable
private fun TitleAndMeta(
    parts: RowParts,
    metaBusy: Boolean,
    meta: @Composable () -> Unit,
    title: @Composable () -> Unit,
) {
    Layout(
        contents =
            listOf({
                Column(Modifier.layoutPart(LayoutPart.LIST, LayoutPart.Part.Label)) {
                    title()
                }
            }, {
                BusyContent(metaBusy) {
                    Row(
                        Modifier.layoutPart(LayoutPart.LIST, LayoutPart.Part.Value),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) { meta() }
                }
            }),
    ) { (titles, metas), constraints ->
        val width = constraints.maxWidth
        val gap = 12.dp.roundToPx()
        val metaPlaceable = metas.first().measure(Constraints(maxWidth = width))
        val titleMeasurable = titles.first()
        val room = width - metaPlaceable.width - if (metaPlaceable.width > 0) gap else 0
        val beside = metaPlaceable.width == 0 || room >= minOf(titleMeasurable.maxIntrinsicWidth(Constraints.Infinity), width / 2)
        parts.stacked = !beside
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

/** E5: beside three lines or more, a row's mark goes with the first. */
private const val THREE_LINES = 3

/** Main's `gap-3` between a row's mark and its words. */
private val LEADING_GAP = 12.dp

/** Main's `min-h-11` row, raised to Android's 48dp touch target. */
private val MIN_HEIGHT = 48.dp

/** How far the learner's row's `muted` reaches past the words, and how far it stays off the hairlines. */
private val HIGHLIGHT_OUTSET = 10.dp
private val HIGHLIGHT_INSET = 2.dp

/** Main's 11dp above and below a row's words, less the highlight's inset. */
private val WORDS_PADDING = 11.dp - HIGHLIGHT_INSET

private const val DISABLED_ALPHA = 0.5f
