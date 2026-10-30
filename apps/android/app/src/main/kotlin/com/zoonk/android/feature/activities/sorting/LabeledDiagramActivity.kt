package com.zoonk.android.feature.activities.sorting

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityAnnouncement
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityCanvasLabel
import com.zoonk.android.feature.activities.ActivityDragDrop
import com.zoonk.android.feature.activities.ActivityDragDropState
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.activityDraggable
import com.zoonk.android.feature.activities.activityDropTarget
import com.zoonk.android.feature.activities.assignmentPairs
import com.zoonk.android.feature.activities.rememberActivityDragDrop
import com.zoonk.android.feature.activities.seededShuffle
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf11Value as LabeledDiagramContent

val labeledDiagramRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_sorting_badge_label_it, R.drawable.ic_sell) },
        canvas = { LabeledDiagramActivity(it) },
    )

private enum class SpotState { Empty, Filled, Active, Right, Wrong }

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun LabeledDiagramActivity(props: ActivityProps) {
    val fields = (props.content as LabeledDiagramContent).value.fields
    val slots = remember(fields) { diagramSlots(fields.parts.map { it.label }) }
    val names =
        remember(fields) { seededShuffle(fields.parts.map { it.label } + fields.distractors, fields.parts.joinToString(",") { it.part }) }
    var placements by rememberSaveable { mutableStateOf(props.answer.assignmentPairs.orEmpty()) }
    var activeKey by rememberSaveable { mutableStateOf(nextEmptySlot(slots, null, placements)) }
    var announcement by remember { mutableStateOf("") }
    val focus = remember(names) { names.associateWith { FocusRequester() } }
    val resources = LocalResources.current
    val editable = !props.isChecked && !props.isLocked
    val active = slots.firstOrNull { it.key == activeKey }?.takeIf { !props.isChecked }
    val mixUps = fields.mixUps.map { it.feedback to it.labels }

    fun update(
        next: Map<String, String>,
        after: String?,
    ) {
        placements = next
        activeKey = nextEmptySlot(slots, after, next)
        props.onAnswerChange(diagramAnswer(slots, next))
    }

    fun place(
        name: String,
        key: String,
    ) {
        if (!editable || slots.none { it.key == key }) return
        val bank = unplacedNames(names, placements)
        update(placeName(placements, key, name), key)
        announcement = resources.getString(R.string.activities_sorting_name_on_spot, name, key)
        val at = bank.indexOf(name)
        (bank.getOrNull(at + 1) ?: bank.getOrNull(at - 1))?.let { focus[it]?.requestFocus() }
    }

    fun select(key: String) {
        if (!editable) return
        val name = placements[key]
        activeKey = key
        if (name == null) return
        val next = placements - key
        placements = next
        props.onAnswerChange(diagramAnswer(slots, next))
        announcement = resources.getString(R.string.activities_sorting_name_taken_off, name)
    }

    val dragDrop = rememberActivityDragDrop { name, target -> place(name, target) }

    ActivityDragDrop(dragDrop) {
        ActivityCanvas(gap = 16.dp) {
            val bank = unplacedNames(names, placements)
            if (!props.isChecked && bank.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ActivityCanvasLabel(
                        active?.let { stringResource(R.string.activities_sorting_tap_a_name, it.number) }
                            ?: stringResource(R.string.activities_sorting_every_spot_named),
                    )
                    val namesLabel = stringResource(R.string.activities_sorting_names)
                    FlowRow(
                        Modifier.semantics { contentDescription = namesLabel },
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        bank.forEach { name ->
                            NameChip(
                                name = name,
                                activeNumber = active?.number,
                                enabled = editable,
                                dragDrop = dragDrop,
                                actions = slots.map { stringResource(R.string.activities_sorting_put_on_spot, name, it.number) to it.key },
                                onPlace = { active?.let { place(name, it.key) } },
                                modifier = Modifier.focusRequester(focus.getValue(name)),
                            )
                        }
                    }
                }
            }

            val spotsLabel = stringResource(R.string.activities_sorting_spots_to_label)
            Column(Modifier.semantics { contentDescription = spotsLabel }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                slots.forEach { slot ->
                    if (props.isChecked) {
                        CheckedSlot(slot, placements[slot.key], mixUpFeedback(slot.label, placements[slot.key], mixUps))
                    } else {
                        SlotButton(
                            slot = slot,
                            name = placements[slot.key],
                            isActive = active?.key == slot.key,
                            enabled = editable,
                            dragDrop = dragDrop,
                            onSelect = { select(slot.key) },
                        )
                    }
                }
            }
        }
        ActivityAnnouncement(announcement)
    }
}

@Composable
private fun NameChip(
    name: String,
    activeNumber: Int?,
    enabled: Boolean,
    dragDrop: ActivityDragDropState,
    actions: List<Pair<String, String>>,
    onPlace: () -> Unit,
    modifier: Modifier,
) {
    val label = activeNumber?.let { stringResource(R.string.activities_sorting_put_on_spot, name, it) } ?: name
    val colors = MaterialTheme.colorScheme
    val placeable = activeNumber != null
    Row(
        modifier
            .activityDraggable(dragDrop, name, enabled, CircleShape, actions)
            .heightIn(min = 48.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, if (placeable) colors.outline else colors.outlineVariant, CircleShape)
            .clickable(enabled = enabled && placeable, role = Role.Button, onClick = onPlace)
            .semantics { contentDescription = label }
            .padding(start = 10.dp, end = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            painterResource(R.drawable.ic_drag_indicator),
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            name,
            color = if (placeable) colors.onSurface else colors.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
        )
    }
}

@Composable
private fun SlotButton(
    slot: DiagramSlot,
    name: String?,
    isActive: Boolean,
    enabled: Boolean,
    dragDrop: ActivityDragDropState,
    onSelect: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val accent = MaterialTheme.zoonk.vizAccent
    val shape = RoundedCornerShape(12.dp)
    val isOver = dragDrop.overId == slot.key
    val label =
        if (name == null) {
            stringResource(R.string.activities_sorting_spot_empty, slot.number)
        } else {
            stringResource(R.string.activities_sorting_spot_named, slot.number, name)
        }

    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .activityDropTarget(dragDrop, slot.key, enabled)
            .clip(shape)
            .background(
                when {
                    isActive -> accent.copy(alpha = SOFT)
                    name != null -> colors.surface
                    else -> Color.Transparent
                },
            ).then(
                when {
                    isActive || isOver -> Modifier.border(2.dp, accent, shape)
                    name == null -> Modifier.dashedOutline(colors.outline)
                    else -> Modifier.border(1.dp, colors.outline, shape)
                },
            ).selectable(selected = isActive, enabled = enabled, role = Role.Button, onClick = onSelect)
            .semantics { contentDescription = label }
            .padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SpotNumber(
            slot.number,
            if (isActive) {
                SpotState.Active
            } else if (name == null) {
                SpotState.Empty
            } else {
                SpotState.Filled
            },
        )
        if (name != null) {
            Text(name, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
            Icon(
                painterResource(R.drawable.ic_close),
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = colors.onSurfaceVariant,
            )
        } else if (isActive) {
            Text(
                stringResource(R.string.activities_sorting_pick_a_name),
                color = colors.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CheckedSlot(
    slot: DiagramSlot,
    name: String?,
    mixUp: String?,
) {
    val colors = MaterialTheme.colorScheme
    val right = name == slot.label
    val shape = RoundedCornerShape(12.dp)
    val description =
        if (right) {
            stringResource(R.string.activities_sorting_spot_named, slot.number, slot.label)
        } else {
            listOf(
                stringResource(R.string.activities_sorting_spot_named, slot.number, name.orEmpty()),
                stringResource(R.string.activities_sorting_correct_answer, slot.label),
            ).joinToString(". ")
        }

    Column(
        Modifier
            .fillMaxWidth()
            .background(if (right) colors.tertiaryContainer else colors.errorContainer, shape)
            .border(1.dp, if (right) colors.tertiary else colors.error, shape)
            .semantics(mergeDescendants = true) {}
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        FlowRow(
            Modifier.clearAndSetSemantics { contentDescription = description },
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            itemVerticalAlignment = Alignment.CenterVertically,
        ) {
            SpotNumber(slot.number, if (right) SpotState.Right else SpotState.Wrong)
            if (right) {
                Text(slot.label, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
                Icon(
                    painterResource(R.drawable.ic_check),
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = colors.tertiary,
                )
            } else {
                name?.let {
                    Text(
                        it,
                        color = colors.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium.copy(textDecoration = TextDecoration.LineThrough),
                    )
                }
                Text(
                    slot.label,
                    color = colors.onTertiaryContainer,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                )
            }
        }
        mixUp?.let {
            Text(it, Modifier.padding(start = 36.dp), color = colors.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun SpotNumber(
    number: Int,
    state: SpotState,
) {
    val colors = MaterialTheme.colorScheme
    val accent = MaterialTheme.zoonk.vizAccent
    val (fill, ink) =
        when (state) {
            SpotState.Empty -> colors.surface to colors.onSurface
            SpotState.Filled -> colors.onSurface to colors.surface
            SpotState.Active -> accent to colors.surface
            SpotState.Right -> colors.tertiary to colors.onTertiary
            SpotState.Wrong -> colors.error to colors.onError
        }
    Box(
        Modifier
            .defaultMinSize(SPOT, SPOT)
            .background(fill, CircleShape)
            .then(
                if (state ==
                    SpotState.Empty
                ) {
                    Modifier.border(2.dp, colors.onSurface.copy(alpha = EMPTY_RING), CircleShape)
                } else {
                    Modifier
                },
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "$number",
            Modifier.padding(horizontal = 4.dp),
            color = ink,
            style =
                MaterialTheme.typography.labelSmall
                    .withTabularFigures()
                    .copy(fontWeight = FontWeight.SemiBold),
        )
    }
}

private const val SOFT = 0.16f
private const val EMPTY_RING = 0.7f
private val SPOT = 24.dp
