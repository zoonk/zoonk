package com.zoonk.android.ui.components

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
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
 * covering another dot or name, every name moves to a numbered key counting from [firstMarker], and the dots
 * carry the numbers. Names as short as a number gain nothing from a key, so they stay put. [width] is a name's
 * width in layout units.
 */
fun pointLabels(
    named: List<Pair<Offset, String>>,
    scene: LabelScene,
    width: (String) -> Float,
    firstMarker: Int = 1,
): PointLabels {
    val direct = placeLabels(named, scene, width)
    if (named.all { it.second.length <= MAX_KEY_MARKER_LENGTH } || direct.all { it.second }) {
        return PointLabels(emptyList(), direct.map { it.first })
    }

    val key = named.mapIndexed { index, (_, text) -> KeyEntry("${firstMarker + index}", text) }
    val markers = named.mapIndexed { index, (point, _) -> point to key[index].marker }
    return PointLabels(key, placeLabels(markers, scene, width).map { it.first })
}

private fun placeLabels(
    named: List<Pair<Offset, String>>,
    scene: LabelScene,
    width: (String) -> Float,
): List<Pair<PointLabel, Boolean>> {
    val taken = scene.dots.map { Rect(it, PLOT_DOT_ROOM) }.toMutableList()

    return named.map { (point, text) ->
        val measured = width(text)
        val dot = Rect(point, PLOT_DOT_ROOM)
        val options = candidates(point, text).map { it to boxOf(it, measured) }
        val free =
            options
                .filter { (_, box) -> box.inside(scene.bounds) && taken.none { box.overlaps(it, CLEARANCE) } }
                // The label with the gap to its dot: a line through it, such as a reference, would part them.
                .sortedBy { (_, box) -> scene.segments.count { crosses(it, box.union(dot)) } }
        val best = free.firstOrNull() ?: options.first()
        taken += best.second
        best.first to free.isNotEmpty()
    }
}

private fun candidates(
    dot: Offset,
    text: String,
): List<PointLabel> {
    val above = dot.y - LABEL_OFFSET - LABEL_HEIGHT / 2
    val below = dot.y + LABEL_OFFSET + LABEL_HEIGHT / 2

    return listOf(
        PointLabel(text, LabelAnchor.Start, dot.x + LABEL_OFFSET, dot.y),
        PointLabel(text, LabelAnchor.End, dot.x - LABEL_OFFSET, dot.y),
        PointLabel(text, LabelAnchor.Middle, dot.x, above),
        PointLabel(text, LabelAnchor.Middle, dot.x, below),
        PointLabel(text, LabelAnchor.Start, dot.x + PLOT_DOT_ROOM, above),
        PointLabel(text, LabelAnchor.End, dot.x - PLOT_DOT_ROOM, above),
        PointLabel(text, LabelAnchor.Start, dot.x + PLOT_DOT_ROOM, below),
        PointLabel(text, LabelAnchor.End, dot.x - PLOT_DOT_ROOM, below),
    )
}

private fun boxOf(
    label: PointLabel,
    width: Float,
): Rect {
    val left =
        when (label.anchor) {
            LabelAnchor.Start -> label.x
            LabelAnchor.End -> label.x - width
            LabelAnchor.Middle -> label.x - width / 2
        }
    return Rect(left, label.y - LABEL_HEIGHT / 2, left + width, label.y + LABEL_HEIGHT / 2)
}

private fun Rect.union(other: Rect) = Rect(min(left, other.left), min(top, other.top), max(right, other.right), max(bottom, other.bottom))

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
private const val LABEL_HEIGHT = 14f
private const val CLEARANCE = 1f
private const val MAX_KEY_MARKER_LENGTH = 2
