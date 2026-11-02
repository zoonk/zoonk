package com.zoonk.android.feature.activities

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.CollectionInfo
import androidx.compose.ui.semantics.CollectionItemInfo
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.collectionInfo
import androidx.compose.ui.semantics.collectionItemInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.zoonk.android.R
import kotlin.math.abs

data class SortableItem(
    val id: String,
    val label: String,
)

/**
 * Main's `ActivitySortableList`: rows the learner puts in order. A finger holds a row to lift it
 * and a mouse drags it. With a keyboard, Space or Enter lifts the focused row, the arrows move it,
 * Space or Enter drops it and Escape puts it back. TalkBack moves a row with its actions.
 */
@Composable
fun ActivitySortableList(
    items: List<SortableItem>,
    label: String,
    onReorder: (List<String>) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    row: @Composable RowScope.(SortableItem, Int) -> Unit,
) {
    val resources = LocalResources.current
    val haptics = LocalHapticFeedback.current
    val gap = with(LocalDensity.current) { GAP.toPx() }
    val tops = remember { HashMap<String, Float>() }
    val heights = remember { HashMap<String, Float>() }
    var dragged by remember { mutableStateOf<String?>(null) }
    var grab by remember { mutableFloatStateOf(0f) }
    var dragOffset by remember { mutableFloatStateOf(0f) }
    var keyed by remember { mutableStateOf<KeyboardMove?>(null) }
    var announcement by remember { mutableStateOf("") }
    val ids = items.map { it.id }
    val labelOf = { id: String -> items.firstOrNull { it.id == id }?.label.orEmpty() }

    fun target(): Int? {
        val id = dragged ?: return null
        val center = (tops[id] ?: return null) + (heights[id] ?: 0f) / 2 + dragOffset
        return ids.indices.minByOrNull { abs((tops[ids[it]] ?: 0f) + (heights[ids[it]] ?: 0f) / 2 - center) }
    }

    fun drop(
        id: String,
        to: Int,
    ) {
        val from = ids.indexOf(id)
        if (from != to) onReorder(ids.toMutableList().apply { add(to, removeAt(from)) })
        announcement = resources.getString(R.string.activities_sortable_dropped, labelOf(id), to + 1)
    }

    fun onKey(
        id: String,
        event: KeyEvent,
    ): Boolean {
        val move = keyed
        if (event.type != KeyEventType.KeyDown || (move != null && move.id != id)) return false
        when {
            move == null -> {
                if (event.key !in LIFT_KEYS) return false
                keyed = KeyboardMove(id, ids)
                announcement = resources.getString(R.string.activities_sortable_picked_up, labelOf(id), ids.indexOf(id) + 1)
            }

            event.key in LIFT_KEYS -> {
                keyed = null
                drop(id, move.order.indexOf(id))
            }

            event.key == Key.Escape -> {
                keyed = null
                announcement = resources.getString(R.string.activities_sortable_stopped, labelOf(id))
            }

            event.key == Key.DirectionUp || event.key == Key.DirectionDown -> {
                val at = move.order.indexOf(id)
                val next = (at + if (event.key == Key.DirectionUp) -1 else 1).coerceIn(0, ids.lastIndex)
                keyed = move.copy(order = move.order.toMutableList().apply { add(next, removeAt(at)) })
                announcement = resources.getString(R.string.activities_sortable_over, labelOf(id), next + 1)
            }

            else -> {
                return false
            }
        }
        return true
    }

    val dragTarget = target()
    val draggedFrom = dragged?.let(ids::indexOf) ?: -1
    val room = (dragged?.let(heights::get) ?: 0f) + gap

    Box(modifier) {
        Column(
            Modifier.semantics {
                contentDescription = label
                collectionInfo = CollectionInfo(rowCount = items.size, columnCount = 1)
            },
            verticalArrangement = Arrangement.spacedBy(GAP),
        ) {
            (keyed?.order ?: ids).forEachIndexed { index, id ->
                val item = items.firstOrNull { it.id == id } ?: return@forEachIndexed
                key(id) {
                    val from = ids.indexOf(id)
                    val shift =
                        when {
                            dragTarget == null || id == dragged -> 0f
                            from in (draggedFrom + 1)..dragTarget -> -room
                            from in dragTarget until draggedFrom -> room
                            else -> 0f
                        }
                    val shown by animateFloatAsState(shift, if (dragged == null) snap() else tween(SHIFT_MILLIS), label = "shift")
                    val lifted = id == dragged || keyed?.id == id
                    var focused by remember { mutableStateOf(false) }
                    val moves =
                        listOfNotNull(
                            CustomAccessibilityAction(resources.getString(R.string.activities_sortable_move_up)) {
                                true.also { drop(id, index - 1) }
                            }.takeIf { index > 0 },
                            CustomAccessibilityAction(resources.getString(R.string.activities_sortable_move_down)) {
                                true.also { drop(id, index + 1) }
                            }.takeIf { index < ids.lastIndex },
                        )
                    val handling =
                        if (enabled) {
                            Modifier
                                .pointerInput(id, ids) {
                                    detectLift(
                                        onLift = {
                                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                            grab = it.y
                                            dragOffset = 0f
                                            dragged = id
                                        },
                                        onMove = { dragOffset = it.y - grab },
                                        onEnd = { drops ->
                                            val to = target()
                                            dragged = null
                                            dragOffset = 0f
                                            if (drops && to != null) drop(id, to)
                                        },
                                    )
                                }.onFocusChanged {
                                    focused = it.isFocused
                                    if (!it.isFocused && keyed?.id == id) keyed = null
                                }.onKeyEvent { onKey(id, it) }
                                .focusable()
                        } else {
                            Modifier
                        }

                    SortableRow(
                        lifted = lifted,
                        focused = focused,
                        enabled = enabled,
                        modifier =
                            Modifier
                                .onGloballyPositioned {
                                    tops[id] = it.positionInParent().y
                                    heights[id] = it.size.height.toFloat()
                                }.then(handling)
                                .zIndex(if (lifted) 1f else 0f)
                                .graphicsLayer { translationY = if (id == dragged) dragOffset else shown }
                                .semantics(mergeDescendants = true) {
                                    collectionItemInfo = CollectionItemInfo(index, 1, 0, 1)
                                    if (enabled) customActions = moves
                                },
                    ) { row(item, index) }
                }
            }
        }
        ActivityAnnouncement(announcement)
    }
}

private data class KeyboardMove(
    val id: String,
    val order: List<String>,
)

@Composable
private fun SortableRow(
    lifted: Boolean,
    focused: Boolean,
    enabled: Boolean,
    modifier: Modifier,
    content: @Composable RowScope.() -> Unit,
) {
    val shape = RoundedCornerShape(12.dp)
    val colors = MaterialTheme.colorScheme

    Row(
        modifier
            .fillMaxWidth()
            .graphicsLayer {
                shadowElevation = if (lifted) LIFTED_ELEVATION.toPx() else 0f
                this.shape = shape
            }.clip(shape)
            .background(if (lifted) colors.surface else Color.Transparent)
            .border(if (lifted || focused) 2.dp else 1.dp, if (lifted || focused) colors.primary else colors.outline, shape)
            .heightIn(min = 48.dp)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        if (enabled) {
            Box(Modifier.heightIn(min = 32.dp), contentAlignment = Alignment.Center) {
                Icon(
                    painterResource(R.drawable.ic_drag_indicator),
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = colors.onSurfaceVariant,
                )
            }
        }
        content()
    }
}

private val GAP = 8.dp
private val LIFT_KEYS = setOf(Key.Spacebar, Key.Enter, Key.NumPadEnter, Key.DirectionCenter)
private const val SHIFT_MILLIS = 150
