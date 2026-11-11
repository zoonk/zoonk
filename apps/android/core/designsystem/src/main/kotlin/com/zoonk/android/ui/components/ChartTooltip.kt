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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
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

/** The one chart point a page shows a tooltip for, so opening another point's closes the last. */
@Stable
class ChartInspector {
    private var point by mutableStateOf<Pair<Any, Int>?>(null)

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
 * Closes [inspector]'s tooltip on a tap anywhere in this layout. It sees the tap before the point
 * under the finger does, so a tap on another point moves the tooltip there, and a drag is left to
 * scrolling.
 */
fun Modifier.closesChartTooltip(inspector: ChartInspector): Modifier =
    pointerInput(inspector) {
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
 * while it gives `null` for a point scrolled out of view: above the point, below it when that doesn't
 * fit, beside it when neither does, and never past the layout's sides. With [riseAbove] it may cover
 * what comes before the chart. It takes no touches and TalkBack skips it, since the points say their
 * own detail.
 */
@Composable
fun ChartTooltipArea(
    tooltip: (@Composable () -> Unit)?,
    anchor: Density.(area: IntSize) -> IntRect?,
    modifier: Modifier = Modifier,
    riseAbove: Boolean = false,
    content: @Composable () -> Unit,
) {
    Layout(
        content = {
            Box { content() }
            tooltip?.let { Box(Modifier.clearAndSetSemantics {}) { it() } }
        },
        modifier = modifier,
    ) { measurables, constraints ->
        val chart = measurables.first().measure(constraints)
        val area = IntSize(chart.width, chart.height)
        val card = measurables.getOrNull(1)?.measure(Constraints(maxWidth = area.width))
        val gap = GAP.roundToPx()

        layout(area.width, area.height) {
            chart.place(0, 0)
            val point = card?.let { anchor(area) } ?: return@layout
            card.placeRelative(tooltipOffset(point, IntSize(card.width, card.height), area, gap, riseAbove), zIndex = 1f)
        }
    }
}

private fun tooltipOffset(
    point: IntRect,
    card: IntSize,
    area: IntSize,
    gap: Int,
    riseAbove: Boolean,
): IntOffset {
    val centered = (point.center.x - card.width / 2).coerceIn(0, (area.width - card.width).coerceAtLeast(0))
    val above = point.top - gap - card.height
    val below = point.bottom + gap
    val after = point.right + gap
    val before = point.left - gap - card.width

    return when {
        riseAbove || above >= 0 -> {
            IntOffset(centered, above)
        }

        below + card.height <= area.height -> {
            IntOffset(centered, below)
        }

        after + card.width <= area.width || before >= 0 -> {
            IntOffset(
                x = if (after + card.width <= area.width) after else before,
                y = (point.center.y - card.height / 2).coerceIn(0, (area.height - card.height).coerceAtLeast(0)),
            )
        }

        else -> {
            IntOffset(centered, above)
        }
    }
}

private val GAP = 8.dp
private val SHADOW = 4.dp
private val NOTE_WIDTH = 224.dp
