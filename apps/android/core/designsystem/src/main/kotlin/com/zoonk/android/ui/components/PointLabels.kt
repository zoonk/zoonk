package com.zoonk.android.ui.components

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import kotlin.math.max
import kotlin.math.min

enum class LabelAnchor { Start, End, Middle }

/** A point's name: [x] is where its [anchor] side sits and [y] its middle. */
data class PointLabel(
    val text: String,
    val anchor: LabelAnchor,
    val x: Float,
    val y: Float,
)

data class KeyEntry(
    val marker: String,
    val label: String,
)

data class PointLabels(
    val key: List<KeyEntry>,
    val labels: List<PointLabel>,
)

class LabelScene(
    val bounds: Rect,
    val dots: List<Offset>,
    val segments: List<Pair<Offset, Offset>>,
)

/**
 * Every labeled point keeps its name: beside its dot where there's room, and when one can't fit without
 * covering another dot or name, every name moves to a numbered key and the dots carry the numbers.
 * Names as short as a number gain nothing from a key, so they stay put. [unit] is one dp in pixels.
 */
fun pointLabels(
    named: List<Pair<Offset, String>>,
    scene: LabelScene,
    size: (String) -> Size,
    unit: Float,
): PointLabels {
    val direct = placeLabels(named, scene, size, unit)
    if (named.all { it.second.length <= MAX_KEY_MARKER_LENGTH } || direct.all { it.second }) {
        return PointLabels(emptyList(), direct.map { it.first })
    }

    val key = named.mapIndexed { index, (_, text) -> KeyEntry("${index + 1}", text) }
    val markers = named.mapIndexed { index, (point, _) -> point to key[index].marker }
    return PointLabels(key, placeLabels(markers, scene, size, unit).map { it.first })
}

private fun placeLabels(
    named: List<Pair<Offset, String>>,
    scene: LabelScene,
    size: (String) -> Size,
    unit: Float,
): List<Pair<PointLabel, Boolean>> {
    val taken = scene.dots.map { Rect(it, PLOT_DOT_ROOM * unit) }.toMutableList()

    return named.map { (point, text) ->
        val measured = size(text)
        val options = candidates(point, text, measured.height, unit).map { it to boxOf(it, measured) }
        val free =
            options
                .filter { (_, box) -> box.inside(scene.bounds) && taken.none { box.overlaps(it, CLEARANCE * unit) } }
                .sortedBy { (_, box) -> scene.segments.count { crosses(it, box) } }
        val best = free.firstOrNull() ?: options.first()
        taken += best.second
        best.first to free.isNotEmpty()
    }
}

private fun candidates(
    dot: Offset,
    text: String,
    height: Float,
    unit: Float,
): List<PointLabel> {
    val radius = PLOT_DOT_ROOM * unit
    val offset = LABEL_OFFSET * unit
    val above = dot.y - offset - height / 2
    val below = dot.y + offset + height / 2

    return listOf(
        PointLabel(text, LabelAnchor.Start, dot.x + offset, dot.y),
        PointLabel(text, LabelAnchor.End, dot.x - offset, dot.y),
        PointLabel(text, LabelAnchor.Middle, dot.x, above),
        PointLabel(text, LabelAnchor.Middle, dot.x, below),
        PointLabel(text, LabelAnchor.Start, dot.x + radius, above),
        PointLabel(text, LabelAnchor.End, dot.x - radius, above),
        PointLabel(text, LabelAnchor.Start, dot.x + radius, below),
        PointLabel(text, LabelAnchor.End, dot.x - radius, below),
    )
}

fun boxOf(
    label: PointLabel,
    size: Size,
): Rect {
    val left =
        when (label.anchor) {
            LabelAnchor.Start -> label.x
            LabelAnchor.End -> label.x - size.width
            LabelAnchor.Middle -> label.x - size.width / 2
        }
    return Rect(left, label.y - size.height / 2, left + size.width, label.y + size.height / 2)
}

private fun Rect.inside(bounds: Rect) = left >= bounds.left && right <= bounds.right && top >= bounds.top && bottom <= bounds.bottom

private fun Rect.overlaps(
    other: Rect,
    clearance: Float,
) = left < other.right + clearance && other.left < right + clearance && top < other.bottom + clearance && other.top < bottom + clearance

internal fun crosses(
    segment: Pair<Offset, Offset>,
    box: Rect,
): Boolean {
    val (from, to) = segment
    val low = max(min(from.x, to.x), box.left)
    val high = min(max(from.x, to.x), box.right)
    if (low > high) return false

    fun yAt(x: Float) = from.y + (x - from.x) / (to.x - from.x) * (to.y - from.y)
    val ys = if (to.x == from.x) listOf(from.y, to.y) else listOf(yAt(low), yAt(high))
    return ys.max() >= box.top && ys.min() <= box.bottom
}

internal const val PLOT_DOT_ROOM = 4.5f
private const val LABEL_OFFSET = PLOT_DOT_ROOM + 3f
private const val CLEARANCE = 1f
private const val MAX_KEY_MARKER_LENGTH = 2
