package com.zoonk.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonkType
import kotlin.math.ceil
import kotlin.math.floor

/** The one chart point a page shows a tooltip for, so opening another point's closes the last. */
@Stable
class ChartInspector {
    private var point by mutableStateOf<Pair<Any, Int>?>(null)

    internal var area: LayoutCoordinates? = null

    /** The inspected point's index when it is one of [chart]'s. */
    fun indexIn(chart: Any): Int? = point?.takeIf { it.first === chart }?.second

    fun inspect(
        chart: Any,
        index: Int,
    ) {
        point = chart to index
    }

    fun close() {
        point = null
    }
}

/**
 * The part of the page [inspector]'s tooltips stay inside, such as the page under its top app bar.
 * A tap anywhere in it closes the tooltip. It sees the tap before the point under the finger does, so
 * a tap on another point moves the tooltip there, and a drag is left to scrolling.
 */
fun Modifier.holdsChartTooltips(inspector: ChartInspector): Modifier =
    onPlaced { inspector.area = it }.pointerInput(inspector) {
        awaitEachGesture {
            awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
            if (waitForUpOrCancellation(PointerEventPass.Initial) != null) inspector.close()
        }
    }

/** Main's `ChartTooltipContent`: a point's name or date, its value and at most one quiet note. */
@Composable
fun ChartTooltip(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    note: String? = null,
) {
    val shape = RoundedCornerShape(ZoonkRadius.md)

    Column(
        modifier
            .shadow(SHADOW, shape)
            .background(MaterialTheme.colorScheme.surfaceContainer, shape)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.zoonkType.data)
        Text(value, style = MaterialTheme.typography.bodyMedium.withTabularFigures(), fontWeight = FontWeight.Medium)
        note?.let {
            Text(
                it,
                modifier = Modifier.widthIn(max = NOTE_WIDTH),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

/**
 * [tooltip] beside the chart point whose bounds [anchor] gives from this layout's start edge, hidden
 * while it gives `null` or the point is outside the part of the page [inspector]'s [holdsChartTooltips]
 * area shows: above the point, below it when that doesn't fit, beside it when neither does, and never
 * past the layout's sides or out of that part of the page. With [riseAbove] it may cover what comes
 * before the chart, which draws under it. It takes no touches and TalkBack skips it, since the points
 * say their own detail.
 */
@Composable
fun ChartTooltipArea(
    tooltip: (@Composable () -> Unit)?,
    anchor: Density.(area: IntSize) -> IntRect?,
    inspector: ChartInspector,
    modifier: Modifier = Modifier,
    riseAbove: Boolean = false,
    content: @Composable () -> Unit,
) {
    var shown by remember { mutableStateOf<IntRange?>(null) }

    Layout(
        content = {
            Box { content() }
            tooltip?.let { Box(Modifier.clearAndSetSemantics {}) { it() } }
        },
        modifier = modifier.onGloballyPositioned { shown = inspector.shownRows(it) },
    ) { measurables, constraints ->
        val chart = measurables.first().measure(constraints)
        val area = IntSize(chart.width, chart.height)
        val card = measurables.getOrNull(1)?.measure(Constraints(maxWidth = area.width))
        val gap = GAP.roundToPx()

        layout(area.width, area.height) {
            chart.place(0, 0)
            val point = card?.let { anchor(area) } ?: return@layout
            val top = if (riseAbove) Int.MIN_VALUE else 0
            val room = shown?.let { maxOf(top, it.first)..minOf(area.height, it.last) } ?: 0..area.height
            val offset = tooltipOffset(point, IntSize(card.width, card.height), area.width, room, gap) ?: return@layout
            card.placeRelative(offset, zIndex = 1f)
        }
    }
}

/** The rows of [layout] that [ChartInspector.area] shows, in [layout]'s own coordinates. */
private fun ChartInspector.shownRows(layout: LayoutCoordinates): IntRange? {
    val page = area?.takeIf { it.isAttached } ?: return null
    val shown = layout.localBoundingBoxOf(page, clipBounds = false)
    return ceil(shown.top).toInt()..floor(shown.bottom).toInt()
}

/**
 * Where a [card] goes beside [point] in a layout [width] wide, kept within the rows of [room], or
 * `null` when [point] is outside them or the layout's sides.
 */
internal fun tooltipOffset(
    point: IntRect,
    card: IntSize,
    width: Int,
    room: IntRange,
    gap: Int,
): IntOffset? {
    if (point.bottom <= room.first || point.top >= room.last || point.right <= 0 || point.left >= width) return null

    val centered = (point.center.x - card.width / 2).coerceIn(0, (width - card.width).coerceAtLeast(0))
    val lowest = (room.last - card.height).coerceAtLeast(room.first)
    val above = point.top - gap - card.height
    val below = point.bottom + gap
    val after = point.right + gap
    val before = point.left - gap - card.width
    val beside = (point.center.y - card.height / 2).coerceIn(room.first, lowest)

    return when {
        above >= room.first -> IntOffset(centered, above)
        below + card.height <= room.last -> IntOffset(centered, below)
        after + card.width <= width -> IntOffset(after, beside)
        before >= 0 -> IntOffset(before, beside)
        else -> IntOffset(centered, above.coerceIn(room.first, lowest))
    }
}

private val GAP = 8.dp
private val SHADOW = 4.dp
private val NOTE_WIDTH = 224.dp
