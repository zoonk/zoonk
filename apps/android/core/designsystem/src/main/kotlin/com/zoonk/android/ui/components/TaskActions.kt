package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.layout.MeasurePolicy
import androidx.compose.ui.layout.MeasureResult
import androidx.compose.ui.layout.MeasureScope
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.ParentDataModifierNode
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.ui.scaffold.BAR_GAP
import com.zoonk.android.ui.scaffold.isOnBookPage
import com.zoonk.android.ui.scaffold.spreadShows
import com.zoonk.android.ui.scaffold.windowAdaptiveInfo

/**
 * Main's `TaskActionBar`: as wide as the task's column ([taskColumn]) on a narrow layout, across it on a wide one
 * ([isWideLayout]), its lines at the end. A spread docks it on the page after its split, where it
 * leans toward the split as that page's column does, so it stays under what it acts on.
 */
@Composable
fun TaskActionBar(content: @Composable ColumnScope.() -> Unit) {
    val wide = isWideLayout()
    Box(Modifier.fillMaxWidth(), contentAlignment = if (spreadShows()) Alignment.TopStart else Alignment.Center) {
        CompositionLocalProvider(LocalButtonSize provides ButtonSize.Large) {
            Column(
                if (wide) Modifier.fillMaxWidth() else Modifier.taskBarColumn(),
                verticalArrangement = Arrangement.spacedBy(BAR_GAP),
                horizontalAlignment = if (wide) Alignment.End else Alignment.Start,
                content = content,
            )
        }
    }
}

/**
 * Main's `TaskActions` (`BottomBarActions`, `bar-actions`): [back] at the start and the main action after the others, followed
 * only by the buddy's ask. On a phone or a book's page the buttons share a line while their one-line labels fit beside a main
 * action at least half the line wide, the main action taking what the others leave, and once they don't, each takes a line of
 * its own at the bar's full width, the main one last, so a label never wraps to stay beside another and the main action is
 * never the smaller one. A button drawn as a glyph alone (the way back, the buddy's ask) is
 * as wide as it is tall and keeps that size, as main's `icon` buttons do. Where the bar has room (a tablet, a tablet's page
 * in a spread, a wide window), each keeps its own width, [back] at the start and the rest at the end, the main action at
 * least [MAIN_ACTION_WIDTH]. The bar's measured width decides, never the window's.
 */
@Composable
fun TaskActions(
    back: (@Composable () -> Unit)? = null,
    content: @Composable (main: Modifier) -> Unit,
) {
    CompositionLocalProvider(LocalInTaskActions provides true) {
        Layout(
            content = {
                if (back != null) Box(Modifier.barItem(BarRole.Start), propagateMinConstraints = true) { back() }
                content(Modifier.barItem(BarRole.Main))
            },
            modifier = Modifier.fillMaxWidth(),
            measurePolicy = BarActionsPolicy,
        )
    }
}

/** How [TaskActions] lays out one of its buttons; a button with none is one of the others. */
private enum class BarRole { Start, Main, OwnLine }

/** Adds [role] to the ones a button already has, so the main action can also take a line of its own ([taskOption]). */
private fun Modifier.barItem(role: BarRole): Modifier = this then BarItemElement(role)

private data class BarItemElement(
    val role: BarRole,
) : ModifierNodeElement<BarItemNode>() {
    override fun create() = BarItemNode(role)

    override fun update(node: BarItemNode) {
        node.role = role
    }
}

private class BarItemNode(
    var role: BarRole,
) : Modifier.Node(),
    ParentDataModifierNode {
    override fun Density.modifyParentData(parentData: Any?): Any = (parentData as? Set<*>).orEmpty() + role
}

private object BarActionsPolicy : MeasurePolicy {
    override fun MeasureScope.measure(
        measurables: List<Measurable>,
        constraints: Constraints,
    ): MeasureResult {
        val width = constraints.maxWidth
        val gap = BAR_GAP.roundToPx()
        val roomy = isRoomyBar(width.toDp())
        val mainMin = if (roomy) MAIN_ACTION_WIDTH.roundToPx() else 0
        val slots =
            measurables.map { measurable ->
                val roles = (measurable.parentData as? Set<*>).orEmpty()
                val main = BarRole.Main in roles
                val label = measurable.maxIntrinsicWidth(Constraints.Infinity)
                val oneLine = (if (main) maxOf(label, mainMin) else label).coerceAtMost(width)
                BarSlot(
                    oneLine = oneLine,
                    main = main,
                    glyph = !main && oneLine <= measurable.minIntrinsicHeight(oneLine),
                    ownLine = BarRole.OwnLine in roles,
                    start = BarRole.Start in roles,
                )
            }
        val lines = barLines(slots, width, gap, roomy)
        val placed =
            lines.map { line ->
                line.map { (index, size) -> measurables[index].measure(Constraints(minWidth = size, maxWidth = size)) }
            }
        val heights = placed.map { line -> line.maxOf { it.height } }

        return layout(width, heights.sum() + gap * (lines.size - 1).coerceAtLeast(0)) {
            var y = 0
            lines.forEachIndexed { index, line ->
                val row = placed[index]
                // Where the bar has room, the way back holds the start and the rest end on the bar's end.
                val starts = if (roomy) line.takeWhile { (slot) -> slots[slot].start }.size else row.size
                var x = 0
                row.forEachIndexed { at, placeable ->
                    if (at == starts) x = width - row.drop(at).sumOf { it.width } - gap * (row.size - at - 1)
                    placeable.placeRelative(x, y + (heights[index] - placeable.height) / 2)
                    x += placeable.width + gap
                }
                y += heights[index] + gap
            }
        }
    }
}

/**
 * A button in a [TaskActions] row: its label's width on one line ([oneLine]), whether it's the main action, a glyph alone that
 * keeps its size, one that takes a line of its own on a phone ([taskOption]), or the way back that holds the start.
 */
internal data class BarSlot(
    val oneLine: Int,
    val main: Boolean = false,
    val glyph: Boolean = false,
    val ownLine: Boolean = false,
    val start: Boolean = false,
)

/**
 * The lines of a [TaskActions] row [width] wide, each its buttons' indexes in [slots] and widths. A button joins the line
 * before it while all their one-line labels fit, [gap] apart. Where the bar has room ([roomy]), each keeps its own width.
 * On a phone, the main action takes what the others on its line leave, and at least half the line; on a line without it
 * the labeled buttons share what's left equally (main's `grow`), so one alone fills its line; a glyph keeps its size.
 */
internal fun barLines(
    slots: List<BarSlot>,
    width: Int,
    gap: Int,
    roomy: Boolean,
): List<List<Pair<Int, Int>>> {
    val half = if (roomy) 0 else (width - gap + 1) / 2
    val fit = { slot: BarSlot -> if (slot.main) maxOf(slot.oneLine, half) else slot.oneLine }
    // The glyphs after the main action (the buddy's ask) stay on its line, so it keeps their room.
    val after = { index: Int -> slots.drop(index + 1).takeWhile { it.glyph }.sumOf { it.oneLine + gap } }
    val lines = mutableListOf<MutableList<Int>>()
    slots.forEachIndexed { index, slot ->
        val line = lines.lastOrNull()
        val alone = !roomy && (slot.ownLine || line?.any { slots[it].ownLine } == true)
        val needs = fit(slot) + if (slot.main) after(index) else 0
        if (line != null && !alone &&
            line.sumOf { fit(slots[it]) + gap } + needs <= width
        ) {
            line.add(index)
        } else {
            lines.add(mutableListOf(index))
        }
    }
    return lines.map { line ->
        val left = width - line.sumOf { fit(slots[it]) } - gap * (line.size - 1)
        val main = line.firstOrNull { slots[it].main }
        val growing = line.count { !slots[it].glyph }
        var rest = if (growing > 0) left % growing else 0
        line.map { index ->
            val slot = slots[index]
            val extra =
                when {
                    roomy || slot.glyph -> 0
                    main != null -> if (index == main) left else 0
                    else -> left / growing + if (rest-- > 0) 1 else 0
                }
            index to fit(slot) + extra
        }
    }
}

/** True inside a [TaskActions], which lays out a [taskOption] itself. */
private val LocalInTaskActions = compositionLocalOf { false }

/**
 * Main's `TASK_OPTION_CLASS` and `max-lg:basis-full`: a button on a line of its own at the bar's full width on a phone, whatever
 * its label, and at its own width where the bar has room. Outside a [TaskActions] it fills its line on a narrow layout
 * ([isWideLayout]).
 */
@Composable
fun Modifier.taskOption(): Modifier =
    when {
        LocalInTaskActions.current -> barItem(BarRole.OwnLine)
        isWideLayout() -> this
        else -> fillMaxWidth()
    }

/**
 * Main's `lg` for a task: an expanded window, where its actions line up at its end and what a phone
 * shows a step at a time shows at once, except on a book's page ([isOnBookPage]), which lays out as on a phone.
 */
@Composable
fun isWideLayout(): Boolean =
    windowAdaptiveInfo().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND) && !isOnBookPage()

/** Main's `TASK_COLUMN_CLASS`: a task's one column, centered at a readable measure with the same sides at every width. */
fun Modifier.taskColumn(): Modifier = widthIn(max = TASK_COLUMN_WIDTH).fillMaxWidth().padding(horizontal = TASK_MARGIN)

/** [taskColumn] in a task's bottom bar, which keeps the column's sides itself: as wide as what the column holds. */
fun Modifier.taskBarColumn(): Modifier = widthIn(max = TASK_COLUMN_WIDTH - TASK_MARGIN * 2).fillMaxWidth()

internal val TASK_COLUMN_WIDTH = 640.dp
internal val TASK_MARGIN = 16.dp
private val MAIN_ACTION_WIDTH = 160.dp

/** Whether a bar [width] wide has room for its main action at its end at its own width: wider than any phone's or book page's bar (about 400dp), narrower than a tablet's page in a spread. */
internal fun isRoomyBar(width: Dp): Boolean = width >= ROOMY_BAR_WIDTH

private val ROOMY_BAR_WIDTH = 480.dp
