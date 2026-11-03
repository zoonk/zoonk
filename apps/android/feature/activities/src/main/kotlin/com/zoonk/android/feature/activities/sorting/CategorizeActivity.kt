package com.zoonk.android.feature.activities.sorting

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityAnnouncement
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityCanvasHeader
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityReason
import com.zoonk.android.feature.activities.ActivityReasons
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.assignmentPairs
import com.zoonk.android.feature.activities.seededShuffle
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.DropdownMenu
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.richtext.parseRichInline
import com.zoonk.android.ui.richtext.richText
import com.zoonk.android.ui.richtext.toOneLine
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf26FieldsGroupsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf26FieldsItemsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf26Value as CategorizeContent

private typealias Group = PlayableLibraryStepAnyOfContentOneOf26FieldsGroupsInner
private typealias Item = PlayableLibraryStepAnyOfContentOneOf26FieldsItemsInner

val categorizeRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_sorting_badge_sort_groups, R.drawable.ic_category) },
        canvas = { CategorizeActivity(it) },
    )

/**
 * Main's categorize: the cards are dealt one at a time and each goes into a group with a tap or its
 * number key; Undo takes the last one back. Once every card is sorted, a card's menu moves it to
 * another group. The card in hand is always the first one without a group, so it's never stored.
 */
@Composable
private fun CategorizeActivity(props: ActivityProps) {
    val fields = (props.content as CategorizeContent).value.fields
    val groups = fields.groups
    val items = remember(fields) { seededShuffle(fields.items, fields.items.joinToString(" ") { it.id }) }
    val ids = items.map { it.id }
    var placements by rememberSaveable { mutableStateOf(props.answer.assignmentPairs.orEmpty()) }
    var history by rememberSaveable { mutableStateOf(emptyList<String>()) }
    var announcement by remember { mutableStateOf("") }
    val resources = LocalResources.current
    val expected = props.expected.assignmentPairs.takeIf { props.isChecked }
    val unsorted = unplacedItems(items, placements) { it.id }
    val card = unsorted.firstOrNull()
    val sorted = items.size - unsorted.size
    val editable = !props.isChecked && !props.isLocked
    val focus = remember(groups.size, ids) { CategorizeFocus(groups.size, ids) }

    val cardNames = items.associate { it.id to spokenLine(it.text) }
    val groupNames = groups.associate { it.id to spokenLine(it.label) }

    fun place(next: Map<String, String>) {
        placements = next
        props.onAnswerChange(placementsAnswer(ids, next))
    }

    fun sort(group: Group): Boolean {
        // The state as it is now, not as this frame drew it, so two presses in one frame sort two cards.
        val item = unplacedItems(items, placements) { it.id }.firstOrNull()
        if (!editable || item == null) return false
        val next = placements + (item.id to group.id)
        place(next)
        history = history + item.id
        val name = cardNames.getValue(item.id)
        val groupName = groupNames.getValue(group.id)
        val following = unplacedItems(items, next) { it.id }.firstOrNull()
        announcement =
            if (following != null) {
                resources.getString(R.string.activities_sorting_is_in_next, name, groupName, cardNames.getValue(following.id))
            } else {
                // Compose can't move TalkBack's focus to the status line, so the status is said after the card.
                val placed = resources.getString(R.string.activities_sorting_is_in, name, groupName)
                "$placed ${resources.getString(R.string.activities_sorting_all_sorted)}"
            }
        if (following == null && (focus.inGroups || focus.onUndo)) focus.toStatusLine = true
        return true
    }

    fun undo() {
        val last = history.lastOrNull() ?: return
        if (!editable) return
        place(placements - last)
        history = history.dropLast(1)
        announcement = resources.getString(R.string.activities_sorting_took_back, cardNames.getValue(last))
        if (history.isEmpty() && focus.onUndo) focus.groups.first().requestFocus()
    }

    fun move(
        item: Item,
        group: Group,
    ) {
        if (!editable) return
        place(placements + (item.id to group.id))
        announcement = resources.getString(R.string.activities_sorting_is_in, cardNames.getValue(item.id), groupNames.getValue(group.id))
        focus.toMovedRow = item.id
    }

    val sortByKey by rememberUpdatedState { index: Int -> groups.getOrNull(index)?.let(::sort) == true }
    DisposableEffect(props.takeNumberKeys) {
        props.takeNumberKeys { sortByKey(it) }
        onDispose { props.takeNumberKeys(null) }
    }

    ActivityCanvas {
        if (card == null || props.isChecked) {
            if (!props.isChecked) {
                Text(
                    stringResource(R.string.activities_sorting_all_sorted),
                    Modifier.focusRequester(focus.statusLine).focusable(),
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                )
            }
            groups.forEach { group ->
                SortedGroup(group, items.filter { placements[it.id] == group.id }) { item ->
                    if (expected == null) {
                        MovableRow(
                            item = item,
                            others = groups.filter { it.id != group.id },
                            enabled = editable,
                            onMove = { move(item, it) },
                            modifier = Modifier.focusRequester(focus.rows.getValue(item.id)),
                        )
                    } else {
                        val result = if (expected[item.id] == group.id) AnswerResult.Right else AnswerResult.Wrong
                        CheckedRow(item, cardNames.getValue(item.id), result)
                    }
                }
            }
            if (expected != null) CategorizeResults(groups, items, expected, placements)
        } else {
            Text(
                pluralStringResource(R.plurals.activities_sorting_sorted_count, sorted, sorted, items.size),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
            CardInHand(items, card)
            ActivityCanvasHeader(
                readout = {
                    UndoButton(
                        shown = history.isNotEmpty(),
                        enabled = editable,
                        onClick = ::undo,
                        modifier = Modifier.onFocusChanged { focus.onUndo = it.isFocused },
                    )
                },
                itemVerticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(R.string.activities_sorting_which_group),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            Column(
                Modifier.onFocusChanged { focus.inGroups = it.hasFocus },
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                groups.forEachIndexed { index, group ->
                    val inGroup = history.filter { placements[it] == group.id }
                    AnswerOption(
                        marker = index + 1,
                        picked = false,
                        result = null,
                        onClick = { sort(group) },
                        modifier = Modifier.focusRequester(focus.groups[index]),
                        enabled = editable,
                        role = Role.Button,
                    ) {
                        GroupToSort(
                            group = group,
                            latest = inGroup.lastOrNull()?.let { id -> items.first { it.id == id } },
                            others = (inGroup.size - 1).coerceAtLeast(0),
                        )
                    }
                }
            }
        }
    }
    ActivityAnnouncement(announcement)

    LaunchedEffect(focus.toStatusLine) {
        if (focus.toStatusLine) focus.statusLine.requestFocus()
        focus.toStatusLine = false
    }
    LaunchedEffect(focus.toMovedRow) {
        focus.toMovedRow?.let { focus.rows[it]?.requestFocus() }
        focus.toMovedRow = null
    }
}

/**
 * Where keyboard focus goes when what held it leaves the screen: from a group or Undo to the status line once
 * every card is sorted, from Undo to the first group once nothing is left to take back, and to a moved card's row.
 */
private class CategorizeFocus(
    groupCount: Int,
    ids: List<String>,
) {
    val groups = List(groupCount) { FocusRequester() }
    val rows = ids.associateWith { FocusRequester() }
    val statusLine = FocusRequester()
    var inGroups = false
    var onUndo = false
    var toStatusLine by mutableStateOf(false)
    var toMovedRow by mutableStateOf<String?>(null)
}

/** Every card in one box, only the one in hand shown, so the box is as tall as the tallest card and the groups never move. */
@Composable
private fun CardInHand(
    items: List<Item>,
    card: Item,
) {
    val shape = RoundedCornerShape(12.dp)
    Box(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline, shape)
            .padding(16.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        items.forEach { item ->
            RichInlineText(
                item.text,
                if (item.id == card.id) Modifier else Modifier.alpha(0f).clearAndSetSemantics {},
                style = MaterialTheme.typography.titleMedium,
            )
        }
    }
}

/** Undo keeps its room while there's nothing to take back, so it appearing moves nothing. */
@Composable
private fun UndoButton(
    shown: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TextButton(
        onClick = onClick,
        modifier = if (shown) modifier else modifier.alpha(0f).clearAndSetSemantics {},
        enabled = enabled && shown,
    ) {
        Icon(painterResource(R.drawable.ic_undo), contentDescription = null, modifier = Modifier.size(18.dp))
        Text(stringResource(R.string.activities_sorting_undo), Modifier.padding(start = 8.dp))
    }
}

/**
 * A group to sort into: its label and rule, then the card sorted into it last. That row keeps its
 * room while the group is empty, so its first card moves nothing under the thumb.
 */
@Composable
private fun GroupToSort(
    group: Group,
    latest: Item?,
    others: Int,
) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        RichInlineText(group.label, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium))
        RichInlineText(group.rule, style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant))
        Row(
            Modifier.padding(top = 8.dp).clearAndSetSemantics {},
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (latest == null) {
                PreviewChip("", Modifier.alpha(0f))
            } else {
                PreviewChip(latest.text, Modifier.weight(1f, fill = false))
                if (others > 0) PreviewChip(stringResource(R.string.activities_sorting_more_count, others), muted = true)
            }
        }
    }
}

/** A card already in a group, in one line as the card shows it: the full text shows once every card is sorted. */
@Composable
private fun PreviewChip(
    text: String,
    modifier: Modifier = Modifier,
    muted: Boolean = false,
) {
    val shape = RoundedCornerShape(6.dp)
    val style = MaterialTheme.typography.labelMedium
    RichInlineText(
        text,
        modifier
            .clip(shape)
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
            .padding(horizontal = 8.dp, vertical = 3.dp),
        style =
            if (muted) {
                style.withTabularFigures().copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                style.copy(color = MaterialTheme.colorScheme.onSurface)
            },
        maxLines = 1,
    )
}

/** A group once every card is sorted: its label and rule over its cards, no longer a button. */
@Composable
private fun SortedGroup(
    group: Group,
    cards: List<Item>,
    row: @Composable (Item) -> Unit,
) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outline, shape)
            .padding(horizontal = 14.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        RichInlineText(
            group.label,
            Modifier.semantics(mergeDescendants = true) { heading() },
            style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
        )
        RichInlineText(group.rule, style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant))
        if (cards.isEmpty()) {
            Text(
                stringResource(R.string.activities_sorting_no_cards),
                Modifier.padding(top = 10.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        } else {
            val listShape = RoundedCornerShape(8.dp)
            Column(
                Modifier
                    .padding(top = 12.dp)
                    .fillMaxWidth()
                    .clip(listShape)
                    .background(MaterialTheme.colorScheme.surface)
                    .border(1.dp, MaterialTheme.colorScheme.outline, listShape),
            ) {
                cards.forEachIndexed { index, item ->
                    if (index > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    row(item)
                }
            }
        }
    }
}

@Composable
private fun MovableRow(
    item: Item,
    others: List<Group>,
    enabled: Boolean,
    onMove: (Group) -> Unit,
    modifier: Modifier = Modifier,
) {
    var open by remember { mutableStateOf(false) }

    Box {
        CardRow(
            item,
            modifier.clickable(enabled = enabled, role = Role.DropdownList) { open = true },
        ) {
            RowMark(R.drawable.ic_unfold_more, MaterialTheme.colorScheme.onSurfaceVariant)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            Text(
                stringResource(R.string.activities_sorting_move_to),
                Modifier.padding(horizontal = 12.dp, vertical = 8.dp).semantics { heading() },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium,
            )
            others.forEach { group ->
                DropdownMenuItem(
                    text = { RichInlineText(group.label) },
                    onClick = {
                        open = false
                        onMove(group)
                    },
                )
            }
        }
    }
}

@Composable
private fun CheckedRow(
    item: Item,
    spokenName: String,
    result: AnswerResult,
) {
    val right = result == AnswerResult.Right
    val description =
        stringResource(if (right) R.string.activities_sorting_right_group else R.string.activities_sorting_wrong_group, spokenName)

    CardRow(
        item,
        Modifier
            .background(answerTone(picked = false, result = result).container)
            .clearAndSetSemantics { contentDescription = description },
    ) {
        RowMark(
            if (right) R.drawable.ic_check else R.drawable.ic_close,
            if (right) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error,
        )
    }
}

@Composable
private fun CardRow(
    item: Item,
    modifier: Modifier,
    trailing: @Composable () -> Unit,
) {
    Row(
        modifier.fillMaxWidth().heightIn(min = 48.dp).padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RichInlineText(item.text, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        trailing()
    }
}

/** What TalkBack says for a card or a group's label: its words, with its math read out as the card shows it. */
@Composable
private fun spokenLine(text: String): String {
    val line = richText(remember(text) { parseRichInline(toOneLine(text)) })
    return line.spoken ?: line.text.text
}

/** A row's mark at the end, growing with the text as the font gets larger. */
@Composable
private fun RowMark(
    @DrawableRes icon: Int,
    tint: Color,
) {
    Icon(
        painterResource(icon),
        contentDescription = null,
        modifier = Modifier.size(with(LocalDensity.current) { ROW_MARK.toDp() }),
        tint = tint,
    )
}

@Composable
private fun CategorizeResults(
    groups: List<Group>,
    items: List<Item>,
    expected: Map<String, String>,
    placements: Map<String, String>,
) {
    val misplaced = items.filter { placements[it.id] != expected[it.id] }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.activities_sorting_right_count, items.size - misplaced.size, items.size),
            style =
                MaterialTheme.typography.bodyMedium
                    .withTabularFigures()
                    .copy(fontWeight = FontWeight.SemiBold),
        )
        if (misplaced.isNotEmpty()) {
            ActivityReasons {
                misplaced.forEach { item ->
                    ActivityReason(item.why) {
                        RichInlineText(
                            stringResource(
                                R.string.activities_sorting_belongs_in,
                                item.text,
                                groups.firstOrNull { it.id == expected[item.id] }?.label.orEmpty(),
                            ),
                        )
                    }
                }
            }
        }
    }
}

private val ROW_MARK = 16.sp
