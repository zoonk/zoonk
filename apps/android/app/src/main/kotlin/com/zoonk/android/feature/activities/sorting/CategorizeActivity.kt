package com.zoonk.android.feature.activities.sorting

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
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
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityAnnouncement
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityDragDrop
import com.zoonk.android.feature.activities.ActivityDragDropState
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityReason
import com.zoonk.android.feature.activities.ActivityReasons
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.activityDraggable
import com.zoonk.android.feature.activities.activityDropTarget
import com.zoonk.android.feature.activities.assignmentPairs
import com.zoonk.android.feature.activities.rememberActivityDragDrop
import com.zoonk.android.feature.activities.seededShuffle
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
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

@Composable
private fun CategorizeActivity(props: ActivityProps) {
    val fields = (props.content as CategorizeContent).value.fields
    val items = remember(fields) { seededShuffle(fields.items, fields.items.joinToString(" ") { it.id }) }
    val ids = items.map { it.id }
    var placements by rememberSaveable { mutableStateOf(props.answer.assignmentPairs.orEmpty()) }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var announcement by remember { mutableStateOf("") }
    val focus = remember(ids) { ids.associateWith { FocusRequester() } }
    val resources = LocalResources.current
    val expected = props.expected.assignmentPairs.takeIf { props.isChecked }
    val waiting = unplacedItems(items, placements) { it.id }
    val selected = items.firstOrNull { it.id == selectedId }
    val editable = !props.isChecked && !props.isLocked

    fun place(
        itemId: String,
        groupId: String,
    ) {
        val item = items.firstOrNull { it.id == itemId }
        val group = fields.groups.firstOrNull { it.id == groupId }
        if (!editable || item == null || group == null) return
        val next = placements + (itemId to groupId)
        placements = next
        selectedId = null
        props.onAnswerChange(placementsAnswer(ids, next))
        announcement = resources.getQuantityString(R.plurals.activities_sorting_placed, ids.size, item.text, group.label, ids.count { it in next }, ids.size)
        nextUnplacedId(ids, itemId, next)?.let { focus[it]?.requestFocus() }
    }

    val dragDrop = rememberActivityDragDrop(::place)

    @Composable
    fun chip(
        item: Item,
        modifier: Modifier = Modifier,
    ) {
        val result = expected?.let { if (it[item.id] == placements[item.id]) AnswerResult.Right else AnswerResult.Wrong }
        CategorizeChip(
            item = item,
            result = result,
            selected = selectedId == item.id,
            enabled = editable,
            dragDrop = dragDrop,
            actions = fields.groups.map { stringResource(R.string.activities_sorting_put_in, item.text, it.label) to it.id },
            onSelect = { selectedId = if (selectedId == item.id) null else item.id },
            modifier = modifier.focusRequester(focus.getValue(item.id)),
        )
    }

    ActivityDragDrop(dragDrop) {
        ActivityCanvas(gap = 16.dp) {
            if (!props.isChecked) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Bottom) {
                        Text(
                            stringResource(
                                if (waiting.isEmpty()) R.string.activities_sorting_all_sorted else R.string.activities_sorting_to_sort,
                            ),
                            Modifier.weight(1f),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Medium),
                        )
                        Text(
                            pluralStringResource(R.plurals.activities_sorting_sorted_count, items.size, items.size - waiting.size, items.size),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                        )
                    }
                    waiting.chunked(2).forEach { pair ->
                        Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            pair.forEach { chip(it, Modifier.weight(1f).fillMaxHeight()) }
                            if (pair.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                }
            }

            BoxWithConstraints {
                val columns = if (fields.groups.size == 3) (if (maxWidth >= THREE_ACROSS) 3 else 1) else 2
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    fields.groups.chunked(columns).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
                            row.forEach { group ->
                                val inGroup = items.filter { placements[it.id] == group.id }
                                CategorizeGroup(
                                    group = group,
                                    isEmpty = inGroup.isEmpty(),
                                    selectedText = selected?.text?.takeIf { editable },
                                    dragDrop = dragDrop,
                                    onPlace = { selected?.let { place(it.id, group.id) } },
                                    modifier = Modifier.weight(1f),
                                ) {
                                    inGroup.forEach { chip(it) }
                                }
                            }
                            repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
            }

            if (expected != null) CategorizeResults(fields.groups, items, expected, placements)
        }
        ActivityAnnouncement(announcement)
    }
}

@Composable
private fun CategorizeChip(
    item: Item,
    result: AnswerResult?,
    selected: Boolean,
    enabled: Boolean,
    dragDrop: ActivityDragDropState,
    actions: List<Pair<String, String>>,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(12.dp)
    val tone = answerTone(selected, result)
    val label =
        when (result) {
            AnswerResult.Right -> stringResource(R.string.activities_sorting_right_group, item.text)
            AnswerResult.Wrong -> stringResource(R.string.activities_sorting_wrong_group, item.text)
            else -> null
        }

    Row(
        modifier
            .activityDraggable(dragDrop, item.id, enabled, shape, actions)
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .clip(shape)
            .background(if (result == null && !selected) MaterialTheme.colorScheme.surface else tone.container)
            .border(if (result == AnswerResult.Wrong) tone.border.copy(width = 2.dp) else tone.border, shape)
            .selectable(selected = selected, enabled = enabled, role = Role.Button, onClick = onSelect)
            .then(if (label == null) Modifier else Modifier.semantics { contentDescription = label })
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val style = MaterialTheme.typography.bodyMedium
        RichText(
            item.text,
            Modifier.weight(1f),
            style = if (selected || result == AnswerResult.Wrong) style.copy(fontWeight = FontWeight.Medium) else style,
        )
        result?.let { ResultIcon(it) }
    }
}

@Composable
private fun ResultIcon(result: AnswerResult) {
    val right = result == AnswerResult.Right
    Icon(
        painterResource(if (right) R.drawable.ic_check else R.drawable.ic_close),
        contentDescription = null,
        modifier = Modifier.size(16.dp),
        tint = if (right) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error,
    )
}

@Composable
private fun CategorizeGroup(
    group: Group,
    isEmpty: Boolean,
    selectedText: String?,
    dragDrop: ActivityDragDropState,
    onPlace: () -> Unit,
    modifier: Modifier = Modifier,
    chips: @Composable () -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    val accent = MaterialTheme.zoonk.vizAccent
    val canPlace = selectedText != null
    val isOver = dragDrop.overId == group.id
    val ring =
        when {
            isOver -> accent
            canPlace -> accent.copy(alpha = SOFT_RING)
            else -> null
        }
    val putLabel = selectedText?.let { stringResource(R.string.activities_sorting_put_in, it, group.label) }

    Column(
        modifier
            .activityDropTarget(dragDrop, group.id)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .then(if (ring == null) Modifier else Modifier.border(2.dp, ring, shape))
            .clickable(enabled = canPlace, role = Role.Button, onClick = onPlace)
            .semantics { if (putLabel != null) contentDescription = putLabel }
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Column(Modifier.heightIn(min = 48.dp).padding(horizontal = 6.dp, vertical = 4.dp)) {
            RichText(
                group.label,
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
            )
            RichText(group.rule, style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant))
        }
        if (isEmpty) EmptyGroupHint(canPlace) else Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { chips() }
    }
}

@Composable
private fun EmptyGroupHint(canPlace: Boolean) {
    val color = if (canPlace) MaterialTheme.zoonk.vizAccent else MaterialTheme.colorScheme.outline
    Box(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .dashedOutline(color)
            .clearAndSetSemantics {}
            .padding(horizontal = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            stringResource(if (canPlace) R.string.activities_sorting_put_it_here else R.string.activities_sorting_nothing_here),
            color = if (canPlace) MaterialTheme.zoonk.vizAccent else MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelSmall,
        )
    }
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
                        Text(
                            stringResource(
                                R.string.activities_sorting_belongs_in,
                                item.text,
                                groups
                                    .firstOrNull {
                                        it.id ==
                                            expected[item.id]
                                    }?.label
                                    .orEmpty(),
                            ),
                        )
                    }
                }
            }
        }
    }
}

private val THREE_ACROSS = 480.dp
private const val SOFT_RING = 0.4f
